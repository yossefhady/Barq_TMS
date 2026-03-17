// Manager Dashboard Script

// Protect page - require Manager role
auth.requireRole([USER_ROLES.MANAGER]);

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
});

// Load all dashboard data
async function loadDashboardData() {
  try {
    utils.showLoading();

    // Fetch dashboard stats from dedicated API
    const stats = await API.Dashboard.getStats().catch((err) => {
      console.error("Failed to fetch dashboard stats:", err);
      return null;
    });

    console.log("📊 Dashboard Stats:", stats);

    if (stats) {
      // Update stats from Dashboard API
      updateStatsFromAPI(stats);
    }

    // Fetch recent data for tables
    const [tasks, projects, allUsers] = await Promise.all([
      API.Tasks.getAll().catch(() => []),
      API.Projects.getAll().catch(() => []),
      API.Users.getAll().catch(() => []),
    ]);

    // Debug: Log the actual API response
    console.log("📋 Tasks from API:", tasks);
    console.log("📁 Projects from API:", projects);

    // Team Members count: Assistant Manager (2), Account Manager (3), Team Leader (4), Employee (5)
    const teamMemberCount = allUsers.filter(u => {
      const role = u.Role !== undefined ? u.Role : (u.role !== undefined ? u.role : (u.RoleId !== undefined ? u.RoleId : u.roleId));
      return role === 2 || role === 3 || role === 4 || role === 5;
    }).length;
    document.getElementById("totalEmployees").textContent = teamMemberCount;

    // Render recent data
    renderRecentTasks(tasks.slice(0, 10));
    renderRecentProjects(projects.slice(0, 5));

    // Load Sales Summary
    const date = new Date();
    const salesData = await API.Sales.getSummary(date.getMonth() + 1, date.getFullYear()).catch(err => {
        console.error("Sales Summary Error", err);
        return [];
    });
    renderSalesSummary(salesData);
  } catch (error) {
    console.error("Error loading dashboard:", error);
    utils.showError("Failed to load dashboard data");
  } finally {
    utils.hideLoading();
  }
}

// Update statistics cards from Dashboard API
function updateStatsFromAPI(stats) {
  console.log("Updating stats with:", stats);
  
  // Helper to get value checking both PascalCase and camelCase
  const getVal = (key1, key2) => {
    if (stats[key1] !== undefined) return stats[key1];
    if (stats[key2] !== undefined) return stats[key2];
    return 0;
  };

  document.getElementById("totalTasks").textContent = getVal("TotalTasks", "totalTasks");
  document.getElementById("totalProjects").textContent = getVal("TotalProjects", "totalProjects");
  // Team Members count is set separately from the Users API (only Employees + Team Leaders)
  document.getElementById("totalClients").textContent = getVal("TotalClients", "totalClients");
}

// Render recent tasks
function renderRecentTasks(tasks) {
  const tbody = document.getElementById("recentTasksBody");

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No tasks found</h3>
            <p>Create your first task to get started</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tasks
    .map(
      (task) => `
    <tr>
      <td><strong>${task.Title || "Untitled Task"}</strong></td>
      <td>${task.ProjectName || "N/A"}</td>
      <td>${task.AssignedToName || "Unassigned"}</td>
      <td>${utils.getStatusBadge(task.StatusId || 1)}</td>
      <td>${utils.getPriorityBadge(task.PriorityId || 1)}</td>
      <td>${utils.formatDate(task.DueDate)}</td>
    </tr>
  `
    )
    .join("");
}

// Render recent projects
function renderRecentProjects(projects) {
  const tbody = document.getElementById("recentProjectsBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No projects found</h3>
            <p>Create your first project to get started</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = projects
    .map(
      (project) => `
    <tr>
      <td><strong>${project.ProjectName || "Untitled Project"}</strong></td>
      <td>${project.ClientName || "N/A"}</td>
      <td>${
        project.StartDate ? utils.formatDate(project.StartDate) : "N/A"
      }</td>
      <td>${project.EndDate ? utils.formatDate(project.EndDate) : "N/A"}</td>
      <td><span class="badge badge-info">${
        project.TaskCount || 0
      } tasks</span></td>
    </tr>
  `
    )
    .join("");
}

function renderSalesSummary(data) {
    const container = document.getElementById('salesTargetsSummary');
    if (!container) return;
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-center p-3">No active sales targets found for this month.</p>';
        return;
    }
    
    // Create table
    let html = `
    <table class="table">
        <thead>
            <tr>
                <th>Team Leader</th>
                <th>Avg. Completion</th>
                <th>Clients</th>
                <th>Meetings</th>
                <th>Data</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    data.forEach(item => {
        // Map keys to handle DTO structure (TeamLeaderSalesSummaryDto)
        const tClients = item.TargetClients || item.targetClients || 0;
        const aClients = item.ActualClients || item.actualClients || 0;
        
        const tMeetings = item.TargetMeetings || item.targetMeetings || 0;
        const aMeetings = item.ActualMeetings || item.actualMeetings || 0;
        
        const tData = item.TargetData || item.targetData || 0;
        const aData = item.ActualData || item.actualData || 0;

        // Calculate percentages
        const pClients = tClients > 0 ? Math.min(100, Math.round((aClients / tClients) * 100)) : 0;
        const pMeetings = tMeetings > 0 ? Math.min(100, Math.round((aMeetings / tMeetings) * 100)) : 0;
        const pData = tData > 0 ? Math.min(100, Math.round((aData / tData) * 100)) : 0;
        
        // Simple Average of defined targets
        let definedTargets = 0;
        let totalP = 0;
        if (tClients > 0) { definedTargets++; totalP += pClients; }
        if (tMeetings > 0) { definedTargets++; totalP += pMeetings; }
        if (tData > 0) { definedTargets++; totalP += pData; }
        
        const avg = definedTargets > 0 ? Math.round(totalP / definedTargets) : 0;
        
        // Progress Bar Color
        let colorClass = 'bg-danger'; // Red
        if (avg >= 75) colorClass = 'bg-success'; // Green
        else if (avg >= 40) colorClass = 'bg-warning'; // Yellow
        
        html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <span>${item.TeamLeaderName || 'Unknown'}</span>
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress flex-grow-1 mr-2" style="height: 6px;">
                            <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${avg}%"></div>
                        </div>
                        <span class="small text-muted">${avg}%</span>
                    </div>
                </td>
                <td>
                    <div class="small">
                        ${tClients > 0 
                            ? `<span class="${pClients >= 100 ? 'text-success' : ''}">${aClients}</span> / ${tClients}`
                            : `<span class="text-muted">N/A</span>`
                        }
                    </div>
                </td>
                <td>
                    <div class="small">
                        ${tMeetings > 0 
                            ? `<span class="${pMeetings >= 100 ? 'text-success' : ''}">${aMeetings}</span> / ${tMeetings}`
                            : `<span class="text-muted">N/A</span>`
                        }
                    </div>
                </td>
                <td>
                    <div class="small">
                        ${tData > 0 
                            ? `<span class="${pData >= 100 ? 'text-success' : ''}">${aData}</span> / ${tData}`
                            : `<span class="text-muted">N/A</span>`
                        }
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}
