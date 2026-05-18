namespace BarqTMS.API.DTOs
{
    public class NotificationDto
    {
        public int NotifId { get; set; }
        public int UserId { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsRead { get; set; }
        public int? TaskId { get; set; }
        public string? TaskTitle { get; set; }
        public int? ProjectId { get; set; }
        public string? ProjectName { get; set; }
    }

    public class CreateNotificationDto
    {
        public int UserId { get; set; }
        public string Message { get; set; } = string.Empty;
        public int? TaskId { get; set; }
        public int? ProjectId { get; set; }
    }

    public class UpdateNotificationDto
    {
        public string Message { get; set; } = string.Empty;
        public bool IsRead { get; set; }
    }

    public class AttachmentDto
    {
        public int FileId { get; set; }
        public int TaskId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public int UploadedBy { get; set; }
        public string UploadedByName { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }
    }

    public class ProjectHistoryDto
    {
        public int HistoryId { get; set; }
        public int ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public DateTime ActionDate { get; set; }
    }

    public class TaskHistoryDto
    {
        public int HistoryId { get; set; }
        public int TaskId { get; set; }
        public string TaskTitle { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public DateTime ActionDate { get; set; }
    }

    public class ClientDto
    {
        public int ClientId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int ProjectCount { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Address { get; set; }
        public string? Country { get; set; }
        public int? AccountManagerId { get; set; }
        public string? AccountManagerName { get; set; }
        public int? OwnerUserId { get; set; }
        public string? OwnerName { get; set; }
    }
}