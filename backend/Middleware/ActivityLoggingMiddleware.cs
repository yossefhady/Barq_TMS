using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;
using BarqTMS.API.Services;

namespace BarqTMS.API.Middleware
{
    public class ActivityLoggingMiddleware
    {
        private readonly RequestDelegate _next;

        public ActivityLoggingMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, IAuditService auditService)
        {
            await _next(context);
        }
    }

    public static class ActivityLoggingMiddlewareExtensions
    {
        public static IApplicationBuilder UseActivityLogging(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<ActivityLoggingMiddleware>();
        }
    }
}
