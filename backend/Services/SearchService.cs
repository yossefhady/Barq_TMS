using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Services
{
    public interface ISearchService
    {
        Task<SearchResultsDto> SearchAsync(string query, string? type = null);
    }

    public class SearchService : ISearchService
    {
        private readonly BarqTMSDbContext _context;

        public SearchService(BarqTMSDbContext context)
        {
            _context = context;
        }

        public async Task<SearchResultsDto> SearchAsync(string query, string? type = null)
        {
            var results = new SearchResultsDto();
            if (string.IsNullOrWhiteSpace(query))
                return results;

            var q = query.ToLower();

            if (type == null || type == "tasks")
            {
                var tasks = await _context.Tasks
                    .Where(t => t.Title.ToLower().Contains(q) || (t.Description != null && t.Description.ToLower().Contains(q)))
                    .Take(20)
                    .Select(t => new { Type = "Task", t.TaskId, t.Title, t.Status, ProjectName = t.Project != null ? t.Project.Name : "Unknown" })
                    .ToListAsync();
                results.Results.AddRange(tasks);
            }

            if (type == null || type == "projects")
            {
                var projects = await _context.Projects
                    .Where(p => p.Name.ToLower().Contains(q) || (p.Description != null && p.Description.ToLower().Contains(q)))
                    .Take(20)
                    .Select(p => new { Type = "Project", p.ProjectId, p.Name, p.Status, ClientName = p.Company.Name })
                    .ToListAsync();
                results.Results.AddRange(projects);
            }

            if (type == null || type == "users")
            {
                var users = await _context.Users
                    .Where(u => u.FullName.ToLower().Contains(q) || u.Email.ToLower().Contains(q))
                    .Take(20)
                    .Select(u => new { Type = "User", u.UserId, u.FullName, u.Email, u.Role })
                    .ToListAsync();
                results.Results.AddRange(users);
            }

            if (type == null || type == "clients")
            {
                var clients = await _context.Companies
                    .Where(c => c.Name.ToLower().Contains(q))
                    .Take(20)
                    .Select(c => new { Type = "Client", c.CompanyId, c.Name, c.Email })
                    .ToListAsync();
                results.Results.AddRange(clients);
            }

            return results;
        }
    }
}
