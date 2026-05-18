using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BarqTMS.API.Services;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Helpers;

namespace BarqTMS.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportingController : ControllerBase
    {
        private readonly IReportingService _reportingService;
        private readonly ILogger<ReportingController> _logger;

        public ReportingController(IReportingService reportingService, ILogger<ReportingController> logger)
        {
            _reportingService = reportingService;
            _logger = logger;
        }

        [HttpGet("employee/{userId}")]
        [Authorize(Roles = "Manager,AssistantManager")]
        public async Task<ActionResult<UserPerformanceReportDto>> GetEmployeeReport(int userId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                var report = await _reportingService.GetUserPerformanceReportAsync(userId, startDate, endDate);
                return Ok(report);
            }
            catch (ArgumentException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating employee report");
                return StatusCode(500, "An error occurred while generating the report");
            }
        }

        [HttpGet("client/{clientId}")]
        [Authorize(Roles = "Manager,AssistantManager")]
        public async Task<ActionResult<ClientReportDto>> GetClientReport(int clientId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                var report = await _reportingService.GetClientReportAsync(clientId, startDate, endDate);
                return Ok(report);
            }
            catch (ArgumentException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating client report");
                return StatusCode(500, "An error occurred while generating the report");
            }
        }
    }
}
