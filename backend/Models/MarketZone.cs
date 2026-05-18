using System;
using System.ComponentModel.DataAnnotations;

namespace BarqTMS.API.Models
{
    public class MarketZone
    {
        public int Id { get; set; }
        
        [Required]
        public string ZoneName { get; set; } = string.Empty;
        
        [Required]
        public string Category { get; set; } = string.Empty; // e.g., "Retail", "Corporate"
        
        public string Status { get; set; } = "Open"; // Open, Targeted, In Progress, Completed
        
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
        public int UpdatedBy { get; set; }
    }
}
