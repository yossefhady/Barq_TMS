using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;

namespace BarqTMS.API.Middleware
{
    public class GlobalExceptionHandler : IExceptionHandler
    {
        private readonly ILogger<GlobalExceptionHandler> _logger;
        private readonly IHostEnvironment _environment;

        public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment environment)
        {
            _logger = logger;
            _environment = environment;
        }

        public async ValueTask<bool> TryHandleAsync(
            HttpContext httpContext,
            Exception exception,
            CancellationToken cancellationToken)
        {
            var errorId = Guid.NewGuid().ToString();
            
            _logger.LogError(
                exception,
                "Error ID: {ErrorId} | Exception: {ExceptionType} | Message: {Message} | Path: {Path}",
                errorId,
                exception.GetType().Name,
                exception.Message,
                httpContext.Request.Path);

            var (statusCode, title, message) = MapExceptionToResponse(exception);

            var response = new ErrorResponse
            {
                ErrorId = errorId,
                Title = title,
                Message = message,
                StatusCode = statusCode,
                Timestamp = DateTime.UtcNow,
                Path = httpContext.Request.Path
            };

            // Include stack trace in development
            if (_environment.IsDevelopment())
            {
                response.StackTrace = exception.StackTrace;
                response.InnerException = exception.InnerException?.Message;
            }

            httpContext.Response.StatusCode = statusCode;
            httpContext.Response.ContentType = "application/json";

            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            await httpContext.Response.WriteAsync(
                JsonSerializer.Serialize(response, options),
                cancellationToken);

            return true;
        }

        private (int StatusCode, string Title, string Message) MapExceptionToResponse(Exception exception)
        {
            return exception switch
            {
                UnauthorizedAccessException => (
                    StatusCodes.Status401Unauthorized,
                    "Unauthorized",
                    "You are not authorized to perform this action."
                ),
                
                KeyNotFoundException => (
                    StatusCodes.Status404NotFound,
                    "Not Found",
                    exception.Message
                ),
                
                ArgumentException => (
                    StatusCodes.Status400BadRequest,
                    "Bad Request",
                    exception.Message
                ),
                
                InvalidOperationException => (
                    StatusCodes.Status400BadRequest,
                    "Invalid Operation",
                    exception.Message
                ),
                
                TimeoutException => (
                    StatusCodes.Status408RequestTimeout,
                    "Request Timeout",
                    "The request took too long to complete. Please try again."
                ),
                
                _ => (
                    StatusCodes.Status500InternalServerError,
                    "Internal Server Error",
                    "An unexpected error occurred. Please contact support if the problem persists."
                )
            };
        }
    }

    public class ErrorResponse
    {
        public string ErrorId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public int StatusCode { get; set; }
        public DateTime Timestamp { get; set; }
        public string Path { get; set; } = string.Empty;
        public string? StackTrace { get; set; }
        public string? InnerException { get; set; }
    }

    public static class GlobalExceptionHandlerExtensions
    {
        public static IServiceCollection AddGlobalExceptionHandler(this IServiceCollection services)
        {
            services.AddExceptionHandler<GlobalExceptionHandler>();
            services.AddProblemDetails();
            return services;
        }
    }
}
