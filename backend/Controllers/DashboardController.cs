using Microsoft.AspNetCore.Mvc;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly DashboardStatsService _statsService;

        public DashboardController(DashboardStatsService statsService)
        {
            _statsService = statsService;
        }

        [HttpGet("stats")]
        public async Task<ActionResult<DashboardStatsDto>> GetStats()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = Enum.Parse<UserRole>(User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee");
            var stats = await _statsService.GetStatsAsync(userId, role);
            return Ok(stats);
        }
    }
}
