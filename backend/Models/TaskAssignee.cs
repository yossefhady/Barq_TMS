using System.ComponentModel.DataAnnotations.Schema;

namespace BarqTMS.API.Models
{
    public class TaskAssignee
    {
        public int TaskId { get; set; }
        public int UserId { get; set; }

        [ForeignKey("TaskId")]
        public virtual WorkTask Task { get; set; } = null!;

        [ForeignKey("UserId")]
        public virtual User User { get; set; } = null!;
    }
}
