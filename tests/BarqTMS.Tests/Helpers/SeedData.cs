using BarqTMS.API.Data;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Helpers;

internal sealed record SeededWorld(
    User Manager,
    User AssistantManager,
    User TeamLeaderA,
    User TeamLeaderB,
    User EmployeeA,
    User EmployeeB,
    Department SalesDept);

internal static class SeedData
{
    public static SeededWorld Seed(BarqTMSDbContext db)
    {
        var salesDept = new Department { DeptId = 1, Name = "Sales", Type = DepartmentType.Sales };
        var creativeDept = new Department { DeptId = 2, Name = "Creative", Type = DepartmentType.Creative };
        db.Departments.AddRange(salesDept, creativeDept);

        var manager = new User { UserId = 1, Username = "mgr", FullName = "Manager", Email = "m@x.com", PasswordHash = "x", Role = UserRole.Manager };
        var asstMgr = new User { UserId = 2, Username = "amgr", FullName = "Asst Manager", Email = "a@x.com", PasswordHash = "x", Role = UserRole.AssistantManager };
        var tlA = new User { UserId = 3, Username = "tlA", FullName = "TL A", Email = "tla@x.com", PasswordHash = "x", Role = UserRole.TeamLeader, DepartmentId = salesDept.DeptId };
        var tlB = new User { UserId = 4, Username = "tlB", FullName = "TL B", Email = "tlb@x.com", PasswordHash = "x", Role = UserRole.TeamLeader, DepartmentId = creativeDept.DeptId };
        var empA = new User { UserId = 5, Username = "empA", FullName = "Emp A", Email = "ea@x.com", PasswordHash = "x", Role = UserRole.Employee, DepartmentId = salesDept.DeptId, SupervisorId = tlA.UserId };
        var empB = new User { UserId = 6, Username = "empB", FullName = "Emp B", Email = "eb@x.com", PasswordHash = "x", Role = UserRole.Employee, DepartmentId = creativeDept.DeptId, SupervisorId = tlB.UserId };

        db.Users.AddRange(manager, asstMgr, tlA, tlB, empA, empB);
        db.SaveChanges();

        return new SeededWorld(manager, asstMgr, tlA, tlB, empA, empB, salesDept);
    }

    public static WorkTask AddTaskInReview(BarqTMSDbContext db, int assignerId, int assigneeId, int deptId, int? delegatedBy = null)
    {
        var task = new WorkTask
        {
            Title = "Test Task",
            Description = "A test task",
            DriveFolderLink = "https://drive/x",
            DepartmentId = deptId,
            Status = TaskStatus.InReview,
            Priority = TaskPriority.Medium,
            OriginalAssignerId = assignerId,
            DelegatedBy = delegatedBy,
            CreatedBy = assignerId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Tasks.Add(task);
        db.SaveChanges();

        db.TaskAssignees.Add(new TaskAssignee { TaskId = task.TaskId, UserId = assigneeId });
        db.SaveChanges();

        return task;
    }
}
