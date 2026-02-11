// Client Project Details Page Script
auth.requireRole([USER_ROLES.CLIENT]);

let tasks = [];
let projects = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();

    const allTasks = await API.Tasks.getAll().catch(() => []);
    const allProjects = await API.Projects.getAll().catch(() => []);

    // Backend now handles filtering for owned clients
    projects = allProjects;
    tasks = allTasks;

    renderTasks();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load Project Details");
  } finally {
    utils.hideLoading();
  }
}

function renderTasks() {
  const tbody = document.getElementById("tasksBody");

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No tasks found</h3>
            <p>No tasks found for your projects</p>
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
      <td><strong>${task.Title || "Untitled"}</strong></td>
      <td>${utils.truncateText(task.Description || "No description", 50)}</td>
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

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }
}

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll("#tasksBody tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
}
