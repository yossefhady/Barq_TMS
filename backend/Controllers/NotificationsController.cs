using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using System.Security.Claims;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly BarqTMSDbContext _context;

        public NotificationsController(BarqTMSDbContext context)
        {
            _context = context;
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        }

        // GET /api/Notifications/user/{userId}
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetByUser(int userId)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId != userId)
            {
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (role != nameof(UserRole.Manager) && role != nameof(UserRole.AssistantManager))
                    return Forbid();
            }

            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(100)
                .ToListAsync();

            var dtos = await MapToDtos(notifications);
            return Ok(dtos);
        }

        // GET /api/Notifications/user/{userId}/unread
        [HttpGet("user/{userId}/unread")]
        public async Task<IActionResult> GetUnread(int userId)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId != userId)
            {
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (role != nameof(UserRole.Manager) && role != nameof(UserRole.AssistantManager))
                    return Forbid();
            }

            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .OrderByDescending(n => n.CreatedAt)
                .Take(50)
                .ToListAsync();

            var dtos = await MapToDtos(notifications);
            return Ok(dtos);
        }

        // GET /api/Notifications/user/{userId}/count/unread
        [HttpGet("user/{userId}/count/unread")]
        public async Task<IActionResult> GetUnreadCount(int userId)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId != userId)
            {
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (role != nameof(UserRole.Manager) && role != nameof(UserRole.AssistantManager))
                    return Forbid();
            }

            var count = await _context.Notifications
                .CountAsync(n => n.UserId == userId && !n.IsRead);

            return Ok(new { Count = count });
        }

        // GET /api/Notifications/{notifId}/details
        [HttpGet("{notifId}/details")]
        public async Task<IActionResult> GetDetails(int notifId)
        {
            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.NotificationId == notifId);

            if (notification == null) return NotFound();

            var currentUserId = GetCurrentUserId();
            if (notification.UserId != currentUserId)
            {
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (role != nameof(UserRole.Manager) && role != nameof(UserRole.AssistantManager))
                    return Forbid();
            }

            var dto = new NotificationDetailsDto
            {
                NotifId = notification.NotificationId,
                UserId = notification.UserId,
                Message = notification.Message,
                CreatedAt = notification.CreatedAt,
                IsRead = notification.IsRead,
            };

            // Resolve related task info
            if (notification.RelatedEntityType == RelatedEntityType.Task && notification.RelatedEntityId.HasValue)
            {
                var task = await _context.Tasks
                    .Include(t => t.Project)
                    .Include(t => t.Comments).ThenInclude(c => c.Author)
                    .FirstOrDefaultAsync(t => t.TaskId == notification.RelatedEntityId.Value);

                if (task != null)
                {
                    dto.TaskId = task.TaskId;
                    dto.TaskTitle = task.Title;
                    dto.ProjectId = task.ProjectId;
                    dto.ProjectName = task.Project?.Name;
                    dto.TaskNotes = task.Comments
                        .OrderByDescending(c => c.CreatedAt)
                        .Take(10)
                        .Select(c => new TaskCommentDto
                        {
                            CommentId = c.CommentId,
                            TaskId = c.TaskId,
                            UserId = c.UserId,
                            UserName = c.Author?.FullName ?? "Unknown",
                            Comment = c.Content,
                            CreatedAt = c.CreatedAt
                        }).ToList();
                }
            }
            else if (notification.RelatedEntityType == RelatedEntityType.Project && notification.RelatedEntityId.HasValue)
            {
                var project = await _context.Projects
                    .FirstOrDefaultAsync(p => p.ProjectId == notification.RelatedEntityId.Value);
                if (project != null)
                {
                    dto.ProjectId = project.ProjectId;
                    dto.ProjectName = project.Name;
                }
            }

            // Mark as read on view
            if (!notification.IsRead)
            {
                notification.IsRead = true;
                await _context.SaveChangesAsync();
            }

            return Ok(dto);
        }

        // PUT /api/Notifications/{notifId}/read
        [HttpPut("{notifId}/read")]
        public async Task<IActionResult> MarkAsRead(int notifId)
        {
            var notification = await _context.Notifications.FindAsync(notifId);
            if (notification == null) return NotFound();

            var currentUserId = GetCurrentUserId();
            if (notification.UserId != currentUserId) return Forbid();

            notification.IsRead = true;
            await _context.SaveChangesAsync();
            return Ok();
        }

        // PUT /api/Notifications/user/{userId}/read-all
        [HttpPut("user/{userId}/read-all")]
        public async Task<IActionResult> MarkAllAsRead(int userId)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId != userId) return Forbid();

            var unread = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            foreach (var n in unread)
                n.IsRead = true;

            await _context.SaveChangesAsync();
            return Ok();
        }

        // DELETE /api/Notifications/{notifId}
        [HttpDelete("{notifId}")]
        public async Task<IActionResult> Delete(int notifId)
        {
            var notification = await _context.Notifications.FindAsync(notifId);
            if (notification == null) return NotFound();

            var currentUserId = GetCurrentUserId();
            if (notification.UserId != currentUserId) return Forbid();

            _context.Notifications.Remove(notification);
            await _context.SaveChangesAsync();
            return Ok();
        }

        // POST /api/Notifications
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateNotificationDto dto)
        {
            var notification = new Notification
            {
                UserId = dto.UserId,
                Title = "Notification",
                Message = dto.Message,
                Type = NotificationType.General,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            };

            if (dto.TaskId.HasValue)
            {
                notification.RelatedEntityId = dto.TaskId.Value;
                notification.RelatedEntityType = RelatedEntityType.Task;
                notification.Type = NotificationType.TaskAssigned;

                var task = await _context.Tasks.FindAsync(dto.TaskId.Value);
                if (task != null)
                    notification.Title = task.Title;
            }
            else if (dto.ProjectId.HasValue)
            {
                notification.RelatedEntityId = dto.ProjectId.Value;
                notification.RelatedEntityType = RelatedEntityType.Project;
            }

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            return Ok(new NotificationDto
            {
                NotifId = notification.NotificationId,
                UserId = notification.UserId,
                Message = notification.Message,
                CreatedAt = notification.CreatedAt,
                IsRead = notification.IsRead,
                TaskId = dto.TaskId,
                ProjectId = dto.ProjectId,
            });
        }

        // Helper: map Notification entities to DTOs with task/project info
        private async Task<List<NotificationDto>> MapToDtos(List<Notification> notifications)
        {
            // Collect related entity IDs to batch-load
            var taskIds = notifications
                .Where(n => n.RelatedEntityType == RelatedEntityType.Task && n.RelatedEntityId.HasValue)
                .Select(n => n.RelatedEntityId!.Value)
                .Distinct().ToList();

            var projectIds = notifications
                .Where(n => n.RelatedEntityType == RelatedEntityType.Project && n.RelatedEntityId.HasValue)
                .Select(n => n.RelatedEntityId!.Value)
                .Distinct().ToList();

            var tasks = taskIds.Count > 0
                ? await _context.Tasks.Where(t => taskIds.Contains(t.TaskId))
                    .Select(t => new { t.TaskId, t.Title, t.ProjectId }).ToListAsync()
                : new();

            var allProjectIds = projectIds
                .Union(tasks.Where(t => t.ProjectId.HasValue).Select(t => t.ProjectId!.Value))
                .Distinct().ToList();

            var projects = allProjectIds.Count > 0
                ? await _context.Projects.Where(p => allProjectIds.Contains(p.ProjectId))
                    .Select(p => new { p.ProjectId, p.Name }).ToListAsync()
                : new();

            return notifications.Select(n =>
            {
                var dto = new NotificationDto
                {
                    NotifId = n.NotificationId,
                    UserId = n.UserId,
                    Message = n.Message,
                    CreatedAt = n.CreatedAt,
                    IsRead = n.IsRead,
                };

                if (n.RelatedEntityType == RelatedEntityType.Task && n.RelatedEntityId.HasValue)
                {
                    var task = tasks.FirstOrDefault(t => t.TaskId == n.RelatedEntityId.Value);
                    if (task != null)
                    {
                        dto.TaskId = task.TaskId;
                        dto.TaskTitle = task.Title;
                        dto.ProjectId = task.ProjectId;
                        dto.ProjectName = projects.FirstOrDefault(p => p.ProjectId == task.ProjectId)?.Name;
                    }
                }
                else if (n.RelatedEntityType == RelatedEntityType.Project && n.RelatedEntityId.HasValue)
                {
                    var project = projects.FirstOrDefault(p => p.ProjectId == n.RelatedEntityId.Value);
                    if (project != null)
                    {
                        dto.ProjectId = project.ProjectId;
                        dto.ProjectName = project.Name;
                    }
                }

                return dto;
            }).ToList();
        }
    }
}
