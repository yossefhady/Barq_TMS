// Team Leader Projects (View Only)
auth.requireRole([USER_ROLES.TEAM_LEADER]);

let projects = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadProjects();
  setupSearch();
});

async function loadProjects() {
  try {
    utils.showLoading();
    // Backend filters to show only projects with tasks assigned to team
    projects = await API.Projects.getAll();
    renderProjects();
  } catch (error) {
    console.error("Error loading projects:", error);
    utils.showError("Failed to load projects");
  } finally {
    utils.hideLoading();
  }
}

function renderProjects() {
  const tbody = document.getElementById("projectsBody");

  if (!projects || projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No projects found</h3>
            <p>You don't have any projects with team tasks</p>
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
      <td><strong>${project.ProjectName || "Untitled"}</strong></td>
      <td>${utils.truncateText(project.Description || "No description", 50)}</td>
      <td>${project.ClientName || "N/A"}</td>
      <td><span class="badge badge-info">${project.TaskCount || 0} tasks</span></td>
      <td>${utils.formatDate(project.StartDate)}</td>
      <td>${utils.formatDate(project.EndDate)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewProject(${project.ProjectId})">
          <i class="fa-solid fa-eye"></i> View
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

function viewProject(projectId) {
  const project = projects.find((p) => p.ProjectId === projectId);
  if (!project) return;

  const message = `
Project Details:

Name: ${project.ProjectName || "N/A"}
Description: ${project.Description || "No description"}
Client: ${project.ClientName || "N/A"}
Tasks: ${project.TaskCount || 0}
Start Date: ${utils.formatDate(project.StartDate)}
End Date: ${utils.formatDate(project.EndDate)}
  `;

  alert(message);
}

function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const rows = document.querySelectorAll("#projectsBody tr");
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? "" : "none";
      });
    });
  }
}
