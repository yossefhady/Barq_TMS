using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BarqTMS.API.Models
{
    public class AuditLog
    {
        [Key]
        public int LogId { get; set; }

        public int UserId { get; set; }

        [Required]
        [StringLength(50)]
        public string Action { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string EntityName { get; set; } = string.Empty;

        public int EntityId { get; set; }

        public string? OldValues { get; set; }

        public string? NewValues { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("UserId")]
        public virtual User User { get; set; } = null!;
    }
}
