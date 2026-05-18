using BarqTMS.API.Models.Enums;
using Microsoft.AspNetCore.Mvc;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LookupsController : ControllerBase
    {
        [HttpGet("priorities")]
        public IActionResult GetPriorities()
        {
            var priorities = Enum.GetValues(typeof(TaskPriority))
                .Cast<TaskPriority>()
                .Select(p => new { PriorityId = (int)p, PriorityLevel = p.ToString() })
                .ToList();
            return Ok(priorities);
        }

        [HttpGet("statuses")]
        public IActionResult GetStatuses()
        {
            var statuses = Enum.GetValues(typeof(BarqTMS.API.Models.Enums.TaskStatus))
                .Cast<BarqTMS.API.Models.Enums.TaskStatus>()
                .Select(s => new { StatusId = (int)s, StatusName = s.ToString() })
                .ToList();
            return Ok(statuses);
        }
    }
}
