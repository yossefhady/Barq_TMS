using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BarqTMS.API.Models
{
    public class Company
    {
        [Key]
        public int CompanyId { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [StringLength(50)]
        public string? Type { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        [EmailAddress]
        [StringLength(100)]
        public string? Email { get; set; }

        [StringLength(20)]
        public string? Phone { get; set; }

        [StringLength(200)]
        public string? Address { get; set; }

        [StringLength(50)]
        public string? Country { get; set; }

        public int OwnerUserId { get; set; }

        public int? AccountManagerId { get; set; }

        // Navigation Properties
        [ForeignKey("OwnerUserId")]
        public virtual User Owner { get; set; } = null!;

        [ForeignKey("AccountManagerId")]
        public virtual User? AccountManager { get; set; }

        public virtual ICollection<Project> Projects { get; set; } = new List<Project>();
    }
}
