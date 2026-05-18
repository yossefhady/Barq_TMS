using BarqTMS.API.Models.Enums;

namespace BarqTMS.API.DTOs
{
    public class CalendarEventDto
    {
        public int EventId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public EventType EventType { get; set; }
        public int CreatedBy { get; set; }
        public int? RelatedProjectId { get; set; }
        public int? RelatedTaskId { get; set; }
        public int? RelatedCompanyId { get; set; }
        public List<int> AttendeeIds { get; set; } = new List<int>();
    }

    public class CreateCalendarEventDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public EventType EventType { get; set; }
        public int? RelatedProjectId { get; set; }
        public int? RelatedTaskId { get; set; }
        public int? RelatedCompanyId { get; set; }
        public List<int> AttendeeIds { get; set; } = new List<int>();
    }

    public class UpdateCalendarEventDto
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public EventType? EventType { get; set; }
        public int? RelatedProjectId { get; set; }
        public int? RelatedTaskId { get; set; }
        public int? RelatedCompanyId { get; set; }
        public List<int>? AttendeeIds { get; set; }
    }

    public class CalendarFilterDto
    {
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? TargetUserId { get; set; }
    }

    public class CalendarViewDto
    {
        public List<CalendarEventDto> Events { get; set; } = new List<CalendarEventDto>();
    }

    public class CalendarStatsDto
    {
        public int TotalEvents { get; set; }
    }

    public class UpdateAttendeeStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }
}
