using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BarqTMS.API.Models
{
    public class TimeLog
    {
        [Key]
        public int LogId { get; set; }

        public int TaskId { get; set; }

        public int UserId { get; set; }

        public DateTime StartTime { get; set; }

        public DateTime? EndTime { get; set; }

        public double? DurationMinutes { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        // Navigation Properties
        [ForeignKey("TaskId")]
        public virtual WorkTask Task { get; set; } = null!;

        [ForeignKey("UserId")]
        public virtual User User { get; set; } = null!;
    }
}
