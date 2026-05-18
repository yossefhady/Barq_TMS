using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Models.Sales;
using BarqTMS.API.Services;
using BarqTMS.Tests.Helpers;
using FluentAssertions;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Services;

// HIGH-05: Team performance summary works for any DepartmentType.
public sealed class TeamPerformanceServiceTests
{
    [Fact]
    public async Task GetSummary_Sales_AggregatesClosingTasks()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);

        // Sales target for TL-A this month.
        var today = DateTime.UtcNow;
        var monthStart = new DateTime(today.Year, today.Month, 1);
        db.SalesTargets.Add(new SalesTarget
        {
            TeamLeaderId = world.TeamLeaderA.UserId,
            Month = monthStart,
            TargetClients = 5,
            TargetMeetings = 3,
            TargetData = 10,
        });
        // Completed sales task assigned to EmployeeA (TL-A's subordinate).
        var task = new WorkTask
        {
            Title = "closing 1",
            DriveFolderLink = "/x",
            DepartmentId = world.SalesDept.DeptId,
            Status = TaskStatus.Completed,
            Priority = TaskPriority.Medium,
            OriginalAssignerId = world.TeamLeaderA.UserId,
            CreatedBy = world.TeamLeaderA.UserId,
            SalesActivityType = SalesActivityType.Closing,
            FinalKpiValue = 2,
            CompletedAt = today,
            CreatedAt = today.AddDays(-1),
        };
        db.Tasks.Add(task);
        db.SaveChanges();
        db.TaskAssignees.Add(new TaskAssignee { TaskId = task.TaskId, UserId = world.EmployeeA.UserId });
        db.SaveChanges();

        var sut = new TeamPerformanceService(db);
        var result = await sut.GetSummaryAsync(DepartmentType.Sales, today.Month, today.Year);

        result.Should().ContainSingle(r => r.TeamLeaderId == world.TeamLeaderA.UserId);
        var row = result.First(r => r.TeamLeaderId == world.TeamLeaderA.UserId);
        row.TargetClients.Should().Be(5);
        row.ActualClients.Should().Be(2);
    }

    [Fact]
    public async Task GetSummary_Marketing_ReturnsTLsWithZeroActuals()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);

        // Add a Marketing department + a Marketing TL.
        var mktDept = new Department { DeptId = 3, Name = "Marketing", Type = DepartmentType.Marketing };
        db.Departments.Add(mktDept);
        var mktTL = new User { UserId = 20, Username = "mkttl", FullName = "Marketing TL", Email = "m@x.com", PasswordHash = "x", Role = UserRole.TeamLeader, DepartmentId = mktDept.DeptId };
        db.Users.Add(mktTL);
        db.SaveChanges();

        var sut = new TeamPerformanceService(db);
        var today = DateTime.UtcNow;
        var result = await sut.GetSummaryAsync(DepartmentType.Marketing, today.Month, today.Year);

        result.Should().ContainSingle();
        result[0].TeamLeaderId.Should().Be(mktTL.UserId);
        result[0].ActualClients.Should().Be(0);
        result[0].TargetClients.Should().Be(0);
    }

    [Fact]
    public async Task GetSummary_UnknownDepartment_ReturnsEmpty()
    {
        using var db = TestDbContextFactory.Create();
        SeedData.Seed(db);
        var sut = new TeamPerformanceService(db);

        var result = await sut.GetSummaryAsync(DepartmentType.Accounts, DateTime.UtcNow.Month, DateTime.UtcNow.Year);

        result.Should().BeEmpty();
    }
}
