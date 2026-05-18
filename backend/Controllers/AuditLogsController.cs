using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using BarqTMS.API.Data;
using System.Security.Claims;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AuditLogsController : ControllerBase
    {
        private readonly BarqTMSDbContext _context;

        public AuditLogsController(BarqTMSDbContext context)
        {
            _context = context;
        }

        // GET /api/AuditLogs?page=1&pageSize=50
        [HttpGet]
        [Authorize(Roles = "Manager,AssistantManager")]
        public async Task<IActionResult> GetAll(int page = 1, int pageSize = 50)
        {
            var total = await _context.AuditLogs.CountAsync();
            var logs = await _context.AuditLogs
                .Include(l => l.User)
                .OrderByDescending(l => l.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(l => new
                {
                    l.LogId,
                    l.UserId,
                    UserName = l.User.FullName,
                    l.Action,
                    l.EntityName,
                    l.EntityId,
                    l.OldValues,
                    l.NewValues,
                    l.Timestamp
                })
                .ToListAsync();

            return Ok(new { items = logs, total, page, pageSize });
        }

        // GET /api/AuditLogs/project/{projectId}
        [HttpGet("project/{projectId}")]
        public async Task<IActionResult> GetByProject(int projectId)
        {
            var logs = await _context.AuditLogs
                .Include(l => l.User)
                .Where(l => l.EntityName == "Project" && l.EntityId == projectId)
                .OrderByDescending(l => l.Timestamp)
                .Take(100)
                .Select(l => new
                {
                    l.LogId,
                    l.UserId,
                    UserName = l.User.FullName,
                    l.Action,
                    l.EntityName,
                    l.EntityId,
                    l.OldValues,
                    l.NewValues,
                    l.Timestamp
                })
                .ToListAsync();

            return Ok(logs);
        }

        // GET /api/AuditLogs/task/{taskId}
        [HttpGet("task/{taskId}")]
        public async Task<IActionResult> GetByTask(int taskId)
        {
            var logs = await _context.AuditLogs
                .Include(l => l.User)
                .Where(l => l.EntityName == "Task" && l.EntityId == taskId)
                .OrderByDescending(l => l.Timestamp)
                .Take(100)
                .Select(l => new
                {
                    l.LogId,
                    l.UserId,
                    UserName = l.User.FullName,
                    l.Action,
                    l.EntityName,
                    l.EntityId,
                    l.OldValues,
                    l.NewValues,
                    l.Timestamp
                })
                .ToListAsync();

            return Ok(logs);
        }

        // GET /api/AuditLogs/user/{userId}?page=1&pageSize=50
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetByUser(int userId, int page = 1, int pageSize = 50)
        {
            var total = await _context.AuditLogs.CountAsync(l => l.UserId == userId);
            var logs = await _context.AuditLogs
                .Include(l => l.User)
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(l => new
                {
                    l.LogId,
                    l.UserId,
                    UserName = l.User.FullName,
                    l.Action,
                    l.EntityName,
                    l.EntityId,
                    l.OldValues,
                    l.NewValues,
                    l.Timestamp
                })
                .ToListAsync();

            return Ok(new { items = logs, total, page, pageSize });
        }

        // GET /api/AuditLogs/recent?count=10
        [HttpGet("recent")]
        public async Task<IActionResult> GetRecent(int count = 10)
        {
            var logs = await _context.AuditLogs
                .Include(l => l.User)
                .OrderByDescending(l => l.Timestamp)
                .Take(count)
                .Select(l => new
                {
                    l.LogId,
                    l.UserId,
                    UserName = l.User.FullName,
                    l.Action,
                    l.EntityName,
                    l.EntityId,
                    l.OldValues,
                    l.NewValues,
                    l.Timestamp
                })
                .ToListAsync();

            return Ok(logs);
        }
    }
}
