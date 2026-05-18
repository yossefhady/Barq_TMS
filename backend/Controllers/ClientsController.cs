using BarqTMS.API.DTOs;
using BarqTMS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BarqTMS.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ClientsController : ControllerBase
    {
        private readonly IClientService _clientService;

        public ClientsController(IClientService clientService)
        {
            _clientService = clientService;
        }

        [HttpGet]
        [Authorize(Roles = "Manager,AssistantManager,AccountManager")]
        public async Task<ActionResult<IEnumerable<ClientDto>>> GetAll()
        {
            var clients = await _clientService.GetAllClientsAsync();
            return Ok(clients);
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Manager,AssistantManager,AccountManager,Client")]
        public async Task<ActionResult<ClientDto>> GetById(int id)
        {
            var client = await _clientService.GetClientByIdAsync(id);
            if (client == null) return NotFound();
            return Ok(client);
        }

        [HttpPost]
        [Authorize(Roles = "Manager,AssistantManager,AccountManager")]
        public async Task<ActionResult<ClientDto>> Create(CreateClientDto clientDto)
        {
            try
            {
                var client = await _clientService.CreateClientAsync(clientDto);
                return CreatedAtAction(nameof(GetById), new { id = client.ClientId }, client);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Manager,AssistantManager,AccountManager")]
        public async Task<ActionResult<ClientDto>> Update(int id, UpdateClientDto clientDto)
        {
            var client = await _clientService.UpdateClientAsync(id, clientDto);
            if (client == null) return NotFound();
            return Ok(client);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Manager,AssistantManager")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var result = await _clientService.DeleteClientAsync(id);
                if (!result) return NotFound();
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id}/projects")]
        [Authorize(Roles = "Manager,AssistantManager,AccountManager,Client")]
        public async Task<ActionResult<IEnumerable<ProjectDto>>> GetProjects(int id)
        {
            var projects = await _clientService.GetClientProjectsAsync(id);
            return Ok(projects);
        }
    }
}
