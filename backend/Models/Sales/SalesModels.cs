using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using BarqTMS.API.Models;

namespace BarqTMS.API.Models.Sales
{
    // Requirement 1: Monthly Targets
    public class SalesMonthlyTarget
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public int TeamLeaderId { get; set; } // The Sales TL user ID
        
        [Required]
        public DateTime TargetMonth { get; set; } // Usually first day of the month

        public int TargetActualClients { get; set; } = 0;
        public int TargetMeetings { get; set; } = 0;
        public int TargetDataCollection { get; set; } = 0;

        [ForeignKey("TeamLeaderId")]
        public virtual User TeamLeader { get; set; } = null!;
    }

    // Requirement 3: Weekly Strategy Board
    public class SalesWeeklyStrategy
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CreatedByUserId { get; set; } // The TL who wrote it

        [Required]
        public DateTime WeekStartDate { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty; // Rich Text / HTML

        public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("CreatedByUserId")]
        public virtual User CreatedBy { get; set; } = null!;
    }

    // Requirement 4: Market Tracker
    public class MarketTerritory
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Location { get; set; } = string.Empty; // e.g., "Downtown"

        [Required]
        [StringLength(100)]
        public string Category { get; set; } = string.Empty; // e.g., "Pharmaceuticals"

        public TerritoryStatus Status { get; set; } = TerritoryStatus.Targeted;

        public DateTime? LastModified { get; set; }
    }

    public enum TerritoryStatus
    {
        Targeted = 0,
        Done = 1
    }
}
