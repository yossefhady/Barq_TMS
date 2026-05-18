using Microsoft.AspNetCore.Mvc;

namespace BarqTMS.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetHealth()
        {
            return Ok(new
            {
                Status = "Healthy",
                Timestamp = DateTime.UtcNow,
                Version = "1.0.0",
                Service = "Barq Task Management System API"
            });
        }

        [HttpGet("info")]
        public IActionResult GetInfo()
        {
            return Ok(new
            {
                ApiName = "Barq TMS API",
                Version = "1.0.0",
                Environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
                Framework = ".NET 9",
                Features = new[]
                {
                    "User Management",
                    "Department Management", 
                    "Project Management",
                    "Task Management",
                    "Notifications",
                    "File Attachments",
                    "Audit Logging"
                }
            });
        }
    }
}