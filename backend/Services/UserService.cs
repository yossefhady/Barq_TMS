using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace BarqTMS.API.Services
{
    public class UserService : IUserService
    {
        private readonly BarqTMSDbContext _context;
        private readonly ILogger<UserService> _logger;

        public UserService(BarqTMSDbContext context, ILogger<UserService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<IEnumerable<UserDto>> GetAllUsersAsync(int userId = 0, UserRole role = UserRole.Employee)
        {
            var query = _context.Users
                .Include(u => u.Department)
                .Include(u => u.Supervisor)
                .Include(u => u.Subordinates)
                .Include(u => u.ManagedCompanies)
                .Include(u => u.LedProjects)
                .AsQueryable();

            // Filter based on role
            if (role == UserRole.TeamLeader)
            {
                // Team Leaders see their subordinates
                query = query.Where(u => u.SupervisorId == userId || u.UserId == userId);
            }
            else if (role == UserRole.Employee)
            {
                // Employees only see themselves (or maybe their team? for now just themselves to be safe/strict)
                query = query.Where(u => u.UserId == userId);
            }
            // Managers and Assistant Managers see all users

            var users = await query.ToListAsync();

            return users.Select(MapToDto);
        }

        public async Task<UserDto?> GetUserByIdAsync(int id)
        {
            var user = await _context.Users
                .Include(u => u.Department)
                .Include(u => u.Supervisor)
                .Include(u => u.Subordinates)
                .Include(u => u.ManagedCompanies)
                .Include(u => u.LedProjects)
                .FirstOrDefaultAsync(u => u.UserId == id);

            return user == null ? null : MapToDto(user);
        }

        public async Task<UserDto> CreateUserAsync(CreateUserDto createUserDto)
        {
            // Check if username or email already exists
            if (await _context.Users.AnyAsync(u => u.Username == createUserDto.Username))
            {
                throw new InvalidOperationException("Username already exists.");
            }

            if (!string.IsNullOrEmpty(createUserDto.Email) && await _context.Users.AnyAsync(u => u.Email == createUserDto.Email))
            {
                throw new InvalidOperationException("Email already exists.");
            }

            var user = new User
            {
                Username = createUserDto.Username,
                FullName = createUserDto.Name,
                Email = createUserDto.Email ?? string.Empty,
                Phone = createUserDto.Phone,
                Position = createUserDto.Position,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(createUserDto.Password),
                Role = createUserDto.Role,
                DepartmentId = createUserDto.DepartmentIds.Any() ? createUserDto.DepartmentIds.First() : null,
                SupervisorId = createUserDto.TeamLeaderId,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Handle Managed Employees (Subordinates)
            if (createUserDto.ManagedEmployeeIds != null && createUserDto.ManagedEmployeeIds.Any())
            {
                var subordinates = await _context.Users
                    .Where(u => createUserDto.ManagedEmployeeIds.Contains(u.UserId))
                    .ToListAsync();
                
                foreach (var sub in subordinates)
                {
                    sub.SupervisorId = user.UserId;
                }
            }

            // Handle Managed Clients (Companies)
            if (createUserDto.ManagedClientIds != null && createUserDto.ManagedClientIds.Any())
            {
                var companies = await _context.Companies
                    .Where(c => createUserDto.ManagedClientIds.Contains(c.CompanyId))
                    .ToListAsync();
                
                foreach (var comp in companies)
                {
                    comp.AccountManagerId = user.UserId;
                }
            }

            // Handle Managed Projects (Team Leader)
            if (createUserDto.ManagedProjectIds != null && createUserDto.ManagedProjectIds.Any())
            {
                foreach (var projectId in createUserDto.ManagedProjectIds)
                {
                    _context.ProjectTeamLeaders.Add(new ProjectTeamLeader
                    {
                        ProjectId = projectId,
                        UserId = user.UserId
                    });
                }
            }

            if ((createUserDto.ManagedEmployeeIds != null && createUserDto.ManagedEmployeeIds.Any()) || 
                (createUserDto.ManagedClientIds != null && createUserDto.ManagedClientIds.Any()) ||
                (createUserDto.ManagedProjectIds != null && createUserDto.ManagedProjectIds.Any()))
            {
                await _context.SaveChangesAsync();
            }

            // Reload to get included properties
            return (await GetUserByIdAsync(user.UserId))!;
        }

        public async Task<UserDto?> UpdateUserAsync(int id, UpdateUserDto updateUserDto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return null;

            user.FullName = updateUserDto.Name;
            if (!string.IsNullOrEmpty(updateUserDto.Username)) user.Username = updateUserDto.Username;
            if (!string.IsNullOrEmpty(updateUserDto.Email)) user.Email = updateUserDto.Email;
            if (!string.IsNullOrEmpty(updateUserDto.Phone)) user.Phone = updateUserDto.Phone;
            if (!string.IsNullOrEmpty(updateUserDto.Position)) user.Position = updateUserDto.Position;
            if (updateUserDto.Role.HasValue) user.Role = updateUserDto.Role.Value;
            
            // Update Department if provided
            if (updateUserDto.DepartmentIds.Any())
            {
                user.DepartmentId = updateUserDto.DepartmentIds.First();
            }

            if (updateUserDto.TeamLeaderId.HasValue)
            {
                user.SupervisorId = updateUserDto.TeamLeaderId.Value;
            }

            // Handle Managed Employees (Subordinates)
            if (updateUserDto.ManagedEmployeeIds != null)
            {
                // Clear existing supervisor for users who are no longer managed by this user
                var existingSubordinates = await _context.Users
                    .Where(u => u.SupervisorId == user.UserId)
                    .ToListAsync();
                
                foreach (var sub in existingSubordinates)
                {
                    if (!updateUserDto.ManagedEmployeeIds.Contains(sub.UserId))
                    {
                        sub.SupervisorId = null;
                    }
                }

                // Set supervisor for new managed employees
                var newSubordinates = await _context.Users
                    .Where(u => updateUserDto.ManagedEmployeeIds.Contains(u.UserId))
                    .ToListAsync();
                
                foreach (var sub in newSubordinates)
                {
                    sub.SupervisorId = user.UserId;
                }
            }

            // Handle Managed Clients (Companies)
            if (updateUserDto.ManagedClientIds != null)
            {
                // Clear existing account manager for companies no longer managed by this user
                var existingCompanies = await _context.Companies
                    .Where(c => c.AccountManagerId == user.UserId)
                    .ToListAsync();
                
                foreach (var comp in existingCompanies)
                {
                    if (!updateUserDto.ManagedClientIds.Contains(comp.CompanyId))
                    {
                        comp.AccountManagerId = null;
                    }
                }

                // Set account manager for new managed companies
                var newCompanies = await _context.Companies
                    .Where(c => updateUserDto.ManagedClientIds.Contains(c.CompanyId))
                    .ToListAsync();
                
                foreach (var comp in newCompanies)
                {
                    comp.AccountManagerId = user.UserId;
                }
            }

            // Handle Managed Projects (Team Leader)
            if (updateUserDto.ManagedProjectIds != null)
            {
                // Remove existing assignments
                var existingAssignments = await _context.ProjectTeamLeaders
                    .Where(pt => pt.UserId == user.UserId)
                    .ToListAsync();
                _context.ProjectTeamLeaders.RemoveRange(existingAssignments);

                // Add new assignments
                foreach (var projectId in updateUserDto.ManagedProjectIds)
                {
                    _context.ProjectTeamLeaders.Add(new ProjectTeamLeader
                    {
                        ProjectId = projectId,
                        UserId = user.UserId
                    });
                }
            }

            await _context.SaveChangesAsync();

            return (await GetUserByIdAsync(user.UserId))!;
        }

        public async Task<bool> DeleteUserAsync(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return false;

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return true;
        }

        private UserDto MapToDto(User user)
        {
            return new UserDto
            {
                UserId = user.UserId,
                Name = user.FullName,
                Username = user.Username,
                Email = user.Email,
                Phone = user.Phone,
                Position = user.Position,
                IsActive = user.IsActive,
                Role = user.Role,
                RoleId = (int)user.Role,
                RoleName = user.Role.ToString(),
                TeamLeaderId = user.SupervisorId,
                TeamLeaderName = user.Supervisor?.FullName,
                DepartmentId = user.Department?.DeptId,
                DepartmentName = user.Department?.Name,
                Departments = user.Department != null
                    ? new List<DepartmentDto>
                    {
                        new DepartmentDto
                        {
                            DeptId = user.Department.DeptId,
                            DeptName = user.Department.Name
                        }
                    }
                    : new List<DepartmentDto>(),
                ManagedEmployeeIds = user.Subordinates.Select(s => s.UserId).ToList(),
                ManagedClientIds = user.ManagedCompanies.Select(c => c.CompanyId).ToList(),
                ManagedProjectIds = user.LedProjects.Select(pt => pt.ProjectId).ToList()
            };
        }
    }
}
