using System.ComponentModel.DataAnnotations;

namespace BarqTMS.API.DTOs
{
    public class DepartmentDto
    {
        public int DeptId { get; set; }
        public string DeptName { get; set; } = string.Empty;
        public int UserCount { get; set; }
        public int TaskCount { get; set; }
    }

    public class CreateDepartmentDto
    {
        [Required]
        [StringLength(100)]
        public string DeptName { get; set; } = string.Empty;
    }

    public class UpdateDepartmentDto
    {
        [Required]
        [StringLength(100)]
        public string DeptName { get; set; } = string.Empty;
    }
}