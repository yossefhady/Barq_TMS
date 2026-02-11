// Client Task Reviews Page
let currentFilter = "pending";
let allTasks = [];
let currentReviewTask = null;

// Initialize
auth.requireRole([USER_ROLES.CLIENT]);

// Load initial data
loadTasks();

// Load tasks
async function loadTasks() {
  try {
    const data = await API.Tasks.getAll();
    allTasks = data.tasks || data || [];

    // Get current user
    const currentUser = auth.getCurrentUser();

    // Filter tasks that are sent to this client for review
    // Status: AccountManagerApproved, SentToClient, ClientApproved, ClientRejected
    allTasks = allTasks.filter((task) => {
      // Filter by client ID or project client
      return (
        task.status === "AccountManagerApproved" ||
        task.status === "SentToClient" ||
        task.status === "ClientApproved" ||
        task.status === "ClientRejected"
      );
    });

    updateStatistics();
    renderTasks();
  } catch (error) {
    console.error("Failed to load tasks:", error);
    showNotification("Failed to load tasks", "error");
  }
}

// Update statistics
function updateStatistics() {
  const pending = allTasks.filter(
    (t) => t.status === "AccountManagerApproved" || t.status === "SentToClient"
  ).length;

  const approved = allTasks.filter((t) => t.status === "ClientApproved").length;

  const rejected = allTasks.filter((t) => t.status === "ClientRejected").length;

  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("approvedCount").textContent = approved;
  document.getElementById("rejectedCount").textContent = rejected;
  document.getElementById("totalCount").textContent = allTasks.length;

  // Update badges
  document.getElementById("badge-pending").textContent = pending;
  document.getElementById("badge-approved").textContent = approved;
  document.getElementById("badge-rejected").textContent = rejected;
}

// Filter tasks
function filterTasks(filter) {
  currentFilter = filter;

  // Update active tab
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-filter="${filter}"]`).classList.add("active");

  // Update table title
  const titles = {
    pending: "Tasks Pending Your Review",
    approved: "Approved Tasks",
    rejected: "Rejected Tasks",
    all: "All Tasks",
  };
  document.getElementById("tableTitle").textContent = titles[filter];

  renderTasks();
}

// Render tasks
function renderTasks() {
  const tbody = document.getElementById("tasksBody");

  let filteredTasks = [];

  if (currentFilter === "pending") {
    filteredTasks = allTasks.filter(
      (t) =>
        t.status === "AccountManagerApproved" || t.status === "SentToClient"
    );
  } else if (currentFilter === "approved") {
    filteredTasks = allTasks.filter((t) => t.status === "ClientApproved");
  } else if (currentFilter === "rejected") {
    filteredTasks = allTasks.filter((t) => t.status === "ClientRejected");
  } else {
    filteredTasks = allTasks;
  }

  if (filteredTasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 40px; color: var(--text-secondary)">
          <i class="fa-solid fa-inbox" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 16px"></i>
          No tasks found
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredTasks
    .map(
      (task) => `
    <tr>
      <td>
        <strong>${task.name}</strong>
        ${
          task.description
            ? `<br><small style="color: var(--text-secondary)">${task.description.substring(
                0,
                80
              )}...</small>`
            : ""
        }
      </td>
      <td>${task.projectName || "N/A"}</td>
      <td>
        <span class="badge badge-${getPriorityClass(task.priority)}">
          ${task.priority || "Medium"}
        </span>
      </td>
      <td>
        <span class="badge badge-${getStatusClass(task.status)}">
          ${formatStatus(task.status)}
        </span>
      </td>
      <td>
        ${
          task.dueDate
            ? `
          <span style="color: ${
            isOverdue(task.dueDate) ? "var(--color-danger)" : "inherit"
          }">
            ${formatDate(task.dueDate)}
          </span>
        `
            : "N/A"
        }
      </td>
      <td>${task.submittedDate ? formatDate(task.submittedDate) : "N/A"}</td>
      <td>
        <div style="display: flex; gap: var(--space-2)">
          ${
            task.status === "AccountManagerApproved" ||
            task.status === "SentToClient"
              ? `
            <button class="btn btn-sm btn-primary" onclick="reviewTask(${task.id})">
              <i class="fa-solid fa-clipboard-check"></i> Review
            </button>
          `
              : `
            <button class="btn btn-sm btn-secondary" onclick="viewTaskDetails(${task.id})">
              <i class="fa-solid fa-eye"></i> View
            </button>
          `
          }
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

