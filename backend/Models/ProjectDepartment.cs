using System.ComponentModel.DataAnnotations.Schema;

namespace BarqTMS.API.Models
{
    public class ProjectDepartment
    {
        public int ProjectId { get; set; }
        public int DeptId { get; set; }

        [ForeignKey("ProjectId")]
        public virtual Project Project { get; set; } = null!;

        [ForeignKey("DeptId")]
        public virtual Department Department { get; set; } = null!;
    }
}
