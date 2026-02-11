// Employee Projects Script

// Protect page - require Employee role
auth.requireRole([USER_ROLES.EMPLOYEE]);

let allProjects = [];

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
    // Redirect logic for Sales employees
    const user = auth.getCurrentUser();
    const isSales = user && user.Departments && user.Departments.some(d => {
        const name = d.DeptName || d.Name || '';
        return name.toLowerCase().includes('sales');
    });

    if (isSales) {
        window.location.href = 'dashboard.html';
        return;
    }

  await loadProjects();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document
    .getElementById("statusFilter")
    .addEventListener("change", filterProjects);
}

// Load projects
async function loadProjects() {
  try {
    utils.showLoading();
    const currentUser = auth.getCurrentUser();

    // Load all projects and tasks
    const [projects, tasks] = await Promise.all([
      API.Projects.getAll(),
      API.Tasks.getAll(),
    ]);

    // Filter projects to only those containing tasks assigned to this employee
    const myTaskProjectIds = tasks
      .filter((t) => (t.AssignedTo || t.assignedTo) === currentUser.UserId)
      .map((t) => t.ProjectId || t.projectId)
      .filter((id, index, self) => id && self.indexOf(id) === index); // unique IDs

    allProjects = projects.filter((p) =>
      myTaskProjectIds.includes(p.ProjectId || p.projectId)
    );

    renderProjects(allProjects);
  } catch (error) {
    console.error("Error loading projects:", error);
    utils.showError("Failed to load projects");
  } finally {
    utils.hideLoading();
  }
}

// Filter projects
function filterProjects() {
  const statusFilter = document.getElementById("statusFilter").value;

  let filtered = allProjects;

  if (statusFilter) {
    filtered = filtered.filter((project) => project.StatusId == statusFilter);
  }

  renderProjects(filtered);
}

// Render projects
function renderProjects(projects) {
  const tbody = document.getElementById("projectsBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No projects found</h3>
            <p>No projects match your criteria</p>
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
      <td>${utils.formatCurrency(project.Budget || 0)}</td>
      <td>${utils.formatDate(project.StartDate)}</td>
      <td>${utils.formatDate(project.EndDate)}</td>
      <td>${utils.getStatusBadge(project.StatusId || 1)}</td>
    </tr>
  `
    )
    .join("");
}
