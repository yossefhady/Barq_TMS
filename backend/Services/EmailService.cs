using System.Net;
using System.Net.Mail;

namespace BarqTMS.API.Services
{
    public interface IEmailService
    {
        Task SendEmailAsync(string to, string subject, string body, bool isHtml = true);
        Task SendTaskAssignmentEmailAsync(string toEmail, string userName, string taskTitle, string projectName);
        Task SendTaskDueDateReminderAsync(string toEmail, string userName, string taskTitle, DateTime dueDate);
        Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetToken);
        Task SendWelcomeEmailAsync(string toEmail, string userName);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;
        private readonly SmtpClient _smtpClient;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _configuration = configuration;
            _logger = logger;

            var smtpHost = _configuration["Email:SmtpHost"];
            var smtpPort = _configuration.GetValue<int>("Email:SmtpPort", 587);
            var smtpUsername = _configuration["Email:Username"];
            var smtpPassword = _configuration["Email:Password"];
            var enableSsl = _configuration.GetValue<bool>("Email:EnableSsl", true);

            _smtpClient = new SmtpClient(smtpHost, smtpPort)
            {
                Credentials = new NetworkCredential(smtpUsername, smtpPassword),
                EnableSsl = enableSsl
            };
        }

        public async Task SendEmailAsync(string to, string subject, string body, bool isHtml = true)
        {
            try
            {
                var fromEmail = _configuration["Email:FromEmail"];
                var fromName = _configuration["Email:FromName"] ?? "Barq TMS";

                var message = new MailMessage
                {
                    From = new MailAddress(fromEmail!, fromName),
                    Subject = subject,
                    Body = body,
                    IsBodyHtml = isHtml
                };

                message.To.Add(to);

                await _smtpClient.SendMailAsync(message);
                _logger.LogInformation("Email sent successfully to {Email}", to);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {Email}", to);
                throw;
            }
        }

        public async Task SendTaskAssignmentEmailAsync(string toEmail, string userName, string taskTitle, string projectName)
        {
            var subject = "New Task Assignment - Barq TMS";
            var body = $@"
                <html>
                <body>
                    <h2>New Task Assignment</h2>
                    <p>Hello {userName},</p>
                    <p>You have been assigned a new task:</p>
                    <div style='background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;'>
                        <strong>Task:</strong> {taskTitle}<br>
                        <strong>Project:</strong> {projectName}
                    </div>
                    <p>Please log in to Barq TMS to view the task details and get started.</p>
                    <p>Best regards,<br>Barq TMS Team</p>
                </body>
                </html>";

            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendTaskDueDateReminderAsync(string toEmail, string userName, string taskTitle, DateTime dueDate)
        {
            var subject = "Task Due Date Reminder - Barq TMS";
            var body = $@"
                <html>
                <body>
                    <h2>Task Due Date Reminder</h2>
                    <p>Hello {userName},</p>
                    <p>This is a reminder that the following task is due soon:</p>
                    <div style='background-color: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #ffc107;'>
                        <strong>Task:</strong> {taskTitle}<br>
                        <strong>Due Date:</strong> {dueDate:MMMM dd, yyyy 'at' HH:mm}
                    </div>
                    <p>Please make sure to complete the task on time.</p>
                    <p>Best regards,<br>Barq TMS Team</p>
                </body>
                </html>";

            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetToken)
        {
            var subject = "Password Reset Request - Barq TMS";
            var resetUrl = $"{_configuration["App:BaseUrl"]}/reset-password?token={resetToken}";
            var body = $@"
                <html>
                <body>
                    <h2>Password Reset Request</h2>
                    <p>Hello {userName},</p>
                    <p>You have requested to reset your password. Click the link below to reset your password:</p>
                    <div style='margin: 20px 0;'>
                        <a href='{resetUrl}' style='background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Reset Password</a>
                    </div>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                    <p>This link will expire in 24 hours.</p>
                    <p>Best regards,<br>Barq TMS Team</p>
                </body>
                </html>";

            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string userName)
        {
            var subject = "Welcome to Barq TMS";
            var body = $@"
                <html>
                <body>
                    <h2>Welcome to Barq Task Management System</h2>
                    <p>Hello {userName},</p>
                    <p>Welcome to Barq TMS! Your account has been successfully created.</p>
                    <p>You can now:</p>
                    <ul>
                        <li>Create and manage tasks</li>
                        <li>Track project progress</li>
                        <li>Collaborate with your team</li>
                        <li>Generate reports and analytics</li>
                    </ul>
                    <p>If you have any questions, feel free to reach out to our support team.</p>
                    <p>Best regards,<br>Barq TMS Team</p>
                </body>
                </html>";

            await SendEmailAsync(toEmail, subject, body);
        }

        public void Dispose()
        {
            _smtpClient?.Dispose();
        }
    }
}