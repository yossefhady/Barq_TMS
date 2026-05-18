using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using BarqTMS.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Services;

// CRIT-03: Team Leaders can only assign tasks to their direct subordinates,
// at create-time AND at update-time AND at pass-time.
public sealed class HierarchyEnforcementTests
{
    private static TaskService BuildService(BarqTMS.API.Data.BarqTMSDbContext db) =>
        new(db, NullLogger<TaskService>.Instance, new FakeNotificationService());

    private static WorkTask AddPendingTaskAssignedTo(BarqTMS.API.Data.BarqTMSDbContext db, int assignerId, int assigneeId, int deptId)
    {
        var task = new WorkTask
        {
            Title = "T",
            DriveFolderLink = "https://drive/x",
            DepartmentId = deptId,
            Status = TaskStatus.Pending,
            Priority = TaskPriority.Medium,
            OriginalAssignerId = assignerId,
            CreatedBy = assignerId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Tasks.Add(task);
        db.SaveChanges();
        db.TaskAssignees.Add(new TaskAssignee { TaskId = task.TaskId, UserId = assigneeId });
        db.SaveChanges();
        return task;
    }

    [Fact]
    public async Task UpdateTaskAsync_TeamLeader_CannotReassignToNonSubordinate()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddPendingTaskAssignedTo(db, world.TeamLeaderA.UserId, world.TeamLeaderA.UserId, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var dto = new UpdateTaskDto
        {
            Title = task.Title,
            PriorityId = (int)TaskPriority.Medium,
            StatusId = (int)TaskStatus.Pending,
            DeptId = world.SalesDept.DeptId,
            DriveFolderLink = task.DriveFolderLink,
            AssignedTo = world.EmployeeB.UserId, // belongs to TL-B, not TL-A
        };

        var act = async () => await sut.UpdateTaskAsync(task.TaskId, dto, world.TeamLeaderA.UserId, UserRole.TeamLeader);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*subordinate*");
    }

    [Fact]
    public async Task UpdateTaskAsync_TeamLeader_CanReassignToOwnSubordinate()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddPendingTaskAssignedTo(db, world.TeamLeaderA.UserId, world.TeamLeaderA.UserId, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var dto = new UpdateTaskDto
        {
            Title = task.Title,
            PriorityId = (int)TaskPriority.Medium,
            StatusId = (int)TaskStatus.Pending,
            DeptId = world.SalesDept.DeptId,
            DriveFolderLink = task.DriveFolderLink,
            AssignedTo = world.EmployeeA.UserId, // valid: EmployeeA reports to TL-A
        };

        var act = async () => await sut.UpdateTaskAsync(task.TaskId, dto, world.TeamLeaderA.UserId, UserRole.TeamLeader);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task UpdateTaskAsync_Manager_CanReassignToAnyone()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddPendingTaskAssignedTo(db, world.Manager.UserId, world.EmployeeA.UserId, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var dto = new UpdateTaskDto
        {
            Title = task.Title,
            PriorityId = (int)TaskPriority.Medium,
            StatusId = (int)TaskStatus.Pending,
            DeptId = world.SalesDept.DeptId,
            DriveFolderLink = task.DriveFolderLink,
            AssignedTo = world.EmployeeB.UserId, // any user
        };

        var act = async () => await sut.UpdateTaskAsync(task.TaskId, dto, world.Manager.UserId, UserRole.Manager);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task PassTaskAsync_TeamLeader_CannotPassToNonSubordinate()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddPendingTaskAssignedTo(db, world.TeamLeaderA.UserId, world.EmployeeA.UserId, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var act = async () => await sut.PassTaskAsync(task.TaskId, world.EmployeeB.UserId, "delegating to TLB's emp", world.TeamLeaderA.UserId, UserRole.TeamLeader);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*subordinate*");
    }

    [Fact]
    public async Task PassTaskAsync_TeamLeader_CanPassToOwnSubordinate()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        // Add another subordinate of TL-A
        var empA2 = new User { UserId = 7, Username = "empA2", FullName = "Emp A2", Email = "ea2@x.com", PasswordHash = "x", Role = UserRole.Employee, DepartmentId = world.SalesDept.DeptId, SupervisorId = world.TeamLeaderA.UserId };
        db.Users.Add(empA2);
        db.SaveChanges();
        var task = AddPendingTaskAssignedTo(db, world.TeamLeaderA.UserId, world.EmployeeA.UserId, world.SalesDept.DeptId);
        var sut = BuildService(db);

        var act = async () => await sut.PassTaskAsync(task.TaskId, empA2.UserId, null, world.TeamLeaderA.UserId, UserRole.TeamLeader);

        await act.Should().NotThrowAsync();
        var assignees = db.TaskAssignees.Where(ta => ta.TaskId == task.TaskId).ToList();
        assignees.Should().HaveCount(1);
        assignees[0].UserId.Should().Be(empA2.UserId);
    }
}
