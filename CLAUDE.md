# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Barq TMS** — an enterprise task/project management and sales system.

- **Backend**: ASP.NET Core 9.0 (C#) in `backend/`
- **Frontend**: Vanilla HTML/CSS/JavaScript in `barq-dashboard/`
- **Database**: Microsoft SQL Server via Entity Framework Core
- **Real-Time**: SignalR (`/hubs/notifications`)
- **Auth**: JWT (BCrypt password hashing)
- **Production backend**: `https://barqtms-api.runasp.net`
- **Frontend hosting**: GitHub Pages (via `.github/workflows/deploy.yml`)

## Common Commands

```bash
# Build backend
cd backend && dotnet build BarqTMS.API.sln

# Run backend (dev) — listens on http://localhost:5500
cd backend && dotnet run

# Publish for production hosting
cd backend && ./build_for_hosting.sh
# Outputs to ../publish/hosting_package/

# EF Core migrations
cd backend && dotnet ef migrations add <Name>
cd backend && dotnet ef database update
```

The `build_for_hosting.sh` script syncs the frontend (`barq-dashboard/`) into `wwwroot/` before publishing as a framework-dependent Release build.

## Configuration

**Required environment variable** (or fall back to `appsettings.json`):
- `JWT_SECRET_KEY` — minimum 32 characters; enforced at startup in `Program.cs`

Key `appsettings.json` sections: `ConnectionStrings.DefaultConnection`, `Jwt`, `Email` (SMTP), `FileStorage`, `App.BaseUrl`.

Frontend API base URL is selected by hostname in `barq-dashboard/frontend/scripts/utils/api.js` — `localhost` targets the local backend; all other hostnames target the production URL.

## Architecture

### Backend Layers

```
Controllers/    → HTTP endpoints, route to services
Services/       → All business logic (18 services)
Data/           → EF Core DbContext (BarqTMSDbContext) + DatabaseSeeder
Models/         → Entity classes (User, WorkTask, Project, Sales/*, Enums/)
DTOs/           → API request/response shapes
Middleware/     → Logging, global exception handler, rate limiting
Hubs/           → SignalR NotificationHub
Migrations/     → Single initial migration (MSSQL)
```

Dependency injection is configured entirely in `Program.cs`. Services are registered as scoped; `OverdueTaskNotificationService` runs as a background `IHostedService`.

### Key Services

| Service | Responsibility |
|---|---|
| `AuthService` | JWT generation, login, registration |
| `TaskService` | Task CRUD, assignment, status transitions |
| `ProjectService` | Project management |
| `NotificationService` | Email + real-time notifications |
| `ReportingService` | Report generation |
| `AuditService` | Audit log writes |
| `RealTimeService` | SignalR broadcast helper |
| `OverdueTaskNotificationService` | Background hosted service for overdue alerts |

### Database

EF Core Code-First. Key relationships:
- `User` is self-referencing (Supervisor/Subordinates)
- Junction tables use composite keys: `ProjectTeamLeader`, `ProjectDepartment`, `TaskAssignee`, `EventAttendee`
- Enums stored as strings

### Frontend Structure

Pages are organized by role under `barq-dashboard/frontend/pages/`: `auth/`, `employee/`, `manager/`, `team-leader/`, `account-manager/`, `assistant-manager/`, `client/`.

Shared utilities in `barq-dashboard/frontend/scripts/utils/`:
- `api.js` — fetch wrapper with JWT Bearer token injection
- `auth.js` — token storage/retrieval (localStorage)
- `notifications.js` — SignalR client setup
- `utils.js`, `components.js` — shared helpers

### Roles

`Manager`, `AssistantManager`, `TeamLeader`, `Employee`, `Client`, `AccountManager` — enforced via `[Authorize(Roles = "...")]` on controllers.

## API Documentation

Swagger UI and Scalar API reference are available in development at the standard endpoints (configured in `Program.cs`).
