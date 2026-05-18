using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using BarqTMS.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Services;

// HIGH-04: Sales-specific rules must key off Department.Type, not Department.Name.
// Renaming "Sales" to "Sales & BD" must NOT disable the mandatory-note validation.
public sealed class DepartmentTypeMatchingTests
{
    private static TaskService BuildService(BarqTMS.API.Data.BarqTMSDbContext db) =>
        new(db, NullLogger<TaskService>.Instance, new FakeNotificationService());

    [Fact]
    public async Task SalesMandatoryNote_StillEnforced_WhenDeptIsRenamed()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);

        // Rename the Sales department label (admin scenario).
        world.SalesDept.Name = "Sales & BD";
        db.SaveChanges();

        var task = new WorkTask
        {
            Title = "Sales call",
            DriveFolderLink = "/x",
            DepartmentId = world.SalesDept.DeptId,
            Status = TaskStatus.InProgress,
            Priority = TaskPriority.Medium,
            OriginalAssignerId = world.TeamLeaderA.UserId,
            CreatedBy = world.TeamLeaderA.UserId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Tasks.Add(task);
        db.SaveChanges();
        db.TaskAssignees.Add(new TaskAssignee { TaskId = task.TaskId, UserId = world.EmployeeA.UserId });
        db.SaveChanges();

        var sut = BuildService(db);

        // Transition to InReview WITHOUT a note must still fail because Type == Sales.
        var dto = new UpdateTaskStatusDto { StatusId = (int)TaskStatus.InReview, Notes = "" };
        var act = async () => await sut.UpdateTaskStatusAsync(task.TaskId, dto, world.EmployeeA.UserId);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*Sales*");
    }

    [Fact]
    public async Task NonSalesDepartment_DoesNotRequireMandatoryNote()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);

        var task = new WorkTask
        {
            Title = "Creative",
            DriveFolderLink = "/x",
            DepartmentId = 2, // Creative
            Status = TaskStatus.InProgress,
            Priority = TaskPriority.Medium,
            OriginalAssignerId = world.TeamLeaderB.UserId,
            CreatedBy = world.TeamLeaderB.UserId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Tasks.Add(task);
        db.SaveChanges();
        db.TaskAssignees.Add(new TaskAssignee { TaskId = task.TaskId, UserId = world.EmployeeB.UserId });
        db.SaveChanges();

        var sut = BuildService(db);

        var dto = new UpdateTaskStatusDto { StatusId = (int)TaskStatus.InReview, Notes = null };
        var act = async () => await sut.UpdateTaskStatusAsync(task.TaskId, dto, world.EmployeeB.UserId);

        await act.Should().NotThrowAsync();
    }
}
