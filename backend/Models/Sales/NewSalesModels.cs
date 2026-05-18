using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using BarqTMS.API.Models;

namespace BarqTMS.API.Models.Sales
{
    // Requirement 2: The "Sales Targets" (KPI Model)
    public class SalesTarget
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public int TeamLeaderId { get; set; }
        
        [Required]
        public DateTime Month { get; set; } // Points to the 1st of the month

        public int TargetClients { get; set; } = 0;
        public int TargetMeetings { get; set; } = 0;
        public int TargetData { get; set; } = 0;

        [ForeignKey("TeamLeaderId")]
        public virtual User TeamLeader { get; set; } = null!;
    }

    // Requirement 3A: "Weekly War Room" (Strategy)
    public class WeeklyWarRoom
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CreatedByUserId { get; set; } 

        [Required]
        public DateTime WeekStartDate { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty; // Rich Text Note

        public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("CreatedByUserId")]
        public virtual User CreatedBy { get; set; } = null!;
    }

    // Requirement 3B: "Market Map" (Territory Management)
    public class MarketSegment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Place { get; set; } = string.Empty; // e.g. "Maadi"

        [Required]
        [StringLength(100)]
        public string Category { get; set; } = string.Empty; // e.g. "Real Estate"

        [Required]
        public string Status { get; set; } = "Open"; // Open, Targeted, Completed
        
        public int TeamLeaderId { get; set; }

        public DateTime LastModified { get; set; } = DateTime.UtcNow;
    }
}
