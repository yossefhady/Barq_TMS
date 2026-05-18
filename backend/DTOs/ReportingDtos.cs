namespace BarqTMS.API.DTOs
{
    public class ProjectReportDto
    {
        public int ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public string ClientName { get; set; } = string.Empty;
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public int InProgressTasks { get; set; }
        public int PendingTasks { get; set; }
        public int OverdueTasks { get; set; }
        public int HighPriorityTasks { get; set; }
        public double CompletionPercentage { get; set; }
        public decimal TotalEstimatedHours { get; set; }
        public decimal TotalActualHours { get; set; }
    }

    public class UserPerformanceReportDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
        public int TotalTasksAssigned { get; set; }
        public int CompletedTasks { get; set; }
        public int InProgressTasks { get; set; }
        public int OverdueTasks { get; set; }
        public double CompletionRate { get; set; }
        public double TotalHoursLogged { get; set; }
        public int ProjectsWorkedOn { get; set; }
        public double AverageTaskCompletionDays { get; set; }
    }

    public class DepartmentReportDto
    {
        public int DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public int TotalEmployees { get; set; }
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public int InProgressTasks { get; set; }
        public int OverdueTasks { get; set; }
        public double ProductivityScore { get; set; }
        public List<string> TopPerformers { get; set; } = new List<string>();
    }

    public class SystemOverviewReportDto
    {
        public int TotalUsers { get; set; }
        public int ActiveUsers { get; set; }
        public int TotalProjects { get; set; }
        public int ActiveProjects { get; set; }
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public int InProgressTasks { get; set; }
        public int OverdueTasks { get; set; }
        public double OverallProductivity { get; set; }
        public int TotalDepartments { get; set; }
    }

    public class TaskProductivityDto
    {
        public int TaskId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string ProjectName { get; set; } = string.Empty;
        public string AssignedUserName { get; set; } = string.Empty;
        public string StatusName { get; set; } = string.Empty;
        public string PriorityLevel { get; set; } = string.Empty;
        public decimal EstimatedHours { get; set; }
        public decimal ActualHours { get; set; }
        public double EfficiencyRatio { get; set; }
        public int DaysToComplete { get; set; }
        public bool IsOverdue { get; set; }
    }

    public class TimeTrackingReportDto
    {
        public int TimeLogId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string TaskTitle { get; set; } = string.Empty;
        public string ProjectName { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public double DurationHours { get; set; }
        public string? Description { get; set; }
        public bool IsBillable { get; set; }
    }

    public class ClientReportDto
    {
        public int ClientId { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public int TotalProjects { get; set; }
        public int ActiveProjects { get; set; }
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public int InProgressTasks { get; set; }
        public int PendingTasks { get; set; }
        public int OverdueTasks { get; set; }
        public double CompletionPercentage { get; set; }
        public decimal TotalEstimatedHours { get; set; }
        public decimal TotalActualHours { get; set; }
    }

    public class DashboardStatsDto
    {
        public int TotalTasks { get; set; }
        public int TotalProjects { get; set; }
        public int TotalUsers { get; set; }
        public int TotalClients { get; set; }
    }
}