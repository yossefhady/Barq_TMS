using BarqTMS.API.Data;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace BarqTMS.Tests.Integration;

// Boots the API in-process with EF InMemory so the role smoke suite can exercise the
// real HTTP pipeline (auth middleware, controllers, services, DI graph).
internal sealed class RoleSmokeFactory : WebApplicationFactory<Program>
{
    public string DbName { get; } = Guid.NewGuid().ToString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Jwt:SecretKey", "ThisIsAnInsecureTestSecretKeyMinimum32CharsLong!");
        builder.UseSetting("Jwt:Issuer", "BarqTMS.API.Test");
        builder.UseSetting("Jwt:Audience", "BarqTMS.Client.Test");
        builder.UseSetting("Jwt:ExpirationInMinutes", "60");
        Environment.SetEnvironmentVariable("JWT_SECRET_KEY", "ThisIsAnInsecureTestSecretKeyMinimum32CharsLong!");

        builder.ConfigureServices(services =>
        {
            // Strip every EF-related registration so the InMemory provider doesn't collide
            // with the production SQL Server provider in the same internal service provider.
            var efDescriptors = services.Where(d =>
                d.ServiceType?.FullName?.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) == true
                || d.ServiceType == typeof(DbContextOptions<BarqTMSDbContext>)
                || d.ServiceType == typeof(DbContextOptions)
                || d.ServiceType == typeof(BarqTMSDbContext)
            ).ToList();
            foreach (var d in efDescriptors) services.Remove(d);

            // Use an isolated internal service provider for the InMemory provider so its
            // registrations never see the SQL Server side.
            var efServiceProvider = new ServiceCollection()
                .AddEntityFrameworkInMemoryDatabase()
                .BuildServiceProvider();

            services.AddDbContext<BarqTMSDbContext>(opts =>
            {
                opts.UseInMemoryDatabase(DbName);
                opts.UseInternalServiceProvider(efServiceProvider);
                opts.EnableSensitiveDataLogging();
            });

            // Strip hosted services (overdue notifier) — irrelevant for smoke tests.
            foreach (var hs in services.Where(s => s.ServiceType == typeof(IHostedService)).ToList())
            {
                services.Remove(hs);
            }
        });
    }

    public void SeedWorld()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BarqTMSDbContext>();

        // Program.cs's DatabaseSeeder runs on app boot. It seeds the canonical departments
        // and the admin/elbadry0 users — leave those alone and add the role-specific users
        // this suite needs.
        Department GetOrCreateDept(string name, DepartmentType type)
        {
            var existing = db.Departments.FirstOrDefault(d => d.Name == name);
            if (existing != null) return existing;
            var d = new Department { Name = name, Type = type };
            db.Departments.Add(d);
            db.SaveChanges();
            return d;
        }
        var sales = GetOrCreateDept("Sales", DepartmentType.Sales);
        var marketing = GetOrCreateDept("Marketing", DepartmentType.Marketing);
        var creative = GetOrCreateDept("Creative", DepartmentType.Creative);

        if (db.Users.Any(u => u.Username == "mgr")) return; // already seeded

        var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
        string Hash(string p) => auth.HashPassword(p);

        var manager = new User { Username = "mgr", FullName = "Manager", Email = "m@x.com", PasswordHash = Hash("pw"), Role = UserRole.Manager, IsActive = true };
        var asstMgr = new User { Username = "asst", FullName = "Asst Manager", Email = "a@x.com", PasswordHash = Hash("pw"), Role = UserRole.AssistantManager, IsActive = true };
        var acctMgr = new User { Username = "acct", FullName = "Account Manager", Email = "ac@x.com", PasswordHash = Hash("pw"), Role = UserRole.AccountManager, IsActive = true };
        db.Users.AddRange(manager, asstMgr, acctMgr);
        db.SaveChanges();

        var tlSales = new User { Username = "tlsales", FullName = "TL Sales", Email = "ts@x.com", PasswordHash = Hash("pw"), Role = UserRole.TeamLeader, DepartmentId = sales.DeptId, IsActive = true };
        var tlMarketing = new User { Username = "tlmkt", FullName = "TL Marketing", Email = "tm@x.com", PasswordHash = Hash("pw"), Role = UserRole.TeamLeader, DepartmentId = marketing.DeptId, IsActive = true };
        db.Users.AddRange(tlSales, tlMarketing);
        db.SaveChanges();

        var empSales = new User { Username = "esales", FullName = "Emp Sales", Email = "es@x.com", PasswordHash = Hash("pw"), Role = UserRole.Employee, DepartmentId = sales.DeptId, SupervisorId = tlSales.UserId, IsActive = true };
        var empCreative = new User { Username = "ecre", FullName = "Emp Creative", Email = "ec@x.com", PasswordHash = Hash("pw"), Role = UserRole.Employee, DepartmentId = creative.DeptId, SupervisorId = tlMarketing.UserId, IsActive = true };
        db.Users.AddRange(empSales, empCreative);
        db.SaveChanges();

        var client = new User { Username = "client1", FullName = "Client One", Email = "c@x.com", PasswordHash = Hash("pw"), Role = UserRole.Client, IsActive = true };
        db.Users.Add(client);
        db.SaveChanges();

        var company = new Company { Name = "Acme", OwnerUserId = client.UserId };
        db.Companies.Add(company);
        db.SaveChanges();

        var project = new Project { Name = "Acme Launch", CompanyId = company.CompanyId, Status = ProjectStatus.Active, StartDate = DateTime.UtcNow };
        db.Projects.Add(project);
        db.SaveChanges();
    }

    public string TokenFor(string username)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BarqTMSDbContext>();
        var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
        var user = db.Users.First(u => u.Username == username);
        return auth.GenerateJwtToken(user);
    }
}
