using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using BCrypt.Net;

namespace BarqTMS.API.Services
{
    public class AuthService
    {
        private readonly BarqTMSDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthService(BarqTMSDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task<LoginResponseDto?> LoginAsync(LoginDto loginDto)
        {
            var user = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Username == loginDto.UserName);

            if (user == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash))
            {
                return null;
            }

            var token = GenerateJwtToken(user);

            return new LoginResponseDto
            {
                Token = token,
                User = new UserDto
                {
                    UserId = user.UserId,
                    Name = user.FullName,
                    Username = user.Username,
                    Email = user.Email,
                    Role = user.Role,
                    RoleName = user.Role.ToString(),
                    Departments = user.Department != null ? new List<DepartmentDto> { new DepartmentDto { DeptId = user.Department.DeptId, DeptName = user.Department.Name } } : new List<DepartmentDto>()
                },
                ExpiresIn = 1440 * 60 // 24 hours in seconds
            };
        }

        public async Task<UserDto> RegisterAsync(RegisterDto registerDto)
        {
            if (await _context.Users.AnyAsync(u => u.Username == registerDto.UserName))
            {
                throw new Exception("Username already exists");
            }

            var user = new User
            {
                FullName = registerDto.Name,
                Username = registerDto.UserName,
                Email = registerDto.Email ?? "",
                PasswordHash = HashPassword(registerDto.Password),
                Role = registerDto.Role,
                DepartmentId = registerDto.DepartmentIds.FirstOrDefault(), // Simple assignment for now
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return new UserDto
            {
                UserId = user.UserId,
                Name = user.FullName,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role,
                RoleName = user.Role.ToString()
            };
        }

        public string HashPassword(string password)
        {
            return BCrypt.Net.BCrypt.HashPassword(password);
        }

        public async Task ChangePasswordAsync(int userId, ChangePasswordDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) throw new Exception("User not found");

            if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
                throw new Exception("Current password is incorrect");

            user.PasswordHash = HashPassword(dto.NewPassword);
            await _context.SaveChangesAsync();
        }

        // Exposed for integration tests; production callers should keep using LoginAsync.
        public string GenerateJwtToken(User user)
        {
            var secret = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
                ?? _configuration["Jwt:SecretKey"]!;
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role.ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddMinutes(double.Parse(_configuration["Jwt:ExpirationInMinutes"]!)),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
