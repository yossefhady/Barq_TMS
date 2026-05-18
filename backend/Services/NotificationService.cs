using BarqTMS.API.Data;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Services
{
    public interface INotificationService
    {
        Task CreateAsync(int userId, string title, string message, NotificationType type,
            int? relatedEntityId = null, RelatedEntityType? relatedEntityType = null);
        Task NotifyTaskAssignedAsync(WorkTask task, int assigneeId, int assignedByUserId);
        Task NotifyTaskStatusChangedAsync(WorkTask task, Models.Enums.TaskStatus oldStatus, Models.Enums.TaskStatus newStatus, int changedByUserId);
        Task NotifyTaskCommentAsync(int taskId, int commentByUserId);
        Task NotifyTaskCompletionRequestedAsync(WorkTask task, int requestedByUserId);
        Task NotifyTaskReviewedAsync(WorkTask task, bool approved, int reviewedByUserId);
    }

    public class NotificationService : INotificationService
    {
        private readonly BarqTMSDbContext _context;

        public NotificationService(BarqTMSDbContext context)
        {
            _context = context;
        }

        public async Task CreateAsync(int userId, string title, string message, NotificationType type,
            int? relatedEntityId = null, RelatedEntityType? relatedEntityType = null)
        {
            _context.Notifications.Add(new Notification
            {
                UserId = userId,
                Title = title.Length > 100 ? title[..100] : title,
                Message = message.Length > 500 ? message[..500] : message,
                Type = type,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                RelatedEntityId = relatedEntityId,
                RelatedEntityType = relatedEntityType,
            });
            await _context.SaveChangesAsync();
        }

        public async Task NotifyTaskAssignedAsync(WorkTask task, int assigneeId, int assignedByUserId)
        {
            if (assigneeId == assignedByUserId) return;

            var assigner = await _context.Users.FindAsync(assignedByUserId);
            var assignerName = assigner?.FullName ?? "Someone";

            await CreateAsync(
                assigneeId,
                task.Title,
                $"{assignerName} assigned you a new task: {task.Title}",
                NotificationType.TaskAssigned,
                task.TaskId,
                RelatedEntityType.Task
            );
        }

        public async Task NotifyTaskStatusChangedAsync(WorkTask task, Models.Enums.TaskStatus oldStatus, Models.Enums.TaskStatus newStatus, int changedByUserId)
        {
            // Notify all assignees except the person who changed the status
            var assigneeIds = await _context.TaskAssignees
                .Where(ta => ta.TaskId == task.TaskId && ta.UserId != changedByUserId)
                .Select(ta => ta.UserId)
                .ToListAsync();

            // Also notify the task creator/original assigner
            if (task.OriginalAssignerId.HasValue &&
                task.OriginalAssignerId.Value != changedByUserId &&
                !assigneeIds.Contains(task.OriginalAssignerId.Value))
            {
                assigneeIds.Add(task.OriginalAssignerId.Value);
            }

            var changer = await _context.Users.FindAsync(changedByUserId);
            var changerName = changer?.FullName ?? "Someone";

            foreach (var userId in assigneeIds)
            {
                await CreateAsync(
                    userId,
                    task.Title,
                    $"{changerName} changed task \"{task.Title}\" status from {oldStatus} to {newStatus}",
                    NotificationType.General,
                    task.TaskId,
                    RelatedEntityType.Task
                );
            }
        }

        public async Task NotifyTaskCommentAsync(int taskId, int commentByUserId)
        {
            var task = await _context.Tasks
                .Include(t => t.Assignees)
                .FirstOrDefaultAsync(t => t.TaskId == taskId);
            if (task == null) return;

            var commenter = await _context.Users.FindAsync(commentByUserId);
            var commenterName = commenter?.FullName ?? "Someone";

            // Notify all assignees + creator, except comment author
            var notifyIds = task.Assignees
                .Select(a => a.UserId)
                .Where(id => id != commentByUserId)
                .ToList();

            if (task.OriginalAssignerId.HasValue &&
                task.OriginalAssignerId.Value != commentByUserId &&
                !notifyIds.Contains(task.OriginalAssignerId.Value))
            {
                notifyIds.Add(task.OriginalAssignerId.Value);
            }

            foreach (var userId in notifyIds)
            {
                await CreateAsync(
                    userId,
                    task.Title,
                    $"{commenterName} commented on task \"{task.Title}\"",
                    NotificationType.General,
                    task.TaskId,
                    RelatedEntityType.Task
                );
            }
        }

        public async Task NotifyTaskCompletionRequestedAsync(WorkTask task, int requestedByUserId)
        {
            var requester = await _context.Users.FindAsync(requestedByUserId);
            var requesterName = requester?.FullName ?? "Someone";

            // Notify the task creator/supervisor that completion is requested
            if (task.OriginalAssignerId.HasValue && task.OriginalAssignerId.Value != requestedByUserId)
            {
                await CreateAsync(
                    task.OriginalAssignerId.Value,
                    task.Title,
                    $"{requesterName} submitted task \"{task.Title}\" for review",
                    NotificationType.General,
                    task.TaskId,
                    RelatedEntityType.Task
                );
            }

            // Also notify the requester's supervisor
            var requesterUser = await _context.Users.FindAsync(requestedByUserId);
            if (requesterUser?.SupervisorId != null &&
                requesterUser.SupervisorId != task.OriginalAssignerId &&
                requesterUser.SupervisorId != requestedByUserId)
            {
                await CreateAsync(
                    requesterUser.SupervisorId.Value,
                    task.Title,
                    $"{requesterName} submitted task \"{task.Title}\" for review",
                    NotificationType.General,
                    task.TaskId,
                    RelatedEntityType.Task
                );
            }
        }

        public async Task NotifyTaskReviewedAsync(WorkTask task, bool approved, int reviewedByUserId)
        {
            var reviewer = await _context.Users.FindAsync(reviewedByUserId);
            var reviewerName = reviewer?.FullName ?? "Someone";
            var action = approved ? "approved" : "rejected";
            var type = approved ? NotificationType.TaskCompleted : NotificationType.TaskRejected;

            // Notify all assignees
            var assigneeIds = await _context.TaskAssignees
                .Where(ta => ta.TaskId == task.TaskId && ta.UserId != reviewedByUserId)
                .Select(ta => ta.UserId)
                .ToListAsync();

            foreach (var userId in assigneeIds)
            {
                await CreateAsync(
                    userId,
                    task.Title,
                    $"{reviewerName} {action} task \"{task.Title}\"",
                    type,
                    task.TaskId,
                    RelatedEntityType.Task
                );
            }
        }
    }
}
