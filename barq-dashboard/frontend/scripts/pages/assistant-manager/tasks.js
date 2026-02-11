// Assistant Manager Tasks Page Script
auth.requireRole([USER_ROLES.ASSISTANT_MANAGER]);

let tasks = [];
let projects = [];
let employees = [];
let currentEditId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();

    [tasks, projects, employees] = await Promise.all([
      API.Tasks.getAll().catch(() => []),
      API.Projects.getAll().catch(() => []),
      API.Employees.getAll().catch(() => []),
    ]);

    populateDropdowns();
    renderTasks();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load tasks");
  } finally {
    utils.hideLoading();
  }
}

function populateDropdowns() {
  const projectSelect = document.getElementById("projectId");
  const employeeSelect = document.getElementById("assignedToId");

  projectSelect.innerHTML =
    '<option value="">Select Project</option>' +
    projects
      .map(
        (p) =>
          `<option value="${p.projectId || p.ProjectId || p.Id}">${
            p.projectName || p.ProjectName || p.Name || "Unnamed"
          }</option>`
      )
      .join("");

  employeeSelect.innerHTML =
    '<option value="">Select Employee</option>' +
    employees
      .map((e) => `<option value="${e.UserId || e.Id}">${e.Name}</option>`)
      .join("");
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
            <p>Create your first task to get started</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tasks
    .map((task) => {
      const taskId = task.TaskId || task.taskId || task.Id;
      const statusId = task.StatusId || task.statusId || task.Status || 1;
      const priorityId =
        task.PriorityId || task.priorityId || task.Priority || 1;

      return `
    <tr>
      <td><strong>${task.Title || task.title || "Untitled"}</strong></td>
      <td>${task.ProjectName || task.projectName || "N/A"}</td>
      <td>${task.AssignedToName || task.assignedToName || "Unassigned"}</td>
      <td>${utils.getStatusBadge(statusId)}</td>
      <td>${utils.getPriorityBadge(priorityId)}</td>
      <td>${utils.formatDate(task.DueDate || task.dueDate)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-primary" onclick="editTask(${taskId})">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteTask(${taskId})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
    })
    .join("");
}

function setupEventListeners() {
  document.getElementById("taskForm").addEventListener("submit", handleSubmit);
  document
    .getElementById("searchInput")
    .addEventListener("input", handleSearch);
}

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll("#tasksBody tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
}

function showCreateModal() {
  currentEditId = null;
  document.getElementById("modalTitle").textContent = "Create Task";
  document.getElementById("taskForm").reset();
  clearFormErrors(document.getElementById("taskForm"));
  document.getElementById("taskId").value = "";
  document.getElementById("taskModal").classList.remove("d-none");
}

function closeModal() {
  document.getElementById("taskModal").classList.add("d-none");
  document.getElementById("taskForm").reset();
  currentEditId = null;
}

async function editTask(id) {
  const task = tasks.find((t) => (t.taskId || t.TaskId || t.Id) == id);
  if (!task) return;
  // Ensure we have the full task DTO (Description and drive links may be present only on detail endpoint)
  try {
    const full = await API.Tasks.getById(id).catch(() => null);
    if (full) Object.assign(task, full);
  } catch (e) {
    console.warn("Failed to fetch full task details:", e);
  }

  currentEditId = id;
  document.getElementById("modalTitle").textContent = "Edit Task";
  document.getElementById("taskId").value = id;
  // Use detail DTO fields (PascalCase from API.Tasks.getById)
  document.getElementById("title").value = task.Title || "";
  document.getElementById("description").value = task.Description || "";
  document.getElementById("projectId").value = task.ProjectId || "";
  document.getElementById("assignedToId").value = task.AssignedTo || "";
  
  const sId = task.StatusId !== undefined ? task.StatusId : (task.statusId !== undefined ? task.statusId : 0);
  document.getElementById("status").value = sId;

  const pId = task.PriorityId !== undefined ? task.PriorityId : (task.priorityId !== undefined ? task.priorityId : 1);
  document.getElementById("priority").value = pId;

  document.getElementById("driveUploadLink").value = task.DriveFolderLink || "";
  document.getElementById("driveMaterialLink").value =
    task.MaterialDriveFolderLink || "";

  if (task.DueDate) {
    const date = new Date(task.DueDate);
    document.getElementById("dueDate").value = date.toISOString().split("T")[0];
  }

  document.getElementById("taskModal").classList.remove("d-none");
}

async function handleSubmit(e) {
  e.preventDefault();
  clearFormErrors(document.getElementById("taskForm"));
  const statusVal = parseInt(document.getElementById("status").value);
  const priorityVal = parseInt(document.getElementById("priority").value);

  const formData = {
    title: document.getElementById("title").value,
    description: document.getElementById("description").value || null,
    projectId: parseInt(document.getElementById("projectId").value) || null,
    assignedTo: parseInt(document.getElementById("assignedToId").value) || null,
    statusId: !isNaN(statusVal) ? statusVal : 0,
    priorityId: !isNaN(priorityVal) ? priorityVal : 1,
    dueDate: document.getElementById("dueDate").value || null,
    driveFolderLink: document.getElementById("driveUploadLink").value || null,
    materialDriveFolderLink:
      document.getElementById("driveMaterialLink").value || null,
  };

  try {
    utils.showLoading();

    if (currentEditId) {
      await API.Tasks.update(currentEditId, formData);
      utils.showSuccess("Task updated successfully");
    } else {
      await API.Tasks.create(formData);
      utils.showSuccess("Task created successfully");
    }

    closeModal();
    await loadData();
  } catch (error) {
    console.error("Error saving task:", error);
    let msg = "Failed to save task";
    if (error && error.message) {
      const parts = error.message.split(":");
      msg = parts.length > 1 ? parts.slice(1).join(":").trim() : error.message;
      msg = msg.replace(/^\s*["']|["']\s*$/g, "");
    }
    if (typeof tryApplyFieldErrors === "function") {
      tryApplyFieldErrors(error, document.getElementById("taskForm"));
    }
    utils.showError(msg);
  } finally {
    utils.hideLoading();
  }
}

// --- Form error helpers (same logic as manager tasks) ---
function clearFormErrors(form) {
  if (!form) return;
  form
    .querySelectorAll(".is-invalid")
    .forEach((el) => el.classList.remove("is-invalid"));
  form.querySelectorAll(".invalid-feedback").forEach((el) => el.remove());
}

function applyFieldErrors(form, fieldErrors) {
  if (!form || !fieldErrors) return;
  let firstEl = null;
  Object.keys(fieldErrors).forEach((field) => {
    const msg = Array.isArray(fieldErrors[field])
      ? fieldErrors[field].join(", ")
      : fieldErrors[field];
    const candidates = [
      field,
      field.charAt(0).toLowerCase() + field.slice(1),
      field.toLowerCase(),
      field + "Id",
      field.replace(/Id$/i, ""),
    ];
    let el = null;
    for (const c of candidates) {
      el = form.querySelector(`#${c}`) || form.querySelector(`[name="${c}"]`);
      if (el) break;
    }
    if (!el) return;
    el.classList.add("is-invalid");
    const feedback = document.createElement("div");
    feedback.className = "invalid-feedback";
    feedback.textContent = msg;
    if (el.parentNode) el.parentNode.appendChild(feedback);
    if (!firstEl) firstEl = el;
  });
  if (firstEl) firstEl.focus();
}

function tryApplyFieldErrors(error, form) {
  try {
    if (!error || !error.message) return false;
    let content = error.message.replace(/^HTTP\s*\d+\s*:\s*/i, "").trim();
    if (
      (content.startsWith('"') && content.endsWith('"')) ||
      (content.startsWith("'") && content.endsWith("'"))
    ) {
      content = content.slice(1, -1);
    }
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = null;
    }
    if (parsed) {
      if (parsed.errors) {
        applyFieldErrors(form, parsed.errors);
        return true;
      }
      applyFieldErrors(form, parsed);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function deleteTask(id) {
  if (!utils.confirmAction("Are you sure you want to delete this task?"))
    return;

  try {
    utils.showLoading();
    await API.Tasks.delete(id);
    utils.showSuccess("Task deleted successfully");
    await loadData();
  } catch (error) {
    console.error("Error deleting task:", error);
    utils.showError("Failed to delete task");
  } finally {
    utils.hideLoading();
  }
}
