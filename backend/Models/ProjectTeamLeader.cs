using System.ComponentModel.DataAnnotations.Schema;

namespace BarqTMS.API.Models
{
    public class ProjectTeamLeader
    {
        public int ProjectId { get; set; }
        public int UserId { get; set; }

        [ForeignKey("ProjectId")]
        public virtual Project Project { get; set; } = null!;

        [ForeignKey("UserId")]
        public virtual User TeamLeader { get; set; } = null!;
    }
}
