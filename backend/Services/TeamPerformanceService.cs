using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Models.Sales;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Services
{
    // HIGH-05: Generalized TL performance summary. Sales TLs aggregate by SalesActivityType;
    // other department types currently return zeroed actuals (placeholder until department-specific
    // KPIs are designed — see AUDIT HIGH-05).
    public class TeamPerformanceService
    {
        private readonly BarqTMSDbContext _db;

        public TeamPerformanceService(BarqTMSDbContext db)
        {
            _db = db;
        }

        public async Task<List<TeamLeaderSalesSummaryDto>> GetSummaryAsync(DepartmentType type, int month, int year)
        {
            var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Type == type);
            if (dept == null) return new();

            var targetDate = new DateTime(year, month, 1);
            var nextMonth = targetDate.AddMonths(1);

            var tls = await _db.Users
                .Where(u => u.Role == UserRole.TeamLeader && u.DepartmentId == dept.DeptId)
                .ToListAsync();

            var results = new List<TeamLeaderSalesSummaryDto>();
            foreach (var tl in tls)
            {
                var teamIds = await _db.Users
                    .Where(u => u.SupervisorId == tl.UserId || u.UserId == tl.UserId)
                    .Select(u => u.UserId)
                    .ToListAsync();

                SalesTarget? target = null;
                int actualClients = 0, actualMeetings = 0, actualData = 0;

                if (type == DepartmentType.Sales)
                {
                    target = await _db.SalesTargets
                        .FirstOrDefaultAsync(t => t.TeamLeaderId == tl.UserId && t.Month == targetDate);

                    var tasks = await _db.Tasks
                        .Include(t => t.Assignees)
                        .Where(t => t.Assignees.Any(a => teamIds.Contains(a.UserId))
                                 && (t.Status == Models.Enums.TaskStatus.Completed || t.Status == Models.Enums.TaskStatus.Closed)
                                 && t.CompletedAt != null && t.CompletedAt >= targetDate && t.CompletedAt < nextMonth)
                        .ToListAsync();

                    actualClients = (int)Math.Round(tasks.Where(t => t.SalesActivityType == SalesActivityType.Closing).Sum(t => t.FinalKpiValue ?? 0));
                    actualMeetings = (int)Math.Round(tasks.Where(t => t.SalesActivityType == SalesActivityType.Meeting || t.SalesActivityType == SalesActivityType.ColdCall).Sum(t => t.FinalKpiValue ?? 0));
                    actualData = (int)Math.Round(tasks.Where(t => t.SalesActivityType == SalesActivityType.DataCollection).Sum(t => t.FinalKpiValue ?? 0));
                }

                results.Add(new TeamLeaderSalesSummaryDto
                {
                    TeamLeaderId = tl.UserId,
                    TeamLeaderName = tl.FullName,
                    TargetClients = target?.TargetClients ?? 0,
                    TargetMeetings = target?.TargetMeetings ?? 0,
                    TargetData = target?.TargetData ?? 0,
                    ActualClients = actualClients,
                    ActualMeetings = actualMeetings,
                    ActualData = actualData,
                });
            }

            return results;
        }
    }
}
