using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;

namespace BarqTMS.API.Services
{
    public interface IUserService
    {
        Task<IEnumerable<UserDto>> GetAllUsersAsync(int userId = 0, UserRole role = UserRole.Employee);
        Task<UserDto?> GetUserByIdAsync(int id);
        Task<UserDto> CreateUserAsync(CreateUserDto createUserDto);
        Task<UserDto?> UpdateUserAsync(int id, UpdateUserDto updateUserDto);
        Task<bool> DeleteUserAsync(int id);
    }
}
