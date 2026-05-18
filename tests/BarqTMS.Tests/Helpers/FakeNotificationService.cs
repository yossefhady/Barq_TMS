using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using TaskStatus = BarqTMS.API.Models.Enums.TaskStatus;

namespace BarqTMS.Tests.Helpers;

internal sealed class FakeNotificationService : INotificationService
{
    public Task CreateAsync(int userId, string title, string message, NotificationType type,
        int? relatedEntityId = null, RelatedEntityType? relatedEntityType = null) => Task.CompletedTask;

    public Task NotifyTaskAssignedAsync(WorkTask task, int assigneeId, int assignedByUserId) => Task.CompletedTask;
    public Task NotifyTaskStatusChangedAsync(WorkTask task, TaskStatus oldStatus, TaskStatus newStatus, int changedByUserId) => Task.CompletedTask;
    public Task NotifyTaskCommentAsync(int taskId, int commentByUserId) => Task.CompletedTask;
    public Task NotifyTaskCompletionRequestedAsync(WorkTask task, int requestedByUserId) => Task.CompletedTask;
    public Task NotifyTaskReviewedAsync(WorkTask task, bool approved, int reviewedByUserId) => Task.CompletedTask;
}
