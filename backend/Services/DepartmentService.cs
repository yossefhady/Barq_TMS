using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Services
{
    public interface IDepartmentService
    {
        Task<IEnumerable<DepartmentDto>> GetAllDepartmentsAsync();
    }

    public class DepartmentService : IDepartmentService
    {
        private readonly BarqTMSDbContext _context;

        public DepartmentService(BarqTMSDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<DepartmentDto>> GetAllDepartmentsAsync()
        {
            var departments = await _context.Departments
                .Include(d => d.Users)
                .Include(d => d.Tasks)
                .ToListAsync();

            return departments.Select(d => new DepartmentDto
            {
                DeptId = d.DeptId,
                DeptName = d.Name,
                UserCount = d.Users.Count,
                TaskCount = d.Tasks.Count
            });
        }
    }
}
