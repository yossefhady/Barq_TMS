using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using BarqTMS.API.Models.Enums;
using System.Text.Json.Serialization;

namespace BarqTMS.API.Models
{
    public class User
    {
        [Key]
        public int UserId { get; set; }

        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [JsonIgnore]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(100)]
        public string Email { get; set; } = string.Empty;

        [StringLength(20)]
        public string? Phone { get; set; }

        [StringLength(20)]
        public string? SecondaryPhone { get; set; }

        [StringLength(100)]
        public string? Position { get; set; }

        [StringLength(200)]
        public string? Address { get; set; }

        [StringLength(50)]
        public string? Country { get; set; }

        [Required]
        public UserRole Role { get; set; }

        public int? DepartmentId { get; set; }

        public int? SupervisorId { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("DepartmentId")]
        public virtual Department? Department { get; set; }

        [ForeignKey("SupervisorId")]
        public virtual User? Supervisor { get; set; }

        public virtual ICollection<User> Subordinates { get; set; } = new List<User>();

        // Companies owned by this user (if Client)
        [InverseProperty("Owner")]
        public virtual ICollection<Company> OwnedCompanies { get; set; } = new List<Company>();

        // Companies managed by this user (if AccountManager)
        [InverseProperty("AccountManager")]
        public virtual ICollection<Company> ManagedCompanies { get; set; } = new List<Company>();

        // Many-to-Many Relationships
        public virtual ICollection<ProjectTeamLeader> LedProjects { get; set; } = new List<ProjectTeamLeader>();
        public virtual ICollection<TaskAssignee> AssignedTasks { get; set; } = new List<TaskAssignee>();
        public virtual ICollection<EventAttendee> EventInvitations { get; set; } = new List<EventAttendee>();
    }
}
