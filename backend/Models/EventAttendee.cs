using System.ComponentModel.DataAnnotations.Schema;

namespace BarqTMS.API.Models
{
    public class EventAttendee
    {
        public int EventId { get; set; }
        public int UserId { get; set; }

        [ForeignKey("EventId")]
        public virtual CalendarEvent Event { get; set; } = null!;

        [ForeignKey("UserId")]
        public virtual User User { get; set; } = null!;
    }
}
