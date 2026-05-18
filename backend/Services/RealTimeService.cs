using BarqTMS.API.Models;
using Microsoft.Extensions.Logging;

namespace BarqTMS.API.Services
{
    public interface IRealTimeService
    {
        Task NotifyTaskAssigned(WorkTask task, string userId);
        Task NotifyTaskStatusChanged(WorkTask task, string oldStatus, string newStatus);
        Task NotifyTaskCommentAdded(TaskComment comment);
        Task NotifyTaskOverdue(WorkTask task);
    }

    public class RealTimeService : IRealTimeService
    {
        private readonly ILogger<RealTimeService> _logger;

        public RealTimeService(ILogger<RealTimeService> logger)
        {
            _logger = logger;
        }

        public Task NotifyTaskAssigned(WorkTask task, string userId)
        {
            _logger.LogInformation("Task {TaskId} assigned to user {UserId}", task.TaskId, userId);
            return Task.CompletedTask;
        }

        public Task NotifyTaskStatusChanged(WorkTask task, string oldStatus, string newStatus)
        {
            _logger.LogInformation("Task {TaskId} status changed from {Old} to {New}", task.TaskId, oldStatus, newStatus);
            return Task.CompletedTask;
        }

        public Task NotifyTaskCommentAdded(TaskComment comment)
        {
            _logger.LogInformation("Comment added to task {TaskId}", comment.TaskId);
            return Task.CompletedTask;
        }

        public Task NotifyTaskOverdue(WorkTask task)
        {
            _logger.LogInformation("Task {TaskId} is overdue", task.TaskId);
            return Task.CompletedTask;
        }
    }
}
