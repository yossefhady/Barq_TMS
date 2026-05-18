using BarqTMS.API.Data;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Services
{
    public class OverdueTaskNotificationService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OverdueTaskNotificationService> _logger;
        private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(1);

        public OverdueTaskNotificationService(IServiceScopeFactory scopeFactory, ILogger<OverdueTaskNotificationService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckOverdueTasks(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error checking overdue tasks");
                }

                await Task.Delay(CheckInterval, stoppingToken);
            }
        }

        private async Task CheckOverdueTasks(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<BarqTMSDbContext>();

            var now = DateTime.UtcNow;

            // Find tasks that are overdue (past due date, not completed/closed)
            var overdueTasks = await context.Tasks
                .Include(t => t.Assignees)
                .Where(t => t.DueDate.HasValue
                    && t.DueDate.Value < now
                    && t.Status != Models.Enums.TaskStatus.Completed
                    && t.Status != Models.Enums.TaskStatus.Closed)
                .ToListAsync(ct);

            if (overdueTasks.Count == 0) return;

            // Get IDs of tasks that already have a DeadlineApproaching notification in the last 24h
            var oneDayAgo = now.AddHours(-24);
            var recentlyNotifiedTaskIds = await context.Notifications
                .Where(n => n.Type == NotificationType.DeadlineApproaching
                    && n.CreatedAt > oneDayAgo
                    && n.RelatedEntityType == RelatedEntityType.Task)
                .Select(n => n.RelatedEntityId)
                .Distinct()
                .ToListAsync(ct);

            var tasksToNotify = overdueTasks
                .Where(t => !recentlyNotifiedTaskIds.Contains(t.TaskId))
                .ToList();

            foreach (var task in tasksToNotify)
            {
                // Notify each assignee
                foreach (var assignee in task.Assignees)
                {
                    context.Notifications.Add(new Notification
                    {
                        UserId = assignee.UserId,
                        Title = task.Title,
                        Message = $"Task \"{task.Title}\" is overdue (was due {task.DueDate:MMM dd, yyyy})",
                        Type = NotificationType.DeadlineApproaching,
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow,
                        RelatedEntityId = task.TaskId,
                        RelatedEntityType = RelatedEntityType.Task,
                    });
                }

                // Also notify the task creator
                if (task.OriginalAssignerId.HasValue &&
                    !task.Assignees.Any(a => a.UserId == task.OriginalAssignerId.Value))
                {
                    context.Notifications.Add(new Notification
                    {
                        UserId = task.OriginalAssignerId.Value,
                        Title = task.Title,
                        Message = $"Task \"{task.Title}\" is overdue (was due {task.DueDate:MMM dd, yyyy})",
                        Type = NotificationType.DeadlineApproaching,
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow,
                        RelatedEntityId = task.TaskId,
                        RelatedEntityType = RelatedEntityType.Task,
                    });
                }
            }

            if (tasksToNotify.Count > 0)
            {
                await context.SaveChangesAsync(ct);
                _logger.LogInformation("Sent overdue notifications for {Count} tasks", tasksToNotify.Count);
            }
        }
    }
}
