using System.ComponentModel.DataAnnotations;

namespace BarqTMS.API.DTOs
{
    public class CreateClientDto
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(100)]
        public string Email { get; set; } = string.Empty;

        [StringLength(50)]
        public string? Username { get; set; }

        [StringLength(100, MinimumLength = 6)]
        public string? Password { get; set; }

        [StringLength(100)]
        public string? OwnerName { get; set; }

        [StringLength(20)]
        public string? PhoneNumber { get; set; }

        [StringLength(200)]
        public string? Address { get; set; }

        [StringLength(50)]
        public string? Country { get; set; }

        public int? AccountManagerId { get; set; }
        
        public int? OwnerUserId { get; set; }
    }

    public class UpdateClientDto
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(100)]
        public string Email { get; set; } = string.Empty;

        [StringLength(20)]
        public string? PhoneNumber { get; set; }

        [StringLength(200)]
        public string? Address { get; set; }

        [StringLength(50)]
        public string? Country { get; set; }

        public int? AccountManagerId { get; set; }
    }
}
