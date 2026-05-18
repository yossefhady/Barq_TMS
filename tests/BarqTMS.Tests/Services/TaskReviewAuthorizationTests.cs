using BarqTMS.API.DTOs;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using BarqTMS.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Services;

// CRIT-01: Every task is reviewed by the person who assigned it (or Manager override).
public sealed class TaskReviewAuthorizationTests
{
    private static TaskService BuildService(BarqTMS.API.Data.BarqTMSDbContext db) =>
        new(db, NullLogger<TaskService>.Instance, new FakeNotificationService());

    [Fact]
    public async Task ReviewCompletionAsync_AllowsOriginalAssigner()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = SeedData.AddTaskInReview(db, assignerId: world.TeamLeaderA.UserId, assigneeId: world.EmployeeA.UserId, deptId: world.SalesDept.DeptId);
        var sut = BuildService(db);

        var dto = new ReviewTaskCompletionDto { Approve = true, Notes = "good" };

        var act = async () => await sut.ReviewCompletionAsync(task.TaskId, dto, world.TeamLeaderA.UserId, UserRole.TeamLeader);

        await act.Should().NotThrowAsync();
        var refreshed = await db.Tasks.FindAsync(task.TaskId);
        refreshed!.Status.Should().Be(TaskStatus.Completed);
    }

    [Fact]
    public async Task ReviewCompletionAsync_RejectsTeamLeaderWhoDidNotAssign()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = SeedData.AddTaskInReview(db, assignerId: world.TeamLeaderA.UserId, assigneeId: world.EmployeeA.UserId, deptId: world.SalesDept.DeptId);
        var sut = BuildService(db);

        var dto = new ReviewTaskCompletionDto { Approve = true };

        var act = async () => await sut.ReviewCompletionAsync(task.TaskId, dto, world.TeamLeaderB.UserId, UserRole.TeamLeader);

        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("*assigner*");
    }

    [Fact]
    public async Task ReviewCompletionAsync_AllowsManagerEvenIfNotAssigner()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = SeedData.AddTaskInReview(db, assignerId: world.TeamLeaderA.UserId, assigneeId: world.EmployeeA.UserId, deptId: world.SalesDept.DeptId);
        var sut = BuildService(db);

        var dto = new ReviewTaskCompletionDto { Approve = true };

        var act = async () => await sut.ReviewCompletionAsync(task.TaskId, dto, world.Manager.UserId, UserRole.Manager);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ReviewCompletionAsync_AllowsAssistantManagerOverride()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = SeedData.AddTaskInReview(db, assignerId: world.TeamLeaderA.UserId, assigneeId: world.EmployeeA.UserId, deptId: world.SalesDept.DeptId);
        var sut = BuildService(db);

        var dto = new ReviewTaskCompletionDto { Approve = false, Notes = "needs work" };

        var act = async () => await sut.ReviewCompletionAsync(task.TaskId, dto, world.AssistantManager.UserId, UserRole.AssistantManager);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ReviewCompletionAsync_AllowsDelegator()
    {
        // If TL-A delegated to TL-B via "pass", then TL-B is the new delegator on record.
        // Whichever is the current DelegatedBy should be allowed to review.
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = SeedData.AddTaskInReview(db, assignerId: world.TeamLeaderA.UserId, assigneeId: world.EmployeeA.UserId, deptId: world.SalesDept.DeptId, delegatedBy: world.TeamLeaderB.UserId);
        var sut = BuildService(db);

        var dto = new ReviewTaskCompletionDto { Approve = true };

        var act = async () => await sut.ReviewCompletionAsync(task.TaskId, dto, world.TeamLeaderB.UserId, UserRole.TeamLeader);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ReviewCompletionAsync_RejectsAccountManagerWhoDidNotAssign()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = SeedData.AddTaskInReview(db, assignerId: world.TeamLeaderA.UserId, assigneeId: world.EmployeeA.UserId, deptId: world.SalesDept.DeptId);
        var sut = BuildService(db);

        var dto = new ReviewTaskCompletionDto { Approve = true };
        var randomAcctMgrId = 99; // not the assigner, not delegator

        var act = async () => await sut.ReviewCompletionAsync(task.TaskId, dto, randomAcctMgrId, UserRole.AccountManager);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }
}
