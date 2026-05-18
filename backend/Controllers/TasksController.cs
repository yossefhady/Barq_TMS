using Microsoft.AspNetCore.Mvc;
using BarqTMS.API.Services;
using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TasksController : ControllerBase
    {
        private readonly ITaskService _taskService;
        private readonly BarqTMSDbContext _context;

        public TasksController(ITaskService taskService, BarqTMSDbContext context)
        {
            _taskService = taskService;
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TaskListDto>>> GetAllTasks()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = Enum.Parse<UserRole>(User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee");
            
            var tasks = await _taskService.GetAllTasksAsync(userId, role);
            return Ok(tasks);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TaskDto>> GetTask(int id)
        {
            var task = await _taskService.GetTaskByIdAsync(id);
            if (task == null)
            {
                return NotFound();
            }
            return Ok(task);
        }

        [HttpPost]
        public async Task<ActionResult<TaskDto>> CreateTask(CreateTaskDto createTaskDto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            try
            {
                var task = await _taskService.CreateTaskAsync(createTaskDto, userId);
                return CreatedAtAction(nameof(GetTask), new { id = task.TaskId }, task);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<TaskDto>> UpdateTask(int id, UpdateTaskDto updateTaskDto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = Enum.Parse<UserRole>(User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee");
            try
            {
                var task = await _taskService.UpdateTaskAsync(id, updateTaskDto, userId, role);
                if (task == null)
                {
                    return NotFound();
                }
                return Ok(task);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Manager,AssistantManager,TeamLeader")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            // MED-03: Manager/AsstMgr may delete anything. TL may delete a task they originally
            // assigned ONLY while it is still Pending — once work has started, deletion would
            // destroy audit trail and is no longer allowed.
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = Enum.Parse<UserRole>(User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee");
            try
            {
                var result = await _taskService.DeleteTaskAsync(id, userId, role);
                if (!result) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateTaskStatus(int id, UpdateTaskStatusDto statusDto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _taskService.UpdateTaskStatusAsync(id, statusDto, userId);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }

        [HttpGet("{id}/comments")]
        public async Task<ActionResult<IEnumerable<TaskCommentDto>>> GetTaskComments(int id)
        {
            var comments = await _taskService.GetTaskCommentsAsync(id);
            return Ok(comments);
        }

        [HttpPost("{id}/comments")]
        public async Task<ActionResult<TaskCommentDto>> AddTaskComment(int id, CreateTaskCommentDto commentDto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var comment = await _taskService.AddTaskCommentAsync(id, commentDto, userId);
            return Ok(comment);
        }
        [HttpPut("{id}/request-complete")]
        public async Task<IActionResult> RequestComplete(int id, [FromBody] RequestCompleteDto? dto = null)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            try
            {
                var result = await _taskService.RequestCompleteAsync(id, userId, dto?.Note, dto?.FinalKpiValue);
                if (!result) return NotFound();
                return Ok(new { message = "Task completion requested" });
            }
            catch (ArgumentException ex) // Catch Validation Errors
            {
                 return BadRequest(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}/review-completion")]
        [Authorize(Roles = "Manager,AssistantManager,TeamLeader,AccountManager")]
        public async Task<IActionResult> ReviewCompletion(int id, ReviewTaskCompletionDto reviewDto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = Enum.Parse<UserRole>(User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee");
            try
            {
                var result = await _taskService.ReviewCompletionAsync(id, reviewDto, userId, role);
                if (!result) return NotFound();
                return Ok(new { message = "Review submitted" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}/pass")]
        [Authorize(Roles = "Manager,AssistantManager,TeamLeader,AccountManager")]
        public async Task<IActionResult> PassTask(int id, PassTaskDto passDto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = Enum.Parse<UserRole>(User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee");
            try
            {
                var result = await _taskService.PassTaskAsync(id, passDto.AssignToUserId, passDto.Notes, userId, role);
                if (!result) return NotFound();
                return Ok(new { message = "Task passed successfully" });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // MED-05: Reopen a completed task. Original assigner only, or Manager / AsstMgr.
        public sealed class ReopenTaskDto
        {
            public string? Reason { get; set; }
        }

        [HttpPut("{id}/reopen")]
        [Authorize(Roles = "Manager,AssistantManager,TeamLeader,AccountManager")]
        public async Task<IActionResult> ReopenTask(int id, [FromBody] ReopenTaskDto? dto = null)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = Enum.Parse<UserRole>(User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee");
            try
            {
                var result = await _taskService.ReopenTaskAsync(id, userId, role, dto?.Reason);
                if (!result) return NotFound();
                return Ok(new { message = "Task reopened" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id}/latest-decline-comment")]
        public async Task<IActionResult> GetLatestDeclineComment(int id)
        {
            var comment = await _context.TaskComments
                .Include(c => c.Author)
                .Where(c => c.TaskId == id && c.Content.Contains("Rejected"))
                .OrderByDescending(c => c.CreatedAt)
                .FirstOrDefaultAsync();

            if (comment == null) return Ok(new { comment = (string?)null });

            return Ok(new TaskCommentDto
            {
                CommentId = comment.CommentId,
                TaskId = comment.TaskId,
                UserId = comment.UserId,
                UserName = comment.Author?.FullName ?? "Unknown",
                Comment = comment.Content,
                CreatedAt = comment.CreatedAt
            });
        }
    }
}
