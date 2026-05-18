using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using BarqTMS.API.Models.Enums;

namespace BarqTMS.API.Models
{
    public class CalendarEvent
    {
        [Key]
        public int EventId { get; set; }

        [Required]
        [StringLength(100)]
        public string Title { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        public DateTime StartTime { get; set; }

        public DateTime EndTime { get; set; }

        public EventType EventType { get; set; }

        public int CreatedBy { get; set; }

        public int? RelatedProjectId { get; set; }

        public int? RelatedTaskId { get; set; }

        public int? RelatedCompanyId { get; set; }

        // Navigation Properties
        [ForeignKey("CreatedBy")]
        public virtual User Creator { get; set; } = null!;

        [ForeignKey("RelatedProjectId")]
        public virtual Project? RelatedProject { get; set; }

        [ForeignKey("RelatedTaskId")]
        public virtual WorkTask? RelatedTask { get; set; }

        [ForeignKey("RelatedCompanyId")]
        public virtual Company? RelatedCompany { get; set; }

        public virtual ICollection<EventAttendee> Attendees { get; set; } = new List<EventAttendee>();
    }
}
