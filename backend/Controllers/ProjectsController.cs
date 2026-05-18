using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BarqTMS.API.Services;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models.Enums;
using System.Security.Claims;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ProjectsController : ControllerBase
    {
        private readonly IProjectService _projectService;

        public ProjectsController(IProjectService projectService)
        {
            _projectService = projectService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProjectDto>>> GetAll()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var roleString = User.FindFirst(ClaimTypes.Role)?.Value;
            var role = Enum.TryParse<UserRole>(roleString, out var parsedRole) ? parsedRole : UserRole.Employee;

            var projects = await _projectService.GetAllProjectsAsync(userId, role);
            return Ok(projects);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ProjectDto>> GetById(int id)
        {
            var project = await _projectService.GetProjectByIdAsync(id);
            if (project == null) return NotFound();
            return Ok(project);
        }

        [HttpPost]
        [Authorize(Roles = "Manager,AssistantManager")]
        public async Task<ActionResult<ProjectDto>> Create(CreateProjectDto createDto)
        {
            var project = await _projectService.CreateProjectAsync(createDto);
            return CreatedAtAction(nameof(GetById), new { id = project.ProjectId }, project);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Manager,AssistantManager")]
        public async Task<ActionResult<ProjectDto>> Update(int id, UpdateProjectDto updateDto)
        {
            try
            {
                var project = await _projectService.UpdateProjectAsync(id, updateDto);
                if (project == null) return NotFound();
                return Ok(project);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Manager,AssistantManager")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var result = await _projectService.DeleteProjectAsync(id);
                if (!result) return NotFound();
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
