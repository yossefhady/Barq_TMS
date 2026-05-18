using BarqTMS.API.Models;
using System.Threading.Tasks;

namespace BarqTMS.API.Services
{
    public interface IAuditService
    {
        Task LogActivityAsync(string action, string entityType, string entityId, string details, int? userId = null);
    }

    public class AuditService : IAuditService
    {
        public Task LogActivityAsync(string action, string entityType, string entityId, string details, int? userId = null)
        {
            return Task.CompletedTask;
        }
    }
}
