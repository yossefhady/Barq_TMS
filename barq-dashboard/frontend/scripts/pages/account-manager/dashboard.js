// Account Manager Dashboard Script
auth.requireRole([USER_ROLES.ACCOUNT_MANAGER]);

let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = auth.getCurrentUser();
  await loadDashboardData();
});

// Helper: Get projects where current user is Account Manager
async function getMyProjects() {
  const allProjects = await API.Projects.getAll().catch(() => []);

  // Filter projects where current user is the account manager
  return allProjects.filter((project) => {
    const accountManagerId =
      project.accountManagerId || project.AccountManagerId;
    return accountManagerId === currentUser.userId;
  });
}

// Helper: Get clients from my projects
async function getMyClients(myProjects) {
  const allClients = await API.Clients.getAll().catch(() => []);

  // Get unique client IDs from my projects
  const myClientIds = new Set(
    myProjects
      .filter((p) => p.clientId || p.ClientId)
      .map((p) => p.clientId || p.ClientId)
  );

  // Filter clients and enrich with project count
  return allClients
    .filter((c) => myClientIds.has(c.clientId || c.ClientId))
    .map((c) => ({
      ...c,
      ProjectCount: myProjects.filter(
        (p) => (p.clientId || p.ClientId) === (c.clientId || c.ClientId)
      ).length,
    }));
}

// Helper: Get tasks from my projects
function getMyTasks(myProjects, allTasks) {
  const myProjectIds = new Set(
    myProjects.map((p) => p.projectId || p.ProjectId)
  );

  return allTasks.filter((t) => myProjectIds.has(t.projectId || t.ProjectId));
}

async function loadDashboardData() {
  try {
    utils.showLoading();

    // Load all data
    const [allProjects, allTasks] = await Promise.all([
      API.Projects.getAll().catch(() => []),
      API.Tasks.getAll().catch(() => []),
    ]);

    // Filter by account manager's assigned projects
    const myProjects = allProjects.filter((project) => {
      const accountManagerId =
        project.accountManagerId || project.AccountManagerId;
      return accountManagerId === currentUser.userId;
    });

    // Get my clients
    const myClients = await getMyClients(myProjects);

    // Filter tasks from my projects
    const myTasks = getMyTasks(myProjects, allTasks);

    console.log("[Dashboard] Filtered data:", {
      projects: myProjects.length,
      clients: myClients.length,
      tasks: myTasks.length,
    });

    updateStats({ projects: myProjects, clients: myClients, tasks: myTasks });
    renderRecentTasks(myTasks.slice(0, 5));
    renderRecentProjects(myProjects.slice(0, 5));
    renderRecentClients(myClients.slice(0, 5));
  } catch (error) {
    console.error("Error loading dashboard:", error);
    utils.showError("Failed to load dashboard data");
  } finally {
    utils.hideLoading();
  }
}

function updateStats(data) {
  const totalTasksEl = document.getElementById("totalTasks");
  const totalProjectsEl = document.getElementById("totalProjects");
  const totalClientsEl = document.getElementById("totalClients");

  if (totalTasksEl) totalTasksEl.textContent = data.tasks.length;
  if (totalProjectsEl) totalProjectsEl.textContent = data.projects.length;
  if (totalClientsEl) totalClientsEl.textContent = data.clients.length;
}

function renderRecentTasks(tasks) {
  const tbody = document.getElementById("recentTasksBody");

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No tasks found</h3>
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
      <td>${utils.getStatusBadge(task.StatusId)}</td>
      <td>${utils.getPriorityBadge(task.PriorityId)}</td>
      <td>${utils.formatDate(task.DueDate)}</td>
    </tr>
  `
    )
    .join("");
}

function renderRecentClients(clients) {
  const container = document.getElementById("recentClientsContainer");

  // If container doesn't exist in HTML, skip rendering
  if (!container) {
    console.warn("[Dashboard] Recent clients container not found in HTML");
    return;
  }

  if (clients.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px; text-align: center;">
        <i class="fa-solid fa-users" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
        <h3>No Clients</h3>
        <p>Clients from your projects will appear here</p>
      </div>
    `;
    return;
  }

  container.innerHTML = clients
    .map(
      (client) => `
      <div class="client-card" style="padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-md); margin-bottom: var(--space-3); border-left: 4px solid var(--primary-color);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
          <div>
            <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary);">
              <i class="fa-solid fa-building"></i> ${
                client.name || client.Name || client.ClientName
              }
            </h4>
            <p style="margin: 0; font-size: var(--text-sm); color: var(--text-secondary);">
              ${client.company || client.Company || "N/A"}
            </p>
          </div>
          <span class="badge badge-info">${
            client.ProjectCount || 0
          } projects</span>
        </div>
        <div style="display: flex; gap: var(--space-3); font-size: var(--text-sm); color: var(--text-secondary); margin-top: var(--space-3);">
          <span><i class="fa-solid fa-envelope"></i> ${
            client.email || client.Email || "N/A"
          }</span>
          <span><i class="fa-solid fa-phone"></i> ${
            client.phoneNumber || client.PhoneNumber || "N/A"
          }</span>
        </div>
        <div style="margin-top: var(--space-3);">
          <button class="btn btn-sm btn-primary" onclick="viewClientDetails(${
            client.clientId || client.ClientId
          })" style="width: 100%;">
            <i class="fa-solid fa-eye"></i> View Details
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

function viewClientDetails(clientId) {
  window.location.href = `client-details.html?id=${clientId}`;
}

function renderRecentProjects(projects) {
  const tbody = document.getElementById("recentProjectsBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No projects found</h3>
            <p>Projects you manage will appear here</p>
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
      <td><span class="badge badge-info">${
        project.TaskCount || 0
      } tasks</span></td>
      <td>${utils.formatDate(project.StartDate)} - ${utils.formatDate(
        project.EndDate
      )}</td>
    </tr>
  `
    )
    .join("");
}
