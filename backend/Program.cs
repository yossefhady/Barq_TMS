using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;
using BarqTMS.API.Data;
using BarqTMS.API.Services;
using BarqTMS.API.Middleware;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddDbContext<BarqTMSDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

    // SQL Server Configuration (Production - Detected from Connection String)
    options.UseSqlServer(connectionString, sqlOptions => 
    {
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(30),
            errorNumbersToAdd: null
        );
    });

    // MySQL Configuration (Commented Out)
    // options.UseMySql(connectionString, 
    //    ServerVersion.AutoDetect(connectionString),
    //    mysqlOptions => mysqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
});

// Add authentication
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
    ?? builder.Configuration["Jwt:SecretKey"]
    ?? "";
if (string.IsNullOrEmpty(jwtSecret) || jwtSecret.StartsWith("CHANGE_ME"))
    throw new InvalidOperationException("JWT secret key is not configured. Set the JWT_SECRET_KEY environment variable.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret))
        };

        // Allow SignalR connections to authenticate via the access_token query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                // If the request is for our SignalR hubs and contains an access token, use it
                if (!string.IsNullOrEmpty(accessToken) &&
                    (path.StartsWithSegments("/hubs/notifications") ||
                     path.StartsWithSegments("/hub/notifications") ||
                     path.StartsWithSegments("/notificationHub") ||
                     path.StartsWithSegments("/hubs/notificationHub")))
                {
                    context.Token = accessToken!;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Add global exception handler
builder.Services.AddGlobalExceptionHandler();

// Add services
builder.Services.AddScoped<BarqTMS.API.Services.AuthService>();
builder.Services.AddScoped<BarqTMS.API.Services.IAuditService, BarqTMS.API.Services.AuditService>();
builder.Services.AddScoped<BarqTMS.API.Services.IFileStorageService, BarqTMS.API.Services.LocalFileStorageService>();
builder.Services.AddScoped<BarqTMS.API.Services.IEmailService, BarqTMS.API.Services.EmailService>();
builder.Services.AddScoped<BarqTMS.API.Services.ISearchService, BarqTMS.API.Services.SearchService>();
builder.Services.AddScoped<BarqTMS.API.Services.IRealTimeService, BarqTMS.API.Services.RealTimeService>();
builder.Services.AddScoped<BarqTMS.API.Services.INotificationService, BarqTMS.API.Services.NotificationService>();
builder.Services.AddScoped<BarqTMS.API.Services.ICalendarService, BarqTMS.API.Services.CalendarService>();
builder.Services.AddScoped<BarqTMS.API.Services.IReportingService, BarqTMS.API.Services.ReportingService>();
builder.Services.AddScoped<BarqTMS.API.Services.ISecurityService, BarqTMS.API.Services.SecurityService>();
// Register user service
builder.Services.AddScoped<BarqTMS.API.Services.IUserService, BarqTMS.API.Services.UserService>();
// Register client service
builder.Services.AddScoped<BarqTMS.API.Services.IClientService, BarqTMS.API.Services.ClientService>();
// Register task service
builder.Services.AddScoped<BarqTMS.API.Services.ITaskService, BarqTMS.API.Services.TaskService>();
// Register project service
builder.Services.AddScoped<BarqTMS.API.Services.IProjectService, BarqTMS.API.Services.ProjectService>();
// Register department service
builder.Services.AddScoped<BarqTMS.API.Services.IDepartmentService, BarqTMS.API.Services.DepartmentService>();
// Register dashboard stats service (CRIT-07)
builder.Services.AddScoped<BarqTMS.API.Services.DashboardStatsService>();
// Register team performance service (HIGH-05)
builder.Services.AddScoped<BarqTMS.API.Services.TeamPerformanceService>();

// Register background services
builder.Services.AddHostedService<BarqTMS.API.Services.OverdueTaskNotificationService>();

// Add SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

// Add HTTP context accessor for audit service
builder.Services.AddHttpContextAccessor();

// Add controllers with JSON configuration to preserve PascalCase
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Keep PascalCase property names to match C# DTOs
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        
        // ✅ REMOVED JsonStringEnumConverter to return enums as NUMBERS
        // This fixes login issue - Frontend expects User.Role as NUMBER not STRING
        // options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Add Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
   c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
   {
       Title = "Barq Task Management System API",
       Version = "v1",
       Description = "A comprehensive task management system for organizations"
   });
});

builder.Services.AddOpenApi();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", builder =>
    {
        builder.SetIsOriginAllowed(origin => true) // Allow any origin
               .AllowAnyMethod()
               .AllowAnyHeader()
               .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
       c.SwaggerEndpoint("/swagger/v1/swagger.json", "Barq TMS API V1");
       c.RoutePrefix = string.Empty;
    });

    app.MapOpenApi();
    app.MapScalarApiReference();
}

// Only enforce HTTPS in non-dev
// if (!app.Environment.IsDevelopment())
// {
//     app.UseHttpsRedirection();
// }

app.UseCors("AllowFrontend");

// Add exception handling
app.UseExceptionHandler();

// Add activity logging middleware
app.UseActivityLogging();

// Add rate limiting middleware
app.UseMiddleware<BarqTMS.API.Middleware.RateLimitingMiddleware>();

// Configure static files (Frontend + Uploads)
// UseStaticFiles only (removed UseDefaultFiles to allow MapGet("/") to handle root)
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Map SignalR hub
app.MapHub<BarqTMS.API.Hubs.NotificationHub>("/hubs/notifications");

// Root URL Redirect (Better for Mobile)
app.MapGet("/", async context =>
{
    // Force absolute HTTP URL to prevent mobile browsers from upgrading to HTTPS
    var host = context.Request.Host.Value;
    context.Response.Redirect($"http://{host}/frontend/pages/auth/login.html");
    await Task.CompletedTask;
});

// FALLBACK: If no controller or file is found, serve index.html
app.MapFallbackToFile("index.html");

// Seed the database
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<BarqTMSDbContext>();
    var authService = scope.ServiceProvider.GetRequiredService<AuthService>();
    
    try
    {
        await BarqTMS.API.Data.DatabaseSeeder.SeedDatabaseAsync(context, authService);
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

app.Run();

// Expose Program for WebApplicationFactory<Program> in BarqTMS.Tests.
public partial class Program { }
