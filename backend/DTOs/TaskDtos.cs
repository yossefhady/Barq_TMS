using System.ComponentModel.DataAnnotations;

namespace BarqTMS.API.DTOs
{
    public class TaskListDto
    {
        public int TaskId { get; set; }
        public string Title { get; set; } = string.Empty;
        public int PriorityId { get; set; }
        public string PriorityLevel { get; set; } = string.Empty;
        public int StatusId { get; set; }
        public string StatusName { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public TimeSpan? SpecificTime { get; set; }
        public decimal? EstimatedHours { get; set; }
        public string? Tags { get; set; }
        public int CreatedBy { get; set; }
        public string? CreatedByName { get; set; }
        public int? AssignedTo { get; set; }
        public string? AssignedToName { get; set; }
        public int? OriginalAssignerId { get; set; }
        public string? OriginalAssignerName { get; set; }
        public int? DelegatedBy { get; set; }
        public string? DelegatedByName { get; set; }
        public int? ProjectId { get; set; }
        public string? ProjectName { get; set; }
        public int CommentCount { get; set; }
        public int AttachmentCount { get; set; }
        public string DriveFolderLink { get; set; } = string.Empty;
        public string? MaterialDriveFolderLink { get; set; }

        public int DeptId { get; set; }
        public string DeptName { get; set; } = string.Empty;

        public int? SalesActivityType { get; set; }
        // public int? SalesOutcome { get; set; } // REMOVED
        public string? SalesClientInfo { get; set; }
        public int? SalesMarketSegmentId { get; set; }
        public decimal? FinalKpiValue { get; set; }
    }

    public class TaskDto
    {
        public int TaskId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int PriorityId { get; set; }
        public string PriorityLevel { get; set; } = string.Empty;
        public int StatusId { get; set; }
        public string StatusName { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public TimeSpan? SpecificTime { get; set; }
        public decimal? EstimatedHours { get; set; }
        public string? Tags { get; set; }
        public int CreatedBy { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public int? AssignedTo { get; set; }
        public string? AssignedToName { get; set; }
        public int? OriginalAssignerId { get; set; }
        public string? OriginalAssignerName { get; set; }
        public int? DelegatedBy { get; set; }
        public string? DelegatedByName { get; set; }
        public int DeptId { get; set; }
        public string DeptName { get; set; } = string.Empty;
        public int? ProjectId { get; set; }
        public string? ProjectName { get; set; }
        public int CommentCount { get; set; }
        public List<TaskCommentDto> Comments { get; set; } = new();
        public int AttachmentCount { get; set; }
        public string DriveFolderLink { get; set; } = string.Empty;
        public string? MaterialDriveFolderLink { get; set; }

        public int? SalesActivityType { get; set; }
        public string? SalesMandatoryNote { get; set; }
        public string? SalesClientInfo { get; set; }
        public int? SalesMarketSegmentId { get; set; }
        public string? SalesMarketSegmentPlace { get; set; }
        public decimal? FinalKpiValue { get; set; }
    }

    public class CreateTaskDto
    {
        [Required]
        [StringLength(200)]
        public string Title { get; set; } = string.Empty;
        
        [StringLength(1000)]
        public string? Description { get; set; }
        
        [Required]
        public int PriorityId { get; set; }
        
        [Required]
        public int StatusId { get; set; }
        
        public DateTime? DueDate { get; set; }

        public TimeSpan? SpecificTime { get; set; }
        public decimal? EstimatedHours { get; set; }
        public string? Tags { get; set; }
        
        public int? AssignedTo { get; set; }
        
        [Required]
        public int DeptId { get; set; }
        
        public int? ProjectId { get; set; }

        [Required]
        [StringLength(500)]
        public string DriveFolderLink { get; set; } = string.Empty;

        [StringLength(500)]
        public string? MaterialDriveFolderLink { get; set; }

        public int? SalesActivityType { get; set; }
        public string? SalesMandatoryNote { get; set; }
        public string? SalesClientInfo { get; set; }
        public int? SalesMarketSegmentId { get; set; }
        public decimal? FinalKpiValue { get; set; }
    }

    public class UpdateTaskDto
    {
        [Required]
        [StringLength(200)]
        public string Title { get; set; } = string.Empty;
        
        [StringLength(1000)]
        public string? Description { get; set; }
        
        public int PriorityId { get; set; }
        public int StatusId { get; set; }
        public DateTime? DueDate { get; set; }
        public TimeSpan? SpecificTime { get; set; }
        public decimal? EstimatedHours { get; set; }
        public string? Tags { get; set; }
        public int? AssignedTo { get; set; }
        public int DeptId { get; set; }
        public int? ProjectId { get; set; }

        [Required]
        [StringLength(500)]
        public string DriveFolderLink { get; set; } = string.Empty;

        [StringLength(500)]
        public string? MaterialDriveFolderLink { get; set; }

        public int? SalesActivityType { get; set; }
        public string? SalesMandatoryNote { get; set; }
        public string? SalesClientInfo { get; set; }
        public int? SalesMarketSegmentId { get; set; }
        public decimal? FinalKpiValue { get; set; }
    }

    public class TaskCommentDto
    {
        public int CommentId { get; set; }
        public int TaskId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class CreateTaskCommentDto
    {
        [Required]
        [StringLength(1000)]
        public string Comment { get; set; } = string.Empty;
    }

    public class UpdateTaskStatusDto
    {
        [Required]
        public int StatusId { get; set; }

        [StringLength(1000)]
        public string? Notes { get; set; }
        
        public decimal? FinalKpiValue { get; set; }
    }

    public class NotificationDetailsDto
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
        public List<TaskCommentDto> TaskNotes { get; set; } = new();
    }

    public class ReviewTaskCompletionDto
    {
        public bool Approve { get; set; }
        [StringLength(1000)]
        public string? Notes { get; set; }
        public DateTime? NewDueDate { get; set; }
        public decimal? FinalKpiValue { get; set; }
    }

    public class RequestCompleteDto
    {
        public string? Note { get; set; } 
        public decimal? FinalKpiValue { get; set; }
    }

    public class ExtendTaskDeadlineDto
    {
        [Required]
        public DateTime NewDueDate { get; set; }
        
        [Required]
        [StringLength(500)]
        public string Reason { get; set; } = string.Empty;
    }

    public class PassTaskDto
    {
        [Required]
        public int AssignToUserId { get; set; }
        
        [StringLength(1000)]
        public string? Notes { get; set; }
    }
}