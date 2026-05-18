using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using BarqTMS.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Services;

// MED-03: TLs may delete their own Pending tasks. Manager/AsstMgr override.
// Other roles forbidden. In-progress / completed tasks may not be deleted by TLs.
public sealed class DeleteTaskPolicyTests
{
    private static TaskService BuildService(BarqTMS.API.Data.BarqTMSDbContext db) =>
        new(db, NullLogger<TaskService>.Instance, new FakeNotificationService());

    private static WorkTask AddTask(BarqTMS.API.Data.BarqTMSDbContext db, int assignerId, TaskStatus status, int deptId)
    {
        var task = new WorkTask
        {
            Title = "T",
            DriveFolderLink = "/x",
            DepartmentId = deptId,
            Status = status,
            Priority = TaskPriority.Medium,
            OriginalAssignerId = assignerId,
            CreatedBy = assignerId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Tasks.Add(task);
        db.SaveChanges();
        return task;
    }

    [Fact]
    public async Task Delete_TL_CanDeleteOwnPendingTask()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderA.UserId, TaskStatus.Pending, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var result = await sut.DeleteTaskAsync(task.TaskId, world.TeamLeaderA.UserId, UserRole.TeamLeader);

        result.Should().BeTrue();
        (await db.Tasks.FindAsync(task.TaskId)).Should().BeNull();
    }

    [Fact]
    public async Task Delete_TL_CannotDeleteInProgressTask()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderA.UserId, TaskStatus.InProgress, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var act = async () => await sut.DeleteTaskAsync(task.TaskId, world.TeamLeaderA.UserId, UserRole.TeamLeader);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Pending*");
    }

    [Fact]
    public async Task Delete_TL_CannotDeleteOtherAssignersTask()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderB.UserId, TaskStatus.Pending, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var act = async () => await sut.DeleteTaskAsync(task.TaskId, world.TeamLeaderA.UserId, UserRole.TeamLeader);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task Delete_Manager_CanDeleteAnyTask()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderA.UserId, TaskStatus.Completed, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var result = await sut.DeleteTaskAsync(task.TaskId, world.Manager.UserId, UserRole.Manager);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task Delete_Employee_AlwaysForbidden()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderA.UserId, TaskStatus.Pending, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var act = async () => await sut.DeleteTaskAsync(task.TaskId, world.EmployeeA.UserId, UserRole.Employee);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }
}
