using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using BarqTMS.Tests.Helpers;
using FluentAssertions;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Services;

// CRIT-06: File upload/download/delete must be restricted to users related to the task.
public sealed class FileUploadAuthorizationTests
{
    private static WorkTask AddTask(BarqTMS.API.Data.BarqTMSDbContext db, int assignerId, int assigneeId, int deptId, int? projectId = null)
    {
        var task = new WorkTask
        {
            Title = "T",
            DriveFolderLink = "https://drive/x",
            DepartmentId = deptId,
            Status = TaskStatus.InProgress,
            Priority = TaskPriority.Medium,
            OriginalAssignerId = assignerId,
            CreatedBy = assignerId,
            ProjectId = projectId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Tasks.Add(task);
        db.SaveChanges();
        db.TaskAssignees.Add(new TaskAssignee { TaskId = task.TaskId, UserId = assigneeId });
        db.SaveChanges();
        return task;
    }

    [Fact]
    public async Task CanAccessTaskFiles_AllowsAssignee()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderA.UserId, world.EmployeeA.UserId, world.SalesDept.DeptId);

        var allowed = await TaskAccessPolicy.CanAccessTaskFilesAsync(db, task.TaskId, world.EmployeeA.UserId, UserRole.Employee);

        allowed.Should().BeTrue();
    }

    [Fact]
    public async Task CanAccessTaskFiles_AllowsOriginalAssigner()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderA.UserId, world.EmployeeA.UserId, world.SalesDept.DeptId);

        var allowed = await TaskAccessPolicy.CanAccessTaskFilesAsync(db, task.TaskId, world.TeamLeaderA.UserId, UserRole.TeamLeader);

        allowed.Should().BeTrue();
    }

    [Fact]
    public async Task CanAccessTaskFiles_AllowsManager()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderA.UserId, world.EmployeeA.UserId, world.SalesDept.DeptId);

        var allowed = await TaskAccessPolicy.CanAccessTaskFilesAsync(db, task.TaskId, world.Manager.UserId, UserRole.Manager);

        allowed.Should().BeTrue();
    }

    [Fact]
    public async Task CanAccessTaskFiles_DeniesUnrelatedUser()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderA.UserId, world.EmployeeA.UserId, world.SalesDept.DeptId);

        var allowed = await TaskAccessPolicy.CanAccessTaskFilesAsync(db, task.TaskId, world.EmployeeB.UserId, UserRole.Employee);

        allowed.Should().BeFalse();
    }

    [Fact]
    public async Task CanAccessTaskFiles_DeniesUnrelatedTeamLeader()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        var task = AddTask(db, world.TeamLeaderA.UserId, world.EmployeeA.UserId, world.SalesDept.DeptId);

        var allowed = await TaskAccessPolicy.CanAccessTaskFilesAsync(db, task.TaskId, world.TeamLeaderB.UserId, UserRole.TeamLeader);

        allowed.Should().BeFalse();
    }

    [Fact]
    public async Task CanAccessTaskFiles_AllowsProjectTeamLeader()
    {
        using var db = TestDbContextFactory.Create();
        var world = SeedData.Seed(db);
        // Set up project where TL-B is a team-leader, then a task in that project assigned to anyone.
        var company = new Company { CompanyId = 1, Name = "Acme" };
        db.Companies.Add(company);
        var project = new Project { ProjectId = 1, Name = "P", CompanyId = company.CompanyId };
        db.Projects.Add(project);
        db.ProjectTeamLeaders.Add(new ProjectTeamLeader { ProjectId = project.ProjectId, UserId = world.TeamLeaderB.UserId });
        db.SaveChanges();

        var task = AddTask(db, world.TeamLeaderA.UserId, world.EmployeeA.UserId, world.SalesDept.DeptId, projectId: project.ProjectId);

        var allowed = await TaskAccessPolicy.CanAccessTaskFilesAsync(db, task.TaskId, world.TeamLeaderB.UserId, UserRole.TeamLeader);

        allowed.Should().BeTrue();
    }
}
