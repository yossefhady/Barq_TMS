using Microsoft.EntityFrameworkCore;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;

namespace BarqTMS.API.Data
{
    public static class DatabaseSeeder
    {
        public static async Task SeedDatabaseAsync(BarqTMSDbContext context, AuthService authService)
        {
            // EF InMemory provider (used by integration tests) does not support migrations,
            // so use EnsureCreated for that path and Migrate for relational providers.
            if (context.Database.IsRelational())
            {
                await context.Database.MigrateAsync();
            }
            else
            {
                await context.Database.EnsureCreatedAsync();
            }

            await SeedDepartments(context);
            await SeedUsers(context, authService);

            await context.SaveChangesAsync();
        }

        private static async Task SeedDepartments(BarqTMSDbContext context)
        {
            if (await context.Departments.AnyAsync())
            {
                return;
            }

            var departments = new[]
            {
                new Department { Name = "Management", Description = "Executive Management", Type = DepartmentType.Management },
                new Department { Name = "Accounts", Description = "Client Accounts Management", Type = DepartmentType.Accounts },
                new Department { Name = "Sales", Description = "Sales Department", Type = DepartmentType.Sales },
                new Department { Name = "Creative", Description = "Creative Department (Marketing & Graphics)", Type = DepartmentType.Creative },
                new Department { Name = "Marketing", Description = "Marketing Sub-Department", Type = DepartmentType.Marketing },
                new Department { Name = "Graphic Design", Description = "Graphics Sub-Department", Type = DepartmentType.GraphicDesign }
            };

            await context.Departments.AddRangeAsync(departments);
            await context.SaveChangesAsync();
        }

        private static async Task SeedUsers(BarqTMSDbContext context, AuthService authService)
        {
            if (await context.Users.AnyAsync()) return;

            var depts = await context.Departments.ToListAsync();
            var manDept = depts.FirstOrDefault(d => d.Name == "Management");
            var acctDept = depts.FirstOrDefault(d => d.Name == "Accounts");
            var salesDept = depts.FirstOrDefault(d => d.Name == "Sales");
            var creativeDept = depts.FirstOrDefault(d => d.Name == "Creative");
            var mktDept = depts.FirstOrDefault(d => d.Name == "Marketing");
            var graphicDept = depts.FirstOrDefault(d => d.Name == "Graphic Design");

            // 1. Managers (Admin + 1 Manager)
            var admin = new User
            {
                FullName = "System Administrator",
                Username = "admin",
                Email = "admin@barqtms.com",
                PasswordHash = authService.HashPassword("Admin@123"),
                Role = UserRole.Manager,
                IsActive = true,
                DepartmentId = manDept?.DeptId,
                CreatedAt = DateTime.UtcNow
            };

            var manager = new User
            {
                FullName = "Mohamed Elbadry",
                Username = "elbadry0",
                Email = "mohammed.elbadry0@gmail.com",
                PasswordHash = authService.HashPassword("Mohamed@80"),
                Role = UserRole.Manager,
                IsActive = true,
                DepartmentId = manDept?.DeptId,
                CreatedAt = DateTime.UtcNow
            };

            context.Users.AddRange(admin, manager);
            await context.SaveChangesAsync(); // Save to get IDs
        }
    }

}
