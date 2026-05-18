using System.ComponentModel.DataAnnotations;
using BarqTMS.API.Models.Enums;

namespace BarqTMS.API.Models
{
    public class Department
    {
        [Key]
        public int DeptId { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        // HIGH-04: System-stable identity used by business-rule branches (sales validation,
        // marketing dashboards, etc.). Defaults to Other for legacy rows.
        public DepartmentType Type { get; set; } = DepartmentType.Other;

        // Navigation Properties
        public virtual ICollection<User> Users { get; set; } = new List<User>();
        public virtual ICollection<ProjectDepartment> ProjectDepartments { get; set; } = new List<ProjectDepartment>();
        public virtual ICollection<WorkTask> Tasks { get; set; } = new List<WorkTask>();
    }
}
