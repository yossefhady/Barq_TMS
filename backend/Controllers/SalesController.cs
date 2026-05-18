using BarqTMS.API.Data;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Models.Sales;
using BarqTMS.API.DTOs;
using BarqTMS.API.Services; 
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BarqTMS.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SalesController : ControllerBase
    {
        private readonly BarqTMSDbContext _context;
        private readonly IUserService _userService;
        private readonly TeamPerformanceService _teamPerformance;

        public SalesController(BarqTMSDbContext context, IUserService userService, TeamPerformanceService teamPerformance)
        {
            _context = context;
            _userService = userService;
            _teamPerformance = teamPerformance;
        }

        // HIGH-05: Generic team summary by department type. Marketing / Creative TLs use the
        // same endpoint with `type=Marketing` etc. Returns zeroed actuals until that department
        // has KPI rules defined.
        [HttpGet("team-performance/{type}/summary")]
        public async Task<ActionResult<List<TeamLeaderSalesSummaryDto>>> GetTeamPerformance(string type, [FromQuery] int month, [FromQuery] int year)
        {
            if (!Enum.TryParse<DepartmentType>(type, ignoreCase: true, out var deptType))
                return BadRequest($"Unknown department type '{type}'");

            var summary = await _teamPerformance.GetSummaryAsync(deptType, month, year);
            return Ok(summary);
        }

        // --- 1. User & Hierarchy Setup ---

        [HttpGet("targets/summary")]
        public async Task<ActionResult<List<TeamLeaderSalesSummaryDto>>> GetSummary([FromQuery] int month, [FromQuery] int year)
        {
            var targetDate = new DateTime(year, month, 1);
            var nextMonth = targetDate.AddMonths(1);
            
            var salesDept = await _context.Departments.FirstOrDefaultAsync(d => d.Type == DepartmentType.Sales); // HIGH-04
            if (salesDept == null) return Ok(new List<TeamLeaderSalesSummaryDto>());

            var salesTLs = await _context.Users
                .Where(u => u.Role == UserRole.TeamLeader && u.DepartmentId == salesDept.DeptId)
                .Include(u => u.Department)
                .ToListAsync();

            var result = new List<TeamLeaderSalesSummaryDto>();

            foreach(var tl in salesTLs)
            {
                var target = await _context.SalesTargets
                    .FirstOrDefaultAsync(t => t.TeamLeaderId == tl.UserId && t.Month == targetDate);
                
                var teamIds = await _context.Users
                    .Where(u => u.SupervisorId == tl.UserId || u.UserId == tl.UserId)
                    .Select(u => u.UserId)
                    .ToListAsync();
                
                var tasks = await _context.Tasks
                    .Include(t => t.Assignees)
                    .Where(t => t.Assignees.Any(ta => teamIds.Contains(ta.UserId)) &&
                                (t.Status == BarqTMS.API.Models.Enums.TaskStatus.Completed || t.Status == BarqTMS.API.Models.Enums.TaskStatus.Closed) &&
                                t.CompletedAt != null && t.CompletedAt >= targetDate && t.CompletedAt < nextMonth)
                    .ToListAsync();
                
                 var actualClients = tasks.Where(t => t.SalesActivityType == SalesActivityType.Closing).Sum(t => t.FinalKpiValue ?? 0);
                 var actualMeetings = tasks.Where(t => t.SalesActivityType == SalesActivityType.Meeting || t.SalesActivityType == SalesActivityType.ColdCall).Sum(t => t.FinalKpiValue ?? 0);
                 var actualData = tasks.Where(t => t.SalesActivityType == SalesActivityType.DataCollection).Sum(t => t.FinalKpiValue ?? 0);

                 result.Add(new TeamLeaderSalesSummaryDto
                 {
                     TeamLeaderId = tl.UserId,
                     TeamLeaderName = tl.FullName,
                     TargetClients = target?.TargetClients ?? 0,
                     TargetMeetings = target?.TargetMeetings ?? 0,
                     TargetData = target?.TargetData ?? 0,
                     ActualClients = (int)Math.Round(actualClients),
                     ActualMeetings = (int)Math.Round(actualMeetings),
                     ActualData = (int)Math.Round(actualData)
                 });
            }
            
            return Ok(result);
        }

        [HttpPost("team-leader")]
        [Authorize(Roles = "Manager,AssistantManager")]
        public async Task<IActionResult> CreateSalesTeamLeader([FromBody] CreateSalesTeamLeaderDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var newUser = new User
                {
                    Username = dto.Username,
                    FullName = dto.Name, 
                    Email = dto.Email,
                    Phone = dto.Phone,
                    Role = UserRole.TeamLeader,
                    DepartmentId = null, 
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                    CreatedAt = DateTime.UtcNow
                };
                
                var salesDept = await _context.Departments.FirstOrDefaultAsync(d => d.Type == DepartmentType.Sales); // HIGH-04
                if (salesDept != null) 
                {
                    newUser.DepartmentId = salesDept.DeptId;
                    // newUser.Departments = new List<Department> { salesDept }; 
                }

                _context.Users.Add(newUser);
                await _context.SaveChangesAsync();

                if (dto.ManagedEmployeeIds != null && dto.ManagedEmployeeIds.Any())
                {
                    var employees = await _context.Users
                        .Where(u => dto.ManagedEmployeeIds.Contains(u.UserId))
                        .ToListAsync();

                    foreach (var emp in employees)
                    {
                        emp.SupervisorId = newUser.UserId;
                    }
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();
                return Ok(new { Message = "Sales Team Leader created and team assigned.", UserId = newUser.UserId });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { Message = ex.Message });
            }
        }

        // --- 2. Sales Targets ---

        [HttpPost("assign-target")]
        [Authorize(Roles = "Manager,AssistantManager")]
        public async Task<IActionResult> AssignTarget([FromBody] AssignSalesTargetDto dto)
        {
            var targetDate = new DateTime(dto.TargetYear, dto.TargetMonth, 1);
            
            var existing = await _context.SalesTargets
                .FirstOrDefaultAsync(t => t.TeamLeaderId == dto.TeamLeaderId && t.Month == targetDate);

            if (existing != null)
            {
                existing.TargetClients = dto.TargetClients;
                existing.TargetMeetings = dto.TargetMeetings;
                existing.TargetData = dto.TargetData;
            }
            else
            {
                var target = new SalesTarget
                {
                    TeamLeaderId = dto.TeamLeaderId,
                    Month = targetDate,
                    TargetClients = dto.TargetClients,
                    TargetMeetings = dto.TargetMeetings,
                    TargetData = dto.TargetData
                };
                _context.SalesTargets.Add(target);
            }

            await _context.SaveChangesAsync();
            return Ok("Target updated successfully.");
        }

        // --- 5. Task Workflows: Approval & Numeric Input ---

        [HttpPost("review-task")]
        [Authorize(Roles = "TeamLeader")]
        public async Task<IActionResult> ReviewTask([FromBody] UpdateTaskKpiDto dto)
        {
            var task = await _context.Tasks.FindAsync(dto.TaskId);
            if (task == null) return NotFound("Task not found.");

            if (task.Status != BarqTMS.API.Models.Enums.TaskStatus.InReview)
                return BadRequest("Task is not in review.");

            if (dto.IsApproved)
            {
                if (dto.FinalValue == null)
                    return BadRequest("You must provide the Final Numeric Value (Kpi Value) to approve.");

                task.FinalKpiValue = dto.FinalValue;
                task.Status = BarqTMS.API.Models.Enums.TaskStatus.Completed;
                task.CompletedAt = DateTime.UtcNow;
                
                // Ensure Date for reporting
                if (!task.DueDate.HasValue) task.DueDate = DateTime.UtcNow;
            }
            else
            {
                task.Status = BarqTMS.API.Models.Enums.TaskStatus.InProgress;
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Task review processed.", Status = task.Status.ToString() });
        }

         // --- 6. KPI Calculation Algorithm ---

        [HttpGet("dashboard-stats")]
        public async Task<IActionResult> GetDashboardStats([FromQuery] int teamLeaderId, [FromQuery] int month, [FromQuery] int year)
        {
            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var target = await _context.SalesTargets
                .FirstOrDefaultAsync(t => t.TeamLeaderId == teamLeaderId && t.Month == startDate);
            
            if (target == null) return Ok(new SalesDashboardStatsDto());

            var teamIds = await _context.Users
                .Where(u => u.SupervisorId == teamLeaderId || u.UserId == teamLeaderId)
                .Select(u => u.UserId)
                .ToListAsync();

            var tasks = await _context.Tasks
                .Include(t => t.Assignees) // Include Assignees
                .Where(t => t.Assignees.Any(ta => teamIds.Contains(ta.UserId)) &&
                            (t.Status == BarqTMS.API.Models.Enums.TaskStatus.Completed || t.Status == BarqTMS.API.Models.Enums.TaskStatus.Closed) &&
                            // Priority: CompletedAt, then DueDate, then CreatedAt? 
                            // Using CompletedAt if available, else DueDate
                            ( (t.CompletedAt >= startDate && t.CompletedAt < endDate) || 
                              (t.CompletedAt == null && t.DueDate >= startDate && t.DueDate < endDate) ))
                .ToListAsync();

            var actualClients = tasks
                .Where(t => t.SalesActivityType == SalesActivityType.Closing)
                .Sum(t => t.FinalKpiValue ?? 0); 

            var actualMeetings = tasks
                .Where(t => t.SalesActivityType == SalesActivityType.Meeting || t.SalesActivityType == SalesActivityType.ColdCall)
                .Sum(t => t.FinalKpiValue ?? 0);

            var actualData = tasks
                .Where(t => t.SalesActivityType == SalesActivityType.DataCollection)
                .Sum(t => t.FinalKpiValue ?? 0);

            return Ok(new SalesDashboardStatsDto
            {
                TargetClients = target.TargetClients,
                ActualClients = (int)Math.Round(actualClients),
                TargetMeetings = target.TargetMeetings,
                ActualMeetings = (int)Math.Round(actualMeetings),
                TargetData = target.TargetData,
                ActualData = (int)Math.Round(actualData)
            });
        }

        [HttpGet("employee-stats")]
        [Authorize]
        public async Task<IActionResult> GetEmployeeStats([FromQuery] int month, [FromQuery] int year)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var tasks = await _context.Tasks
                .Include(t => t.Assignees)
                .Where(t => t.Assignees.Any(ta => ta.UserId == userId) &&
                            (t.Status == BarqTMS.API.Models.Enums.TaskStatus.Completed || t.Status == BarqTMS.API.Models.Enums.TaskStatus.Closed) &&
                            t.CompletedAt != null && t.CompletedAt >= startDate && t.CompletedAt < endDate)
                .ToListAsync();

             var actualClients = tasks.Where(t => t.SalesActivityType == SalesActivityType.Closing).Sum(t => t.FinalKpiValue ?? 0);
             var actualMeetings = tasks.Where(t => t.SalesActivityType == SalesActivityType.Meeting || t.SalesActivityType == SalesActivityType.ColdCall).Sum(t => t.FinalKpiValue ?? 0);
             var actualData = tasks.Where(t => t.SalesActivityType == SalesActivityType.DataCollection).Sum(t => t.FinalKpiValue ?? 0);

            var user = await _context.Users.FindAsync(userId);
            SalesTarget? teamTarget = null;
            if (user?.SupervisorId != null)
            {
                 teamTarget = await _context.SalesTargets
                    .FirstOrDefaultAsync(t => t.TeamLeaderId == user.SupervisorId && t.Month == startDate);
            }

            return Ok(new SalesDashboardStatsDto
            {
                ActualClients = (int)Math.Round(actualClients),
                ActualMeetings = (int)Math.Round(actualMeetings),
                ActualData = (int)Math.Round(actualData),
                TargetClients = teamTarget?.TargetClients ?? 0,
                TargetMeetings = teamTarget?.TargetMeetings ?? 0,   
                TargetData = teamTarget?.TargetData ?? 0
            });
        }
        
        [HttpGet("market-segments")]
        [Authorize]
        public async Task<IActionResult> GetMarketSegments([FromQuery] string? status)
        {
             var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
             // Determine TL
             var user = await _context.Users.FindAsync(userId);
             if (user == null) return Unauthorized();

             int tlId = (user.Role == UserRole.TeamLeader) ? userId : (user.SupervisorId ?? 0);

             var query = _context.MarketSegments.Where(m => m.TeamLeaderId == tlId).AsQueryable();
             if(!string.IsNullOrEmpty(status))
             {
                 query = query.Where(m => m.Status == status);
             }
             return Ok(await query.ToListAsync());
        }
        
        [HttpGet("weekly-war-room")]
        public async Task<IActionResult> GetWeeklyWarRoom([FromQuery] int userId)
        {
             // SECURITY FIX: Verify the caller is the requested user, their manager, or a Manager role
             var callerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
             var callerRoleStr = User.FindFirst(ClaimTypes.Role)?.Value;
             var callerRole = Enum.TryParse<UserRole>(callerRoleStr, out var parsedRole) ? parsedRole : UserRole.Employee;

             if (callerRole != UserRole.Manager && callerRole != UserRole.AssistantManager && callerId != userId)
             {
                 var requestedUser = await _context.Users.FindAsync(userId);
                 if (requestedUser == null || requestedUser.SupervisorId != callerId)
                     return Forbid();
             }

             var user = await _context.Users.FindAsync(userId);
             if (user == null) return NotFound();
             
             int tlId = user.Role == UserRole.TeamLeader ? user.UserId : (user.SupervisorId ?? 0);
             
             var today = DateTime.UtcNow;
             int diff = (7 + (today.DayOfWeek - DayOfWeek.Saturday)) % 7; 
             var weekStart = today.AddDays(-1 * diff).Date; 
             
             var strategy = await _context.WeeklyWarRooms
                 .Where(w => w.CreatedByUserId == tlId) 
                 .OrderByDescending(w => w.WeekStartDate)
                 .FirstOrDefaultAsync();
                 
             return Ok(strategy);
        }

        [HttpPost("weekly-war-room")]
        [Authorize(Roles = "TeamLeader")]
        public async Task<IActionResult> UpsertWeeklyWarRoom([FromBody] CreateWarRoomStrategyDto dto)
        {
             var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
             var today = DateTime.UtcNow;
             int diff = (7 + (today.DayOfWeek - DayOfWeek.Saturday)) % 7; 
             var weekStart = today.AddDays(-1 * diff).Date;
             
             var existing = await _context.WeeklyWarRooms
                 .FirstOrDefaultAsync(w => w.CreatedByUserId == userId && w.WeekStartDate == weekStart);
                 
             if (existing != null)
             {
                 existing.Content = dto.Content;
                 existing.LastUpdatedAt = DateTime.UtcNow; 
             }
             else
             {
                 _context.WeeklyWarRooms.Add(new WeeklyWarRoom
                 {
                     WeekStartDate = weekStart,
                     Content = dto.Content,
                     CreatedByUserId = userId,
                     LastUpdatedAt = DateTime.UtcNow
                 });
             }
             
             await _context.SaveChangesAsync();
             return Ok("Strategy updated.");
        }

        [HttpPost("market-segments")]
        [Authorize(Roles = "TeamLeader")]
        public async Task<IActionResult> CreateMarketSegment([FromBody] CreateMarketSegmentDto dto)
        {
             var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
             var segment = new MarketSegment
             {
                 Place = dto.Place,
                 Category = dto.Category,
                 Status = dto.Status,
                 TeamLeaderId = userId
             };
             _context.MarketSegments.Add(segment);
             await _context.SaveChangesAsync();
             return Ok(segment);
        }

        [HttpPut("market-segments/{id}/status")]
        [Authorize(Roles = "TeamLeader")]
        public async Task<IActionResult> UpdateMarketSegmentStatus(int id, [FromBody] UpdateMarketSegmentStatusDto dto)
        {
             var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
             var segment = await _context.MarketSegments.FindAsync(id);
             if (segment == null) return NotFound();
             
             if (segment.TeamLeaderId != userId) return Forbid();

             segment.Status = dto.Status;
             await _context.SaveChangesAsync();
             return Ok(segment);
        }

        [HttpDelete("market-segments/{id}")]
        [Authorize(Roles = "TeamLeader")]
        public async Task<IActionResult> DeleteMarketSegment(int id)
        {
             var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
             var segment = await _context.MarketSegments.FindAsync(id);
             if (segment == null) return NotFound();
             
             if (segment.TeamLeaderId != userId) return Forbid();

             _context.MarketSegments.Remove(segment);
             await _context.SaveChangesAsync();
             return Ok("Segment deleted.");
        }
    }
}
