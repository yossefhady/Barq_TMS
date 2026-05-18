using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using BarqTMS.API.Models.Enums;

namespace BarqTMS.API.Models
{
    public class Project
    { 
        [Key]
        public int ProjectId { get; set; }

        public int CompanyId { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime? DueDate { get; set; }

        public ProjectStatus Status { get; set; }

        // Navigation Properties
        [ForeignKey("CompanyId")]
        public virtual Company Company { get; set; } = null!;

        public virtual ICollection<ProjectTeamLeader> TeamLeaders { get; set; } = new List<ProjectTeamLeader>();
        public virtual ICollection<ProjectDepartment> Departments { get; set; } = new List<ProjectDepartment>();
        public virtual ICollection<WorkTask> Tasks { get; set; } = new List<WorkTask>();
    }
}
