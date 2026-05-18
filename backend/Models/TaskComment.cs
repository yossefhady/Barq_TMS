using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BarqTMS.API.Models
{
    public class TaskComment
    {
        [Key]
        public int CommentId { get; set; }

        public int TaskId { get; set; }

        public int UserId { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsRejectionReason { get; set; }

        // Navigation Properties
        [ForeignKey("TaskId")]
        public virtual WorkTask Task { get; set; } = null!;

        [ForeignKey("UserId")]
        public virtual User Author { get; set; } = null!;
    }
}
