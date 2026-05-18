using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Services
{
    public interface ICalendarService
    {
        Task<List<CalendarEventDto>> GetEventsAsync(int userId, CalendarFilterDto filter);
        Task<CalendarEventDto?> GetEventByIdAsync(int id);
        Task<CalendarEventDto> CreateEventAsync(int userId, CreateCalendarEventDto eventDto);
        Task<CalendarEventDto?> UpdateEventAsync(int id, int userId, UpdateCalendarEventDto eventDto, bool isAdmin = false);
        Task<bool> DeleteEventAsync(int id, int userId, bool isAdmin = false);
        Task<CalendarStatsDto> GetCalendarStatsAsync(int userId);
    }

    public class CalendarService : ICalendarService
    {
        private readonly BarqTMSDbContext _context;

        public CalendarService(BarqTMSDbContext context)
        {
            _context = context;
        }

        public async Task<List<CalendarEventDto>> GetEventsAsync(int userId, CalendarFilterDto filter)
        {
            var query = _context.CalendarEvents
                .Include(e => e.Attendees)
                .AsQueryable();

            // Filter by User permission (Created by me OR I am an attendee)
            // If user is admin (Id=1 usually), maybe show all? But safe default is private.
            if (userId != 0) 
            {
                query = query.Where(e => e.CreatedBy == userId || e.Attendees.Any(a => a.UserId == userId));
            }

            if (filter.StartDate.HasValue)
                query = query.Where(e => e.StartTime >= filter.StartDate.Value);

            if (filter.EndDate.HasValue)
                query = query.Where(e => e.EndTime <= filter.EndDate.Value);

            var events = await query.ToListAsync();
            var result = events.Select(MapToDto).ToList();

            // Fetch Tasks with Due Dates within range
            var tasksQuery = _context.Tasks.AsQueryable();
            
            // Filter tasks for this user (Assigned to me OR Created by me)
            if (userId != 0)
            {
                tasksQuery = tasksQuery.Where(t => t.AssignedTo == userId || t.CreatedBy == userId);
            }

            if (filter.StartDate.HasValue)
                tasksQuery = tasksQuery.Where(t => t.DueDate >= filter.StartDate.Value);
            if (filter.EndDate.HasValue)
                tasksQuery = tasksQuery.Where(t => t.DueDate <= filter.EndDate.Value);
            
            // Only include non-completed tasks? Or all tasks? Requirement says "Tasks... appear".
            // Let's include all.
            var tasks = await tasksQuery.ToListAsync();

            foreach(var t in tasks)
            {
               if (t.DueDate.HasValue) {
                   result.Add(new CalendarEventDto {
                       EventId = -t.TaskId, // Use negative ID to distinguish synthetic task events
                       Title = $"Task Due: {t.Title}",
                       Description = t.Description ?? "",
                       StartTime = t.DueDate.Value,
                       EndTime = t.DueDate.Value.AddHours(1), // Default 1 hour duration
                       EventType = Models.Enums.EventType.Task,
                       CreatedBy = t.OriginalAssignerId ?? 0,
                       RelatedTaskId = t.TaskId,
                       RelatedProjectId = t.ProjectId,
                       AttendeeIds = new List<int>() // Could add assignees here
                   });
               }
            }

            return result;
        }

        public async Task<CalendarEventDto?> GetEventByIdAsync(int id)
        {
            var evt = await _context.CalendarEvents
                .Include(e => e.Attendees)
                .FirstOrDefaultAsync(e => e.EventId == id);

            return evt == null ? null : MapToDto(evt);
        }

        public async Task<CalendarEventDto> CreateEventAsync(int userId, CreateCalendarEventDto eventDto)
        {
            var evt = new CalendarEvent
            {
                Title = eventDto.Title,
                Description = eventDto.Description,
                StartTime = eventDto.StartTime,
                EndTime = eventDto.EndTime,
                EventType = eventDto.EventType,
                CreatedBy = userId,
                RelatedProjectId = eventDto.RelatedProjectId,
                RelatedTaskId = eventDto.RelatedTaskId,
                RelatedCompanyId = eventDto.RelatedCompanyId
            };

            _context.CalendarEvents.Add(evt);
            await _context.SaveChangesAsync();

            if (eventDto.AttendeeIds != null && eventDto.AttendeeIds.Any())
            {
                foreach (var attendeeId in eventDto.AttendeeIds)
                {
                    _context.EventAttendees.Add(new EventAttendee
                    {
                        EventId = evt.EventId,
                        UserId = attendeeId,
                    });
                }
                await _context.SaveChangesAsync();
            }

            return MapToDto(evt);
        }

        public async Task<CalendarEventDto?> UpdateEventAsync(int id, int userId, UpdateCalendarEventDto eventDto, bool isAdmin = false)
        {
            var evt = await _context.CalendarEvents
                .Include(e => e.Attendees)
                .FirstOrDefaultAsync(e => e.EventId == id);

            if (evt == null) return null;

            // Permission check: Owner or Admin
            if (!isAdmin && evt.CreatedBy != userId)
            {
                // Return null to signify not found/not allowed (Controller handles 404/403 gap usually, here simplified)
                // Or I can throw Unauthorized, but null is safer for now to avoid crashing generic controllers if not catching.
                return null; 
            }

            if (eventDto.Title != null) evt.Title = eventDto.Title;
            if (eventDto.Description != null) evt.Description = eventDto.Description;
            if (eventDto.StartTime.HasValue) evt.StartTime = eventDto.StartTime.Value;
            if (eventDto.EndTime.HasValue) evt.EndTime = eventDto.EndTime.Value;
            if (eventDto.EventType.HasValue) evt.EventType = eventDto.EventType.Value;
            if (eventDto.RelatedProjectId.HasValue) evt.RelatedProjectId = eventDto.RelatedProjectId.Value;
            if (eventDto.RelatedTaskId.HasValue) evt.RelatedTaskId = eventDto.RelatedTaskId.Value;
            if (eventDto.RelatedCompanyId.HasValue) evt.RelatedCompanyId = eventDto.RelatedCompanyId.Value;

            if (eventDto.AttendeeIds != null)
            {
                _context.EventAttendees.RemoveRange(evt.Attendees);
                foreach (var attendeeId in eventDto.AttendeeIds)
                {
                    _context.EventAttendees.Add(new EventAttendee
                    {
                        EventId = evt.EventId,
                        UserId = attendeeId,
                    });
                }
            }

            await _context.SaveChangesAsync();
            return MapToDto(evt);
        }

        public async Task<bool> DeleteEventAsync(int id, int userId, bool isAdmin = false)
        {
            var evt = await _context.CalendarEvents.FindAsync(id);
            if (evt == null) return false;
            
            if (!isAdmin && evt.CreatedBy != userId) return false;

            _context.CalendarEvents.Remove(evt);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<CalendarStatsDto> GetCalendarStatsAsync(int userId)
        {
            var totalEvents = await _context.CalendarEvents.CountAsync(e => e.CreatedBy == userId || e.Attendees.Any(a => a.UserId == userId));
            return new CalendarStatsDto { TotalEvents = totalEvents };
        }

        private static CalendarEventDto MapToDto(CalendarEvent e)
        {
            return new CalendarEventDto
            {
                EventId = e.EventId,
                Title = e.Title,
                Description = e.Description,
                StartTime = e.StartTime,
                EndTime = e.EndTime,
                EventType = e.EventType,
                CreatedBy = e.CreatedBy,
                RelatedProjectId = e.RelatedProjectId,
                RelatedTaskId = e.RelatedTaskId,
                RelatedCompanyId = e.RelatedCompanyId,
                AttendeeIds = e.Attendees.Select(a => a.UserId).ToList()
            };
        }
    }
}
