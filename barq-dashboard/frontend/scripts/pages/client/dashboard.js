// Client Dashboard Script
auth.requireRole([USER_ROLES.CLIENT]);

document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
});

async function loadDashboardData() {
  try {
    utils.showLoading();

    const [projects, tasks] = await Promise.all([
      API.Projects.getAll().catch(() => []),
      API.Tasks.getAll().catch(() => []),
    ]);

    // Filter projects for current client
    // Backend now handles filtering for owned clients
    const myProjects = projects;

    updateStats({ projects: myProjects, tasks });
    renderProjects(myProjects);
  } catch (error) {
    console.error("Error loading dashboard:", error);
    utils.showError("Failed to load dashboard data");
  } finally {
    utils.hideLoading();
  }
}

function updateStats(data) {
  const activeProjects = data.projects.filter(
    (p) => p.StatusId === 1 || p.StatusId === 2
  ).length;
  const completedProjects = data.projects.filter(
    (p) => p.StatusId === 4
  ).length;

  document.getElementById("totalProjects").textContent = data.projects.length;
  document.getElementById("activeProjects").textContent = activeProjects;
  document.getElementById("completedProjects").textContent = completedProjects;
  document.getElementById("totalTasks").textContent = data.tasks.length;
}

function renderProjects(projects) {
  const tbody = document.getElementById("projectsBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No projects found</h3>
            <p>You don't have any projects yet</p>
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
      <td><strong>${project.Name || "Untitled Project"}</strong></td>
      <td>${project.ClientName || "N/A"}</td>
      <td>${utils.formatDate(project.StartDate)}</td>
      <td>${utils.formatDate(project.EndDate)}</td>
      <td>${utils.getStatusBadge(project.StatusId || 1)}</td>
      <td>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}
