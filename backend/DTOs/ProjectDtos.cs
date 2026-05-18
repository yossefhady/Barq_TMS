using System.ComponentModel.DataAnnotations;
using BarqTMS.API.Models.Enums;

namespace BarqTMS.API.DTOs
{
    public class ProjectDto
    {
        public int ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? ClientId { get; set; }
        public string? ClientName { get; set; }
        public int? TeamLeaderId { get; set; }
        public string? TeamLeaderName { get; set; }
        public List<int> TeamLeaderIds { get; set; } = new List<int>();
        public List<string> TeamLeaderNames { get; set; } = new List<string>();
        public List<DepartmentDto> Departments { get; set; } = new List<DepartmentDto>();
        public List<int> DepartmentIds { get; set; } = new List<int>();
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int TaskCount { get; set; }
        public ProjectStatus Status { get; set; }
        public int StatusId { get; set; }
        public string StatusName { get; set; } = string.Empty;
    }

    public class CreateProjectDto
    {
        [Required]
        [StringLength(200)]
        public string ProjectName { get; set; } = string.Empty;
        
        [StringLength(1000)]
        public string? Description { get; set; }
        
        public int? ClientId { get; set; }
        public int? TeamLeaderId { get; set; }
        public List<int> TeamLeaderIds { get; set; } = new List<int>();
        public List<int> DepartmentIds { get; set; } = new List<int>();
        
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }

    public class UpdateProjectDto
    {
        [Required]
        [StringLength(200)]
        public string ProjectName { get; set; } = string.Empty;
        
        [StringLength(1000)]
        public string? Description { get; set; }
        
        public int? ClientId { get; set; }
        public int? TeamLeaderId { get; set; }
        public List<int> TeamLeaderIds { get; set; } = new List<int>();
        public List<int> DepartmentIds { get; set; } = new List<int>();
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public ProjectStatus? Status { get; set; }
    }
}