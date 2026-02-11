// Client Projects Page Script
auth.requireRole([USER_ROLES.CLIENT]);

let projects = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();

    const allProjects = await API.Projects.getAll().catch(() => []);

    // Backend now handles filtering for owned clients
    projects = allProjects;

    renderProjects();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load projects");
  } finally {
    utils.hideLoading();
  }
}

function renderProjects() {
  const tbody = document.getElementById("projectsBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 40px;">
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
      <td><strong>${project.Name || "Untitled"}</strong></td>
      <td>${project.ClientName || "N/A"}</td>
      <td>${utils.truncateText(
        project.Description || "No description",
        50
      )}</td>
      <td>${utils.formatCurrency(project.Budget || 0)}</td>
      <td>${utils.formatDate(project.StartDate)}</td>
      <td>${utils.formatDate(project.EndDate)}</td>
      <td>${utils.getStatusBadge(project.StatusId || 1)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="viewProjectDetails(${project.Id
        })">
          <i class="fa-solid fa-eye"></i> View Details
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

// View project details
function viewProjectDetails(projectId) {
  window.location.href = `project-details.html?id=${projectId}`;
}

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }
}

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll("#projectsBody tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
}
