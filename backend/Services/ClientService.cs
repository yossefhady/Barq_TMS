using BarqTMS.API.Data;
using BarqTMS.API.DTOs;
using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Services
{
    public interface IClientService
    {
        Task<IEnumerable<ClientDto>> GetAllClientsAsync();
        Task<ClientDto?> GetClientByIdAsync(int id);
        Task<ClientDto> CreateClientAsync(CreateClientDto clientDto);
        Task<ClientDto?> UpdateClientAsync(int id, UpdateClientDto clientDto);
        Task<bool> DeleteClientAsync(int id);
        Task<IEnumerable<ProjectDto>> GetClientProjectsAsync(int clientId);
    }

    public class ClientService : IClientService
    {
        private readonly BarqTMSDbContext _context;
        private readonly AuthService _authService;
        private readonly ILogger<ClientService> _logger;

        public ClientService(BarqTMSDbContext context, AuthService authService, ILogger<ClientService> logger)
        {
            _context = context;
            _authService = authService;
            _logger = logger;
        }

        public async Task<IEnumerable<ClientDto>> GetAllClientsAsync()
        {
            var companies = await _context.Companies
                .Include(c => c.Owner)
                .Include(c => c.AccountManager)
                .Select(c => new ClientDto
                {
                    ClientId = c.CompanyId,
                    Name = c.Name,
                    Email = c.Email ?? string.Empty,
                    PhoneNumber = c.Phone,
                    Address = c.Address,
                    Country = c.Country,
                    ProjectCount = c.Projects.Count,
                    AccountManagerId = c.AccountManagerId,
                    AccountManagerName = c.AccountManager != null ? c.AccountManager.FullName : null,
                    OwnerUserId = c.OwnerUserId,
                    OwnerName = c.Owner.FullName
                })
                .ToListAsync();

            return companies;
        }

        public async Task<ClientDto?> GetClientByIdAsync(int id)
        {
            var company = await _context.Companies
                .Include(c => c.Owner)
                .Include(c => c.AccountManager)
                .Include(c => c.Projects)
                .FirstOrDefaultAsync(c => c.CompanyId == id);

            return company == null ? null : MapToDto(company);
        }

        public async Task<ClientDto> CreateClientAsync(CreateClientDto clientDto)
        {
            // Validate AccountManagerId if provided
            if (clientDto.AccountManagerId.HasValue)
            {
                var accountManager = await _context.Users.FindAsync(clientDto.AccountManagerId.Value);
                if (accountManager == null || accountManager.Role != UserRole.AccountManager)
                    throw new ArgumentException("Invalid Account Manager. User does not exist or is not an Account Manager.");
            }

            // Use ExecutionStrategy to handle transaction retries (required when EnableRetryOnFailure is on)
            var strategy = _context.Database.CreateExecutionStrategy();

            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    int ownerId;

                    // 1. Handle Owner Creation or Selection
                    if (clientDto.OwnerUserId.HasValue)
                    {
                        // Use existing user - validate they exist and have Client role
                        var existingUser = await _context.Users.FindAsync(clientDto.OwnerUserId.Value);
                        if (existingUser == null)
                            throw new ArgumentException("Selected owner user does not exist.");
                        if (existingUser.Role != UserRole.Client)
                            throw new ArgumentException("Selected owner must have the Client role.");

                        ownerId = existingUser.UserId;
                    }
                    else
                    {
                        // Create new user
                        if (string.IsNullOrEmpty(clientDto.Username) || string.IsNullOrEmpty(clientDto.Password))
                            throw new ArgumentException("Username and Password are required for new client users.");

                        // Check if a Client-role user with this username already exists and owns no companies (orphaned from a previous delete)
                        var existingByUsername = await _context.Users.FirstOrDefaultAsync(u => u.Username == clientDto.Username);
                        if (existingByUsername != null)
                        {
                            if (existingByUsername.Role == UserRole.Client
                                && !await _context.Companies.AnyAsync(c => c.OwnerUserId == existingByUsername.UserId))
                            {
                                // Reuse the orphaned client user — update their details
                                existingByUsername.FullName = clientDto.OwnerName ?? clientDto.Name;
                                existingByUsername.Email = clientDto.Email;
                                existingByUsername.PasswordHash = _authService.HashPassword(clientDto.Password);
                                existingByUsername.IsActive = true;
                                await _context.SaveChangesAsync();
                                ownerId = existingByUsername.UserId;
                            }
                            else
                            {
                                throw new ArgumentException("Username already exists.");
                            }
                        }
                        else
                        {
                            // Check email uniqueness for new user
                            if (await _context.Users.AnyAsync(u => u.Email == clientDto.Email))
                                throw new ArgumentException("A user with this email already exists.");

                            var newUser = new User
                            {
                                FullName = clientDto.OwnerName ?? clientDto.Name,
                                Username = clientDto.Username,
                                Email = clientDto.Email,
                                PasswordHash = _authService.HashPassword(clientDto.Password),
                                Role = UserRole.Client,
                                IsActive = true,
                                CreatedAt = DateTime.UtcNow
                            };

                            _context.Users.Add(newUser);
                            await _context.SaveChangesAsync();
                            ownerId = newUser.UserId;
                        }
                    }

                    // 2. Create Company
                    var company = new Company
                    {
                        Name = clientDto.Name,
                        Email = clientDto.Email,
                        Phone = clientDto.PhoneNumber,
                        Address = clientDto.Address,
                        Country = clientDto.Country,
                        Type = "Client",
                        OwnerUserId = ownerId,
                        AccountManagerId = clientDto.AccountManagerId
                    };

                    _context.Companies.Add(company);
                    await _context.SaveChangesAsync();

                    await transaction.CommitAsync();

                    // Reload to get navigation properties
                    return (await GetClientByIdAsync(company.CompanyId))!;
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Error creating client");
                    throw;
                }
            });
        }

        public async Task<ClientDto?> UpdateClientAsync(int id, UpdateClientDto clientDto)
        {
            var company = await _context.Companies.FindAsync(id);
            if (company == null) return null;

            company.Name = clientDto.Name;
            company.Email = clientDto.Email;
            company.Phone = clientDto.PhoneNumber;
            company.Address = clientDto.Address;
            company.Country = clientDto.Country;
            company.AccountManagerId = clientDto.AccountManagerId;

            await _context.SaveChangesAsync();
            return (await GetClientByIdAsync(id))!;
        }

        public async Task<bool> DeleteClientAsync(int id)
        {
            var company = await _context.Companies
                .FirstOrDefaultAsync(c => c.CompanyId == id);
            if (company == null) return false;

            var ownerId = company.OwnerUserId;

            // Remove company (projects/tasks cascade via DB)
            _context.Companies.Remove(company);
            await _context.SaveChangesAsync();

            // Clean up the owner user if they don't own any other companies
            if (ownerId > 0)
            {
                var ownerStillUsed = await _context.Companies.AnyAsync(c => c.OwnerUserId == ownerId);
                if (!ownerStillUsed)
                {
                    var ownerUser = await _context.Users.FindAsync(ownerId);
                    if (ownerUser != null && ownerUser.Role == UserRole.Client)
                    {
                        try
                        {
                            _context.Users.Remove(ownerUser);
                            await _context.SaveChangesAsync();
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Could not delete orphaned client user {UserId}. They may have other references.", ownerId);
                        }
                    }
                }
            }

            return true;
        }

        public async Task<IEnumerable<ProjectDto>> GetClientProjectsAsync(int clientId)
        {
             var projects = await _context.Projects
                .Include(p => p.Company)
                .Where(p => p.CompanyId == clientId)
                .ToListAsync();
            
            return projects.Select(p => new ProjectDto
            {
                ProjectId = p.ProjectId,
                ProjectName = p.Name,
                Description = p.Description,
                StartDate = p.StartDate,
                EndDate = p.DueDate,
                ClientId = p.CompanyId,
                ClientName = p.Company.Name
            });
        }

        private ClientDto MapToDto(Company company)
        {
            return new ClientDto
            {
                ClientId = company.CompanyId,
                Name = company.Name,
                Email = company.Email ?? string.Empty,
                PhoneNumber = company.Phone,
                Address = company.Address,
                Country = company.Country,
                ProjectCount = company.Projects.Count,
                AccountManagerId = company.AccountManagerId,
                AccountManagerName = company.AccountManager?.FullName,
                OwnerUserId = company.OwnerUserId,
                OwnerName = company.Owner?.FullName
            };
        }
    }
}

