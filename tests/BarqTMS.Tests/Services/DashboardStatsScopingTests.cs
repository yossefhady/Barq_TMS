using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using BarqTMS.Tests.Helpers;
using FluentAssertions;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Services;

// CRIT-07: /api/Dashboard/stats must scope counts by caller's role.
public sealed class DashboardStatsScopingTests
{
    private static void SeedTasksAndCompanies(BarqTMS.API.Data.BarqTMSDbContext db, SeededWorld world)
    {
        // 2 companies (clients).
        db.Companies.AddRange(
            new Company { CompanyId = 1, Name = "Acme" },
            new Company { CompanyId = 2, Name = "Globex" });
        // 1 project per company.
        db.Projects.AddRange(
            new Project { ProjectId = 1, Name = "P1", CompanyId = 1 },
            new Project { ProjectId = 2, Name = "P2", CompanyId = 2 });

        // 3 tasks assigned to EmployeeA (TL-A's team), 1 task to EmployeeB (TL-B's team).
        for (int i = 0; i < 3; i++)
        {
            var t = new WorkTask { Title = $"a{i}", DriveFolderLink = "/x", DepartmentId = world.SalesDept.DeptId, Status = TaskStatus.Pending, Priority = TaskPriority.Low, OriginalAssignerId = world.TeamLeaderA.UserId, CreatedBy = world.TeamLeaderA.UserId, CreatedAt = DateTime.UtcNow };
            db.Tasks.Add(t);
            db.SaveChanges();
            db.TaskAssignees.Add(new TaskAssignee { TaskId = t.TaskId, UserId = world.EmployeeA.UserId });
        }
        var tb = new WorkTask { Title = "b", DriveFolderLink = "/x", DepartmentId = 2, Status = TaskStatus.Pending, Priority = TaskPriority.Low, OriginalAssignerId = world.TeamLeaderB.UserId, CreatedBy = world.TeamLeaderB.UserId, CreatedAt = DateTime.UtcNow };
        db.Tasks.Add(tb);
        db.SaveChanges();
        db.TaskAssignees.Add(new TaskAssignee { TaskId = tb.TaskId, UserId = world.EmployeeB.UserId });

        db.SaveChanges();
    }

    [Fact]
    public async Task GetStats_Manager_SeesGlobalCounts()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        SeedTasksAndCompanies(db, world);

        var sut = new DashboardStatsService(db);
        var stats = await sut.GetStatsAsync(world.Manager.UserId, UserRole.Manager);

        stats.TotalTasks.Should().Be(4);
        stats.TotalProjects.Should().Be(2);
        stats.TotalClients.Should().Be(2);
        stats.TotalUsers.Should().Be(6);
    }

    [Fact]
    public async Task GetStats_Employee_OnlySeesOwnTasksAndNoClientCount()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        SeedTasksAndCompanies(db, world);

        var sut = new DashboardStatsService(db);
        var stats = await sut.GetStatsAsync(world.EmployeeA.UserId, UserRole.Employee);

        stats.TotalTasks.Should().Be(3);  // only tasks assigned to EmployeeA
        stats.TotalClients.Should().Be(0); // employees don't see global client count
        stats.TotalUsers.Should().Be(0);   // employees don't see global user count
    }

    [Fact]
    public async Task GetStats_TeamLeader_SeesTeamTasksAndOwn()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        SeedTasksAndCompanies(db, world);

        var sut = new DashboardStatsService(db);
        var stats = await sut.GetStatsAsync(world.TeamLeaderA.UserId, UserRole.TeamLeader);

        stats.TotalTasks.Should().Be(3); // 3 tasks assigned to TL-A's subordinate
        stats.TotalClients.Should().Be(0); // TLs don't see global client count
    }

    [Fact]
    public async Task GetStats_Client_OnlySeesOwnProjects()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        SeedTasksAndCompanies(db, world);
        // Make a Client user owning company 1
        var client = new User { UserId = 10, Username = "c1", FullName = "Client One", Email = "c@x.com", PasswordHash = "x", Role = UserRole.Client };
        db.Users.Add(client);
        db.SaveChanges();
        var acme = await db.Companies.FindAsync(1);
        acme!.OwnerUserId = client.UserId;
        db.SaveChanges();

        var sut = new DashboardStatsService(db);
        var stats = await sut.GetStatsAsync(client.UserId, UserRole.Client);

        stats.TotalProjects.Should().Be(1); // only project linked to their owned company
        stats.TotalClients.Should().Be(0);
        stats.TotalUsers.Should().Be(0);
    }
}