// Review task
function reviewTask(taskId) {
  currentReviewTask = allTasks.find((t) => t.id === taskId);
  if (!currentReviewTask) return;

  document.getElementById("taskDetailsReview").innerHTML = `
    <div class="details-grid">
      <div class="detail-item">
        <span class="detail-label">Task Name</span>
        <span class="detail-value">${currentReviewTask.name}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Project</span>
        <span class="detail-value">${
          currentReviewTask.projectName || "N/A"
        }</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Priority</span>
        <span class="detail-value">
          <span class="badge badge-${getPriorityClass(
            currentReviewTask.priority
          )}">
            ${currentReviewTask.priority || "Medium"}
          </span>
        </span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Due Date</span>
        <span class="detail-value">${
          currentReviewTask.dueDate
            ? formatDate(currentReviewTask.dueDate)
            : "N/A"
        }</span>
      </div>
      <div class="detail-item" style="grid-column: 1 / -1">
        <span class="detail-label">Description</span>
        <span class="detail-value">${
          currentReviewTask.description || "No description"
        }</span>
      </div>
      <div class="detail-item" style="grid-column: 1 / -1">
        <span class="detail-label">Work Completed</span>
        <span class="detail-value" style="background: var(--surface-secondary); padding: var(--space-3); border-radius: var(--radius-md);">
          ${currentReviewTask.completionNotes || "No completion notes provided"}
        </span>
      </div>
      ${
        currentReviewTask.attachments &&
        currentReviewTask.attachments.length > 0
          ? `
        <div class="detail-item" style="grid-column: 1 / -1">
          <span class="detail-label">Attachments</span>
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            ${currentReviewTask.attachments
              .map(
                (att) => `
              <a href="${att.url}" target="_blank" class="btn btn-sm btn-secondary">
                <i class="fa-solid fa-paperclip"></i> ${att.name}
              </a>
            `
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  document.getElementById("reviewModal").classList.remove("d-none");
}

// Close review modal
function closeReviewModal() {
  document.getElementById("reviewModal").classList.add("d-none");
  document.getElementById("clientFeedback").value = "";
  currentReviewTask = null;
}

// Approve task
async function approveTask() {
  if (!currentReviewTask) return;

  const feedback = document.getElementById("clientFeedback").value;

  try {
    // Update task status to client approved
    await API.Tasks.update(currentReviewTask.id, {
      status: "ClientApproved",
      clientFeedback: feedback,
    });

    // Add comment
    if (feedback) {
      await API.Tasks.addComment(currentReviewTask.id, {
        comment: `Task approved by client: ${feedback}`,
      });
    }

    showNotification("Task approved successfully", "success");
    closeReviewModal();
    loadTasks();
  } catch (error) {
    console.error("Failed to approve task:", error);
    showNotification("Failed to approve task", "error");
  }
}

// Reject task
async function rejectTask() {
  if (!currentReviewTask) return;

  const feedback = document.getElementById("clientFeedback").value;

  if (!feedback.trim()) {
    showNotification("Please provide feedback for rejection", "warning");
    return;
  }

  try {
    // Update task status to client rejected
    await API.Tasks.update(currentReviewTask.id, {
      status: "ClientRejected",
      clientFeedback: feedback,
    });

    // Add comment
    await API.Tasks.addComment(currentReviewTask.id, {
      comment: `Task rejected by client - Needs revision: ${feedback}`,
    });

    showNotification("Task rejected and sent back for revision", "info");
    closeReviewModal();
    loadTasks();
  } catch (error) {
    console.error("Failed to reject task:", error);
    showNotification("Failed to reject task", "error");
  }
}

// View task details (read-only)
function viewTaskDetails(taskId) {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) return;

  alert(
    `Task Details:\n\nName: ${task.name}\nDescription: ${
      task.description || "N/A"
    }\nStatus: ${formatStatus(task.status)}\nPriority: ${
      task.priority
    }\nDue Date: ${task.dueDate ? formatDate(task.dueDate) : "N/A"}`
  );
}

// Helper functions
function getPriorityClass(priority) {
  const classes = {
    Low: "success",
    Medium: "warning",
    High: "danger",
    Critical: "danger",
  };
  return classes[priority] || "secondary";
}

function getStatusClass(status) {
  const classes = {
    NotStarted: "secondary",
    InProgress: "primary",
    SubmittedForReview: "info",
    AccountManagerApproved: "warning",
    SentToClient: "warning",
    ClientApproved: "success",
    ClientRejected: "danger",
    Completed: "success",
  };
  return classes[status] || "secondary";
}

function formatStatus(status) {
  const statusMap = {
    AccountManagerApproved: "Pending Review",
    SentToClient: "Pending Review",
    ClientApproved: "Approved",
    ClientRejected: "Rejected",
  };
  return statusMap[status] || status.replace(/([A-Z])/g, " $1").trim();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(dateString) {
  return new Date(dateString) < new Date();
}

// Search functionality
document.getElementById("searchInput").addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll("#tasksBody tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
});
