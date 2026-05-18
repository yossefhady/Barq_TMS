using System;
using System.ComponentModel.DataAnnotations;

namespace BarqTMS.API.Models
{
    public class WeeklyStrategy
    {
        public int Id { get; set; }
        public DateTime WeekStartDate { get; set; }
        [Required]
        public string Content { get; set; } = string.Empty;
        public int DepartmentId { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
