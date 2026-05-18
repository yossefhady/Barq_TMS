using Microsoft.AspNetCore.Mvc;
using BarqTMS.API.Services;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;

        public UsersController(IUserService userService)
        {
            _userService = userService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetAllUsers()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var roleString = User.FindFirst(ClaimTypes.Role)?.Value;
            var role = Enum.TryParse<UserRole>(roleString, out var parsedRole) ? parsedRole : UserRole.Employee;

            var users = await _userService.GetAllUsersAsync(userId, role);
            return Ok(users);
        }

        [HttpGet("by-role/{roleId}")]
        [Authorize(Roles = "Manager,AssistantManager,AccountManager")]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetUsersByRole(int roleId)
        {
            if (!Enum.IsDefined(typeof(UserRole), roleId))
                return BadRequest("Invalid role ID.");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var roleString = User.FindFirst(ClaimTypes.Role)?.Value;
            var callerRole = Enum.TryParse<UserRole>(roleString, out var parsedRole) ? parsedRole : UserRole.Employee;

            var allUsers = await _userService.GetAllUsersAsync(userId, callerRole);
            var filtered = allUsers.Where(u => u.RoleId == roleId);
            return Ok(filtered);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<UserDto>> GetUser(int id)
        {
            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
            {
                return NotFound();
            }
            return Ok(user);
        }

        [HttpPost]
        [Authorize(Roles = "Manager,AssistantManager")] // MED-01: removed phantom "Admin" role. // Only Managers or Admins can create users
        public async Task<ActionResult<UserDto>> CreateUser(CreateUserDto createUserDto)
        {
            try
            {
                var user = await _userService.CreateUserAsync(createUserDto);
                return CreatedAtAction(nameof(GetUser), new { id = user.UserId }, user);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Manager,AssistantManager")] // MED-01: removed phantom "Admin" role.
        public async Task<ActionResult<UserDto>> UpdateUser(int id, UpdateUserDto updateUserDto)
        {
            var user = await _userService.UpdateUserAsync(id, updateUserDto);
            if (user == null)
            {
                return NotFound();
            }
            return Ok(user);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Manager,AssistantManager")] // MED-01: removed phantom "Admin" role.
        public async Task<IActionResult> DeleteUser(int id)
        {
            var result = await _userService.DeleteUserAsync(id);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}
