using BarqTMS.API.Data;
using BarqTMS.API.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Services
{
    // CRIT-06: Centralized "can this user access this task's files/details" policy.
    public static class TaskAccessPolicy
    {
        public static async Task<bool> CanAccessTaskFilesAsync(BarqTMSDbContext db, int taskId, int userId, UserRole role)
        {
            // Manager / AssistantManager can always access.
            if (role == UserRole.Manager || role == UserRole.AssistantManager)
            {
                return true;
            }

            var task = await db.Tasks
                .Include(t => t.Assignees)
                .FirstOrDefaultAsync(t => t.TaskId == taskId);

            if (task == null) return false;

            // Original assigner or current delegator.
            if (task.OriginalAssignerId == userId || task.DelegatedBy == userId) return true;

            // Current assignee.
            if (task.Assignees.Any(a => a.UserId == userId)) return true;

            // Project team-leader.
            if (task.ProjectId.HasValue)
            {
                var isProjectTeamLeader = await db.ProjectTeamLeaders
                    .AnyAsync(ptl => ptl.ProjectId == task.ProjectId.Value && ptl.UserId == userId);
                if (isProjectTeamLeader) return true;
            }

            // Supervisor of any current assignee (lets a TL see their subordinates' task files).
            var assigneeIds = task.Assignees.Select(a => a.UserId).ToList();
            if (assigneeIds.Count > 0)
            {
                var isSupervisorOfAssignee = await db.Users
                    .AnyAsync(u => assigneeIds.Contains(u.UserId) && u.SupervisorId == userId);
                if (isSupervisorOfAssignee) return true;
            }

            return false;
        }
    }
}
