using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BarqTMS.API.Services;
using BarqTMS.API.DTOs;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DepartmentsController : ControllerBase
    {
        private readonly IDepartmentService _departmentService;

        public DepartmentsController(IDepartmentService departmentService)
        {
            _departmentService = departmentService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<DepartmentDto>>> GetAll()
        {
            var departments = await _departmentService.GetAllDepartmentsAsync();
            return Ok(departments);
        }
    }
}
