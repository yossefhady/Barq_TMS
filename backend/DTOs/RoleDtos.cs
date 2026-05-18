using System.ComponentModel.DataAnnotations;

namespace BarqTMS.API.DTOs
{
    public class RoleDto
    {
        public int RoleId { get; set; }
        public string RoleName { get; set; } = string.Empty;
    }

    public class CreateRoleDto
    {
        [Required]
        [StringLength(50)]
        public string RoleName { get; set; } = string.Empty;
    }
}