using System.ComponentModel.DataAnnotations;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;

namespace BarqTMS.API.DTOs
{
    public class LoginDto
    {
        [Required]
        public string UserName { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;
        
        public bool RememberMe { get; set; } = false;
    }

    public class LoginResponseDto
    {
        public UserDto User { get; set; } = new UserDto();
        public string Token { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public int ExpiresIn { get; set; }
    }

    public class RegisterDto
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string UserName { get; set; } = string.Empty;

        [EmailAddress]
        [StringLength(255)]
        public string? Email { get; set; }

        [Required]
        [MinLength(6)]
        [StringLength(255)]
        public string Password { get; set; } = string.Empty;
        
        [Required]
        [Compare("Password")]
        public string ConfirmPassword { get; set; } = string.Empty;
        
        [Required]
        public UserRole Role { get; set; }
        public List<int> DepartmentIds { get; set; } = new List<int>();
    }

    public class RefreshTokenDto
    {
        [Required]
        public string RefreshToken { get; set; } = string.Empty;
    }

    public class ChangePasswordDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;
        
        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
        
        [Required]
        [Compare("NewPassword")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    public class ForgotPasswordDto
    {
        [Required]
        public string UserName { get; set; } = string.Empty;
    }

    public class ResetPasswordDto
    {
        [Required]
        public string Token { get; set; } = string.Empty;
        
        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
        
        [Required]
        [Compare("NewPassword")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    public class ValidateTokenDto
    {
        [Required]
        public string Token { get; set; } = string.Empty;
    }
}