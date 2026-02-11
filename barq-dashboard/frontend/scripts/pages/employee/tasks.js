// Employee Tasks Script

// Protect page - require Employee role
auth.requireRole([USER_ROLES.EMPLOYEE]);

let allTasks = [];

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await loadTasks();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document
    .getElementById("statusFilter")
    .addEventListener("change", filterTasks);
}

// Load all tasks
async function loadTasks() {
  try {
    utils.showLoading();
    allTasks = await API.Tasks.getAll().catch(() => []);
    renderTasks(allTasks);
  } catch (error) {
    console.error("Error loading tasks:", error);
    let msg = "Failed to load tasks";
    if (error && error.message) {
      const parts = error.message.split(":");
      msg = parts.length > 1 ? parts.slice(1).join(":").trim() : error.message;
      msg = msg.replace(/^\s*["']|["']\s*$/g, "");
    }
    utils.showError(msg);
  } finally {
    utils.hideLoading();
  }
}

// Filter tasks
function filterTasks() {
  const statusFilter = document.getElementById("statusFilter").value;

  let filtered = allTasks;

  if (statusFilter) {
    filtered = filtered.filter(
      (task) => (task.statusId || task.StatusId) == statusFilter
    );
  }

  renderTasks(filtered);
}

// Render tasks
function renderTasks(tasks) {
  const tbody = document.getElementById("tasksBody");

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No tasks found</h3>
            <p>No tasks match your criteria</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tasks
    .map((task) => {
      const statusId = task.statusId || task.StatusId || 1;
      const priorityId = task.priorityId || task.PriorityId || 1;
      return `
    <tr>
      <td><strong>${task.Title || task.title || "Untitled Task"}</strong></td>
      <td>${task.ProjectName || task.projectName || "N/A"}</td>
      <td>${task.AssignedToName || task.assignedToName || "Unassigned"}</td>
      <td>${utils.getStatusBadge(statusId)}</td>
      <td>${utils.getPriorityBadge(priorityId)}</td>
      <td>${utils.formatDate(task.DueDate || task.dueDate)}</td>
    </tr>
  `;
    })
    .join("");
}
