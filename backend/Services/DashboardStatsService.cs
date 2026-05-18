using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Services
{
    // CRIT-07: Scope dashboard counts by caller role / identity to avoid leaking globals.
    public class DashboardStatsService
    {
        private readonly BarqTMSDbContext _db;

        public DashboardStatsService(BarqTMSDbContext db)
        {
            _db = db;
        }

        public async Task<DashboardStatsDto> GetStatsAsync(int userId, UserRole role)
        {
            return role switch
            {
                UserRole.Manager or UserRole.AssistantManager => await GetGlobalStatsAsync(),
                UserRole.TeamLeader => await GetTeamLeaderStatsAsync(userId),
                UserRole.AccountManager => await GetAccountManagerStatsAsync(userId),
                UserRole.Client => await GetClientStatsAsync(userId),
                _ => await GetEmployeeStatsAsync(userId),
            };
        }

        private async Task<DashboardStatsDto> GetGlobalStatsAsync() => new()
        {
            TotalTasks = await _db.Tasks.CountAsync(t => t.Status != Models.Enums.TaskStatus.Completed),
            TotalProjects = await _db.Projects.CountAsync(),
            TotalUsers = await _db.Users.CountAsync(),
            TotalClients = await _db.Companies.CountAsync()
        };

        private async Task<DashboardStatsDto> GetTeamLeaderStatsAsync(int userId)
        {
            var subordinateIds = await _db.Users
                .Where(u => u.SupervisorId == userId || u.UserId == userId)
                .Select(u => u.UserId)
                .ToListAsync();

            var taskCount = await _db.Tasks
                .CountAsync(t => t.Status != Models.Enums.TaskStatus.Completed
                              && (t.Assignees.Any(a => subordinateIds.Contains(a.UserId))
                                  || t.OriginalAssignerId == userId
                                  || t.DelegatedBy == userId));

            var projectCount = await _db.Projects
                .CountAsync(p => p.TeamLeaders.Any(tl => tl.UserId == userId));

            return new DashboardStatsDto
            {
                TotalTasks = taskCount,
                TotalProjects = projectCount,
                TotalUsers = 0,    // not leaked
                TotalClients = 0,  // not leaked
            };
        }

        private async Task<DashboardStatsDto> GetEmployeeStatsAsync(int userId)
        {
            var taskCount = await _db.Tasks
                .CountAsync(t => t.Status != Models.Enums.TaskStatus.Completed
                              && t.Assignees.Any(a => a.UserId == userId));

            var projectCount = await _db.Projects
                .CountAsync(p => p.Tasks.Any(t => t.Assignees.Any(a => a.UserId == userId)));

            return new DashboardStatsDto
            {
                TotalTasks = taskCount,
                TotalProjects = projectCount,
                TotalUsers = 0,
                TotalClients = 0,
            };
        }

        private async Task<DashboardStatsDto> GetAccountManagerStatsAsync(int userId)
        {
            var managedCompanyIds = await _db.Companies
                .Where(c => c.AccountManagerId == userId)
                .Select(c => c.CompanyId)
                .ToListAsync();

            var projectCount = await _db.Projects
                .CountAsync(p => managedCompanyIds.Contains(p.CompanyId));

            var taskCount = await _db.Tasks
                .CountAsync(t => t.Status != Models.Enums.TaskStatus.Completed
                              && t.ProjectId.HasValue
                              && managedCompanyIds.Contains(t.Project!.CompanyId));

            return new DashboardStatsDto
            {
                TotalTasks = taskCount,
                TotalProjects = projectCount,
                TotalUsers = 0,
                TotalClients = managedCompanyIds.Count,
            };
        }

        private async Task<DashboardStatsDto> GetClientStatsAsync(int userId)
        {
            var ownedCompanyIds = await _db.Companies
                .Where(c => c.OwnerUserId == userId)
                .Select(c => c.CompanyId)
                .ToListAsync();

            var projectCount = await _db.Projects
                .CountAsync(p => ownedCompanyIds.Contains(p.CompanyId));

            var taskCount = await _db.Tasks
                .CountAsync(t => t.Status != Models.Enums.TaskStatus.Completed
                              && t.ProjectId.HasValue
                              && ownedCompanyIds.Contains(t.Project!.CompanyId));

            return new DashboardStatsDto
            {
                TotalTasks = taskCount,
                TotalProjects = projectCount,
                TotalUsers = 0,
                TotalClients = 0,
            };
        }
    }
}
