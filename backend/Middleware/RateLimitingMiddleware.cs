using System.Collections.Concurrent;
using System.Net;

namespace BarqTMS.API.Middleware
{
    public class RateLimitingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IConfiguration _configuration;
        private readonly ILogger<RateLimitingMiddleware> _logger;
        private static readonly ConcurrentDictionary<string, ClientRateLimit> _clients = new();

        public RateLimitingMiddleware(RequestDelegate next, IConfiguration configuration, ILogger<RateLimitingMiddleware> logger)
        {
            _next = next;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var clientId = GetClientIdentifier(context);
            var endpoint = GetEndpointIdentifier(context);
            
            if (IsRateLimitExceeded(clientId, endpoint))
            {
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                await context.Response.WriteAsync("Rate limit exceeded. Please try again later.");
                return;
            }

            await _next(context);
        }

        private string GetClientIdentifier(HttpContext context)
        {
            // Try to get client IP address
            var clientIp = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrEmpty(clientIp))
            {
                return clientIp.Split(',')[0].Trim();
            }

            clientIp = context.Request.Headers["X-Real-IP"].FirstOrDefault();
            if (!string.IsNullOrEmpty(clientIp))
            {
                return clientIp;
            }

            return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        }

        private string GetEndpointIdentifier(HttpContext context)
        {
            return $"{context.Request.Method}:{context.Request.Path}";
        }

        private bool IsRateLimitExceeded(string clientId, string endpoint)
        {
            var key = $"{clientId}:{endpoint}";
            var now = DateTime.UtcNow;

            // Get rate limit configuration
            var generalLimit = _configuration.GetValue("RateLimit:General:RequestsPerMinute", 60);
            var authLimit = _configuration.GetValue("RateLimit:Auth:RequestsPerMinute", 10);
            var uploadLimit = _configuration.GetValue("RateLimit:Upload:RequestsPerMinute", 5);

            var limit = endpoint.Contains("/auth/") ? authLimit :
                       endpoint.Contains("/files/upload") ? uploadLimit :
                       generalLimit;

            var timeWindow = TimeSpan.FromMinutes(1);

            _clients.TryGetValue(key, out var clientLimit);
            if (clientLimit == null)
            {
                clientLimit = new ClientRateLimit();
                _clients[key] = clientLimit;
            }

            // Clean old requests
            clientLimit.Requests.RemoveAll(r => now - r > timeWindow);

            if (clientLimit.Requests.Count >= limit)
            {
                _logger.LogWarning("Rate limit exceeded for client {ClientId} on endpoint {Endpoint}", clientId, endpoint);
                return true;
            }

            clientLimit.Requests.Add(now);
            return false;
        }
    }

    public class ClientRateLimit
    {
        public List<DateTime> Requests { get; set; } = new List<DateTime>();
    }
}