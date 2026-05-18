using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using BarqTMS.API.Data;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Services;
using BarqTMS.API.DTOs;
using System.Security.Claims;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FilesController : ControllerBase
    {
        private readonly BarqTMSDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;

        public FilesController(BarqTMSDbContext context, IConfiguration configuration, IWebHostEnvironment env)
        {
            _context = context;
            _configuration = configuration;
            _env = env;
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        }

        private UserRole GetCurrentUserRole()
        {
            return Enum.Parse<UserRole>(User.FindFirstValue(ClaimTypes.Role) ?? "Employee");
        }

        // POST /api/Files/upload/{taskId}
        [HttpPost("upload/{taskId}")]
        [RequestSizeLimit(10_485_760)] // 10 MB
        public async Task<IActionResult> Upload(int taskId, IFormFile file)
        {
            var task = await _context.Tasks.FindAsync(taskId);
            if (task == null) return NotFound("Task not found");

            // CRIT-06: Only users related to the task may upload.
            var callerId = GetCurrentUserId();
            var callerRole = GetCurrentUserRole();
            if (!await TaskAccessPolicy.CanAccessTaskFilesAsync(_context, taskId, callerId, callerRole))
            {
                return Forbid();
            }

            var allowedExtensions = _configuration.GetSection("FileStorage:AllowedExtensions").Get<string[]>()
                ?? new[] { ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".jpg", ".jpeg", ".png", ".gif", ".zip", ".rar" };

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest($"File type '{extension}' is not allowed");

            var uploadsDir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", taskId.ToString());
            Directory.CreateDirectory(uploadsDir);

            var safeFileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsDir, safeFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var userId = GetCurrentUserId();
            var attachment = new Attachment
            {
                FileName = file.FileName,
                FilePath = $"/uploads/{taskId}/{safeFileName}",
                FileType = extension,
                FileSize = file.Length,
                UploadedBy = userId,
                UploadedAt = DateTime.UtcNow,
                RelatedEntityType = RelatedEntityType.Task,
                RelatedEntityId = taskId,
            };

            _context.Attachments.Add(attachment);
            await _context.SaveChangesAsync();

            return Ok(new AttachmentDto
            {
                FileId = attachment.AttachmentId,
                TaskId = taskId,
                FileName = attachment.FileName,
                FileUrl = attachment.FilePath,
                UploadedBy = userId,
                UploadedByName = (await _context.Users.FindAsync(userId))?.FullName ?? "Unknown",
                UploadedAt = attachment.UploadedAt,
            });
        }

        // GET /api/Files/download/{fileId}
        [HttpGet("download/{fileId}")]
        public async Task<IActionResult> Download(int fileId)
        {
            var attachment = await _context.Attachments.FindAsync(fileId);
            if (attachment == null) return NotFound();

            // CRIT-06: Only users related to the task may download its files.
            if (attachment.RelatedEntityType == RelatedEntityType.Task)
            {
                var callerId = GetCurrentUserId();
                var callerRole = GetCurrentUserRole();
                if (!await TaskAccessPolicy.CanAccessTaskFilesAsync(_context, attachment.RelatedEntityId, callerId, callerRole))
                {
                    return Forbid();
                }
            }

            var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", attachment.FilePath.TrimStart('/'));
            if (!System.IO.File.Exists(filePath))
                return NotFound("File not found on disk");

            var contentType = attachment.FileType switch
            {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".txt" => "text/plain",
                ".zip" => "application/zip",
                _ => "application/octet-stream"
            };

            return PhysicalFile(filePath, contentType, attachment.FileName);
        }

        // DELETE /api/Files/{fileId}
        [HttpDelete("{fileId}")]
        public async Task<IActionResult> Delete(int fileId)
        {
            var attachment = await _context.Attachments.FindAsync(fileId);
            if (attachment == null) return NotFound();

            var userId = GetCurrentUserId();
            var callerRole = GetCurrentUserRole();

            // CRIT-06: Uploader OR Manager/AssistantManager may delete. Plus the user must still
            // have task-file access (covers the case where they were removed from the task).
            bool isUploader = attachment.UploadedBy == userId;
            bool isOverride = callerRole == UserRole.Manager || callerRole == UserRole.AssistantManager;
            if (!isUploader && !isOverride) return Forbid();

            if (attachment.RelatedEntityType == RelatedEntityType.Task)
            {
                if (!await TaskAccessPolicy.CanAccessTaskFilesAsync(_context, attachment.RelatedEntityId, userId, callerRole))
                {
                    return Forbid();
                }
            }

            // Delete physical file
            var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", attachment.FilePath.TrimStart('/'));
            if (System.IO.File.Exists(filePath))
                System.IO.File.Delete(filePath);

            _context.Attachments.Remove(attachment);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}
