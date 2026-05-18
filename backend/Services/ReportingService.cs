using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace BarqTMS.API.Services
{
    public interface IReportingService
    {
        Task<ProjectReportDto> GetProjectReportAsync(int projectId, DateTime? startDate = null, DateTime? endDate = null);
        Task<ClientReportDto> GetClientReportAsync(int clientId, DateTime? startDate = null, DateTime? endDate = null);
        Task<UserPerformanceReportDto> GetUserPerformanceReportAsync(int userId, DateTime? startDate = null, DateTime? endDate = null);
        Task<DepartmentReportDto> GetDepartmentReportAsync(int departmentId, DateTime? startDate = null, DateTime? endDate = null);
        Task<SystemOverviewReportDto> GetSystemOverviewReportAsync(DateTime? startDate = null, DateTime? endDate = null);
        Task<byte[]> ExportProjectReportToCsvAsync(int projectId, DateTime? startDate = null, DateTime? endDate = null);
        Task<byte[]> ExportUserPerformanceReportToCsvAsync(int userId, DateTime? startDate = null, DateTime? endDate = null);
        Task<IEnumerable<TaskProductivityDto>> GetTaskProductivityReportAsync(DateTime? startDate = null, DateTime? endDate = null);
        Task<IEnumerable<TimeTrackingReportDto>> GetTimeTrackingReportAsync(int? userId = null, int? projectId = null, DateTime? startDate = null, DateTime? endDate = null);
    }

    public class ReportingService : IReportingService
    {
        private readonly BarqTMSDbContext _context;

        public ReportingService(BarqTMSDbContext context)
        {
            _context = context;
        }

        public async Task<ProjectReportDto> GetProjectReportAsync(int projectId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var project = await _context.Projects
                .Include(p => p.Company)
                .Include(p => p.Tasks)
                    .ThenInclude(t => t.TimeLogs)
                .FirstOrDefaultAsync(p => p.ProjectId == projectId);

            if (project == null)
                throw new ArgumentException("Project not found");

            var tasks = project.Tasks.ToList();
            if (startDate.HasValue)
                tasks = tasks.Where(t => t.CreatedAt >= startDate.Value).ToList();
            if (endDate.HasValue)
                tasks = tasks.Where(t => t.CreatedAt <= endDate.Value).ToList();

            var totalTasks = tasks.Count;
            var completedTasks = tasks.Count(t => t.Status == Models.Enums.TaskStatus.Completed);
            var inProgressTasks = tasks.Count(t => t.Status == Models.Enums.TaskStatus.InProgress);
            var pendingTasks = tasks.Count(t => t.Status == Models.Enums.TaskStatus.Pending);
            var overdueTasks = tasks.Count(t => t.DueDate < DateTime.UtcNow && t.Status != Models.Enums.TaskStatus.Completed);
            var highPriorityTasks = tasks.Count(t => t.Priority == TaskPriority.High || t.Priority == TaskPriority.Critical);
            var totalEstimatedHours = tasks.Sum(t => t.EstimatedHours ?? 0);
            var totalActualHours = (tasks.SelectMany(t => t.TimeLogs).Sum(tl => tl.DurationMinutes) ?? 0) / 60.0;

            return new ProjectReportDto
            {
                ProjectId = project.ProjectId,
                ProjectName = project.Name,
                ClientName = project.Company?.Name ?? "Unknown",
                StartDate = project.StartDate,
                EndDate = project.DueDate,
                TotalTasks = totalTasks,
                CompletedTasks = completedTasks,
                InProgressTasks = inProgressTasks,
                PendingTasks = pendingTasks,
                OverdueTasks = overdueTasks,
                HighPriorityTasks = highPriorityTasks,
                CompletionPercentage = totalTasks > 0 ? (double)completedTasks / totalTasks * 100 : 0,
                TotalEstimatedHours = totalEstimatedHours,
                TotalActualHours = (decimal)totalActualHours
            };
        }

        public async Task<ClientReportDto> GetClientReportAsync(int clientId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var client = await _context.Companies
                .Include(c => c.Projects)
                    .ThenInclude(p => p.Tasks)
                        .ThenInclude(t => t.TimeLogs)
                .FirstOrDefaultAsync(c => c.CompanyId == clientId);

            if (client == null)
                throw new ArgumentException("Client not found");

            var projects = client.Projects.AsQueryable();
            var allTasks = projects.SelectMany(p => p.Tasks).ToList();

            if (startDate.HasValue)
                allTasks = allTasks.Where(t => t.CreatedAt >= startDate.Value).ToList();
            if (endDate.HasValue)
                allTasks = allTasks.Where(t => t.CreatedAt <= endDate.Value).ToList();

            var totalTasks = allTasks.Count;
            var completedTasks = allTasks.Count(t => t.Status == Models.Enums.TaskStatus.Completed);
            var inProgressTasks = allTasks.Count(t => t.Status == Models.Enums.TaskStatus.InProgress);
            var pendingTasks = allTasks.Count(t => t.Status == Models.Enums.TaskStatus.Pending);
            var overdueTasks = allTasks.Count(t => t.DueDate < DateTime.UtcNow && t.Status != Models.Enums.TaskStatus.Completed);

            var totalEstimatedHours = allTasks.Sum(t => t.EstimatedHours ?? 0);
            var totalActualHours = (allTasks.SelectMany(t => t.TimeLogs).Sum(tl => tl.DurationMinutes) ?? 0) / 60.0;

            return new ClientReportDto
            {
                ClientId = client.CompanyId,
                ClientName = client.Name,
                CompanyName = client.Name,
                TotalProjects = projects.Count(),
                ActiveProjects = projects.Count(p => p.Status == ProjectStatus.Active),
                TotalTasks = totalTasks,
                CompletedTasks = completedTasks,
                InProgressTasks = inProgressTasks,
                PendingTasks = pendingTasks,
                OverdueTasks = overdueTasks,
                CompletionPercentage = totalTasks > 0 ? (double)completedTasks / totalTasks * 100 : 0,
                TotalEstimatedHours = totalEstimatedHours,
                TotalActualHours = (decimal)totalActualHours
            };
        }

        public async Task<UserPerformanceReportDto> GetUserPerformanceReportAsync(int userId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var user = await _context.Users
                .Include(u => u.AssignedTasks)
                    .ThenInclude(ta => ta.Task)
                        .ThenInclude(t => t.TimeLogs)
                .Include(u => u.AssignedTasks)
                    .ThenInclude(ta => ta.Task)
                        .ThenInclude(t => t.Project)
                .FirstOrDefaultAsync(u => u.UserId == userId);

            if (user == null)
                throw new ArgumentException("User not found");

            var tasks = user.AssignedTasks.Select(ta => ta.Task).ToList();

            if (startDate.HasValue)
                tasks = tasks.Where(t => t.CreatedAt >= startDate.Value).ToList();
            if (endDate.HasValue)
                tasks = tasks.Where(t => t.CreatedAt <= endDate.Value).ToList();

            var totalTasks = tasks.Count;
            var completedTasks = tasks.Count(t => t.Status == Models.Enums.TaskStatus.Completed);
            var inProgressTasks = tasks.Count(t => t.Status == Models.Enums.TaskStatus.InProgress);
            var overdueTasks = tasks.Count(t => t.DueDate < DateTime.UtcNow && t.Status != Models.Enums.TaskStatus.Completed);

            var totalHoursLogged = tasks.SelectMany(t => t.TimeLogs).Where(tl => tl.UserId == userId).Sum(tl => tl.DurationMinutes ?? 0) / 60.0;
            var projectsWorkedOn = tasks.Select(t => t.ProjectId).Distinct().Count();

            return new UserPerformanceReportDto
            {
                UserId = user.UserId,
                UserName = user.FullName,
                UserEmail = user.Email,
                TotalTasksAssigned = totalTasks,
                CompletedTasks = completedTasks,
                InProgressTasks = inProgressTasks,
                OverdueTasks = overdueTasks,
                CompletionRate = totalTasks > 0 ? (double)completedTasks / totalTasks * 100 : 0,
                TotalHoursLogged = totalHoursLogged,
                ProjectsWorkedOn = projectsWorkedOn,
                AverageTaskCompletionDays = 0
            };
        }

        public async Task<DepartmentReportDto> GetDepartmentReportAsync(int departmentId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var department = await _context.Departments
                .Include(d => d.Users)
                    .ThenInclude(u => u.AssignedTasks)
                        .ThenInclude(ta => ta.Task)
                .FirstOrDefaultAsync(d => d.DeptId == departmentId);

            if (department == null)
                throw new ArgumentException("Department not found");

            var allTasks = department.Users
                .SelectMany(u => u.AssignedTasks.Select(ta => ta.Task))
                .Distinct()
                .ToList();

            if (startDate.HasValue)
                allTasks = allTasks.Where(t => t.CreatedAt >= startDate.Value).ToList();
            if (endDate.HasValue)
                allTasks = allTasks.Where(t => t.CreatedAt <= endDate.Value).ToList();

            var totalTasks = allTasks.Count;
            var completedTasks = allTasks.Count(t => t.Status == Models.Enums.TaskStatus.Completed);
            var inProgressTasks = allTasks.Count(t => t.Status == Models.Enums.TaskStatus.InProgress);
            var overdueTasks = allTasks.Count(t => t.DueDate < DateTime.UtcNow && t.Status != Models.Enums.TaskStatus.Completed);
            var productivityScore = totalTasks > 0 ? (double)completedTasks / totalTasks * 100 : 0;

            var topPerformers = department.Users
                .Select(u => new
                {
                    u.FullName,
                    Completed = u.AssignedTasks.Count(ta => ta.Task.Status == Models.Enums.TaskStatus.Completed)
                })
                .OrderByDescending(u => u.Completed)
                .Take(5)
                .Select(u => u.FullName)
                .ToList();

            return new DepartmentReportDto
            {
                DepartmentId = department.DeptId,
                DepartmentName = department.Name,
                TotalEmployees = department.Users.Count,
                TotalTasks = totalTasks,
                CompletedTasks = completedTasks,
                InProgressTasks = inProgressTasks,
                OverdueTasks = overdueTasks,
                ProductivityScore = productivityScore,
                TopPerformers = topPerformers
            };
        }

        public async Task<SystemOverviewReportDto> GetSystemOverviewReportAsync(DateTime? startDate = null, DateTime? endDate = null)
        {
            var tasksQuery = _context.Tasks.AsQueryable();
            if (startDate.HasValue)
                tasksQuery = tasksQuery.Where(t => t.CreatedAt >= startDate.Value);
            if (endDate.HasValue)
                tasksQuery = tasksQuery.Where(t => t.CreatedAt <= endDate.Value);

            var totalUsers = await _context.Users.CountAsync();
            var activeUsers = await _context.Users.CountAsync(u => u.IsActive);
            var totalProjects = await _context.Projects.CountAsync();
            var activeProjects = await _context.Projects.CountAsync(p => p.Status == ProjectStatus.Active);
            var totalTasks = await tasksQuery.CountAsync();
            var completedTasks = await tasksQuery.CountAsync(t => t.Status == Models.Enums.TaskStatus.Completed);
            var inProgressTasks = await tasksQuery.CountAsync(t => t.Status == Models.Enums.TaskStatus.InProgress);
            var overdueTasks = await tasksQuery.CountAsync(t => t.DueDate < DateTime.UtcNow && t.Status != Models.Enums.TaskStatus.Completed);
            var totalDepartments = await _context.Departments.CountAsync();

            return new SystemOverviewReportDto
            {
                TotalUsers = totalUsers,
                ActiveUsers = activeUsers,
                TotalProjects = totalProjects,
                ActiveProjects = activeProjects,
                TotalTasks = totalTasks,
                CompletedTasks = completedTasks,
                InProgressTasks = inProgressTasks,
                OverdueTasks = overdueTasks,
                OverallProductivity = totalTasks > 0 ? (double)completedTasks / totalTasks * 100 : 0,
                TotalDepartments = totalDepartments
            };
        }

        public async Task<byte[]> ExportProjectReportToCsvAsync(int projectId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var report = await GetProjectReportAsync(projectId, startDate, endDate);
            var sb = new StringBuilder();
            sb.AppendLine("Field,Value");
            sb.AppendLine($"Project ID,{report.ProjectId}");
            sb.AppendLine($"Project Name,\"{report.ProjectName}\"");
            sb.AppendLine($"Client Name,\"{report.ClientName}\"");
            sb.AppendLine($"Start Date,{report.StartDate}");
            sb.AppendLine($"End Date,{report.EndDate}");
            sb.AppendLine($"Total Tasks,{report.TotalTasks}");
            sb.AppendLine($"Completed Tasks,{report.CompletedTasks}");
            sb.AppendLine($"In Progress Tasks,{report.InProgressTasks}");
            sb.AppendLine($"Pending Tasks,{report.PendingTasks}");
            sb.AppendLine($"Overdue Tasks,{report.OverdueTasks}");
            sb.AppendLine($"High Priority Tasks,{report.HighPriorityTasks}");
            sb.AppendLine($"Completion %,{report.CompletionPercentage:F1}");
            sb.AppendLine($"Estimated Hours,{report.TotalEstimatedHours}");
            sb.AppendLine($"Actual Hours,{report.TotalActualHours}");
            return Encoding.UTF8.GetBytes(sb.ToString());
        }

        public async Task<byte[]> ExportUserPerformanceReportToCsvAsync(int userId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var report = await GetUserPerformanceReportAsync(userId, startDate, endDate);
            var sb = new StringBuilder();
            sb.AppendLine("Field,Value");
            sb.AppendLine($"User ID,{report.UserId}");
            sb.AppendLine($"User Name,\"{report.UserName}\"");
            sb.AppendLine($"Email,\"{report.UserEmail}\"");
            sb.AppendLine($"Total Tasks Assigned,{report.TotalTasksAssigned}");
            sb.AppendLine($"Completed Tasks,{report.CompletedTasks}");
            sb.AppendLine($"In Progress Tasks,{report.InProgressTasks}");
            sb.AppendLine($"Overdue Tasks,{report.OverdueTasks}");
            sb.AppendLine($"Completion Rate,{report.CompletionRate:F1}%");
            sb.AppendLine($"Total Hours Logged,{report.TotalHoursLogged:F1}");
            sb.AppendLine($"Projects Worked On,{report.ProjectsWorkedOn}");
            return Encoding.UTF8.GetBytes(sb.ToString());
        }

        public async Task<IEnumerable<TaskProductivityDto>> GetTaskProductivityReportAsync(DateTime? startDate = null, DateTime? endDate = null)
        {
            var query = _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Assignees).ThenInclude(a => a.User)
                .Include(t => t.TimeLogs)
                .AsQueryable();

            if (startDate.HasValue)
                query = query.Where(t => t.CreatedAt >= startDate.Value);
            if (endDate.HasValue)
                query = query.Where(t => t.CreatedAt <= endDate.Value);

            var tasks = await query.Take(200).ToListAsync();

            return tasks.Select(t =>
            {
                var estimatedHours = t.EstimatedHours ?? 0;
                var actualMinutes = t.TimeLogs.Sum(tl => tl.DurationMinutes) ?? 0;
                var actualHours = actualMinutes / 60.0;
                var efficiency = estimatedHours > 0 && actualHours > 0 ? estimatedHours / (decimal)actualHours : 0;

                return new TaskProductivityDto
                {
                    TaskId = t.TaskId,
                    Title = t.Title,
                    ProjectName = t.Project?.Name ?? "Unknown",
                    AssignedUserName = t.Assignees.FirstOrDefault()?.User?.FullName ?? "Unassigned",
                    StatusName = t.Status.ToString(),
                    PriorityLevel = t.Priority.ToString(),
                    EstimatedHours = estimatedHours,
                    ActualHours = (decimal)actualHours,
                    EfficiencyRatio = (double)efficiency,
                    DaysToComplete = t.DueDate.HasValue ? (int)(t.DueDate.Value - t.CreatedAt).TotalDays : 0,
                    IsOverdue = t.DueDate < DateTime.UtcNow && t.Status != Models.Enums.TaskStatus.Completed
                };
            });
        }

        public async Task<IEnumerable<TimeTrackingReportDto>> GetTimeTrackingReportAsync(int? userId = null, int? projectId = null, DateTime? startDate = null, DateTime? endDate = null)
        {
            var query = _context.TimeLogs
                .Include(tl => tl.User)
                .Include(tl => tl.Task)
                    .ThenInclude(t => t.Project)
                .AsQueryable();

            if (userId.HasValue)
                query = query.Where(tl => tl.UserId == userId.Value);
            if (projectId.HasValue)
                query = query.Where(tl => tl.Task.ProjectId == projectId.Value);
            if (startDate.HasValue)
                query = query.Where(tl => tl.StartTime >= startDate.Value);
            if (endDate.HasValue)
                query = query.Where(tl => tl.StartTime <= endDate.Value);

            var logs = await query
                .OrderByDescending(tl => tl.StartTime)
                .Take(500)
                .ToListAsync();

            return logs.Select(tl => new TimeTrackingReportDto
            {
                TimeLogId = tl.LogId,
                UserName = tl.User?.FullName ?? "Unknown",
                TaskTitle = tl.Task?.Title ?? "Unknown",
                ProjectName = tl.Task?.Project?.Name ?? "Unknown",
                StartTime = tl.StartTime,
                EndTime = tl.EndTime,
                DurationHours = (tl.DurationMinutes ?? 0) / 60.0,
                Description = tl.Description,
                IsBillable = false
            });
        }
    }
}
