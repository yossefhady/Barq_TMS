using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using BarqTMS.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Services;

// MED-05: Reopen completed task — original assigner OR Manager/AsstMgr only.
public sealed class ReopenTaskTests
{
    private static TaskService BuildService(BarqTMS.API.Data.BarqTMSDbContext db) =>
        new(db, NullLogger<TaskService>.Instance, new FakeNotificationService());

    private static WorkTask AddCompletedTask(BarqTMS.API.Data.BarqTMSDbContext db, int assignerId, int deptId)
    {
        var task = new WorkTask
        {
            Title = "Done",
            DriveFolderLink = "/x",
            DepartmentId = deptId,
            Status = TaskStatus.Completed,
            Priority = TaskPriority.Medium,
            OriginalAssignerId = assignerId,
            CreatedBy = assignerId,
            CompletedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
        };
        db.Tasks.Add(task);
        db.SaveChanges();
        return task;
    }

    [Fact]
    public async Task Reopen_AllowsOriginalAssigner()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddCompletedTask(db, world.TeamLeaderA.UserId, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var ok = await sut.ReopenTaskAsync(task.TaskId, world.TeamLeaderA.UserId, UserRole.TeamLeader, "needs revision");

        ok.Should().BeTrue();
        var refreshed = await db.Tasks.FindAsync(task.TaskId);
        refreshed!.Status.Should().Be(TaskStatus.InProgress);
        refreshed.CompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task Reopen_RejectsForeignTeamLeader()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddCompletedTask(db, world.TeamLeaderA.UserId, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var act = async () => await sut.ReopenTaskAsync(task.TaskId, world.TeamLeaderB.UserId, UserRole.TeamLeader, null);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task Reopen_AllowsManagerOverride()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddCompletedTask(db, world.TeamLeaderA.UserId, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var ok = await sut.ReopenTaskAsync(task.TaskId, world.Manager.UserId, UserRole.Manager, "QA needed");

        ok.Should().BeTrue();
    }

    [Fact]
    public async Task Reopen_RejectsNonCompletedTask()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddCompletedTask(db, world.TeamLeaderA.UserId, world.SalesDept.DeptId);
        task.Status = TaskStatus.InProgress;
        db.SaveChanges();
        var sut = BuildService(db);

        var act = async () => await sut.ReopenTaskAsync(task.TaskId, world.TeamLeaderA.UserId, UserRole.TeamLeader, null);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}
