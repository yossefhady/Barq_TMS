using BarqTMS.API.Models;
using BarqTMS.API.Models.Sales;

namespace BarqTMS.API.DTOs
{
    public class CreateSalesTeamLeaderDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public List<int> ManagedEmployeeIds { get; set; } = new List<int>();
        public List<int> DepartmentIds { get; set; } = new List<int>();
        public int Role { get; set; }
    }

    public class TeamLeaderSalesSummaryDto
    {
        public int TeamLeaderId { get; set; }
        public string TeamLeaderName { get; set; } = string.Empty;
        public int TargetClients { get; set; }
        public int ActualClients { get; set; }
        public int TargetMeetings { get; set; }
        public int ActualMeetings { get; set; }
        public int TargetData { get; set; }
        public int ActualData { get; set; }
    }

    public class AssignSalesTargetDto
    {
        public int TeamLeaderId { get; set; }
        public int TargetMonth { get; set; } // 1-12
        public int TargetYear { get; set; }
        public int TargetClients { get; set; }
        public int TargetMeetings { get; set; }
        public int TargetData { get; set; }
    }

    public class UpdateTaskKpiDto
    {
        public int TaskId { get; set; }
        public bool IsApproved { get; set; } // If true -> Completed, if false -> Back to InProgress
        public decimal? FinalValue { get; set; } // Required if Approved
        public string? RejectionReason { get; set; }
    }

    public class SalesDashboardStatsDto
    {
        public int ActualClients { get; set; }
        public int TargetClients { get; set; }
        public int ActualMeetings { get; set; }
        public int TargetMeetings { get; set; }
        public int ActualData { get; set; }
        public int TargetData { get; set; }
        public decimal ProgressPercentage { get; set; }
    }

    public class MarketSegmentDto
    {
        public int Id { get; set; }
        public string Place { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Status { get; set; } = "Open";
    }

    public class CreateWarRoomStrategyDto
    {
        public string Content { get; set; } = string.Empty;
    }

    public class CreateMarketSegmentDto
    {
        public string Place { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Status { get; set; } = "Open";
    }

    public class UpdateMarketSegmentStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }
}
