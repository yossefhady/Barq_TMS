// Account Manager Tasks Review Page
auth.requireRole([USER_ROLES.ACCOUNT_MANAGER]);

let tasks = [];
let currentFilter = "pending-review";
let currentTaskForReview = null;
let currentUser = null;

// Task Review Workflow Status Codes
// NOTE: These should match your database status IDs
const TASK_STATUS = {
  PENDING: 0,
  IN_PROGRESS: 1,
  IN_REVIEW: 2,
  COMPLETED: 3,
  CANCELLED: 4,
  // Custom statuses for Account Manager workflow
  PENDING_AM_REVIEW: 6, // Team Leader submitted, waiting for Account Manager
  SENT_TO_CLIENT: 7, // Account Manager approved, sent to client
  CLIENT_REVIEW: 8, // Client is reviewing
  CLIENT_APPROVED: 9, // Client approved the task
  CLIENT_REJECTED: 10, // Client rejected, needs rework
};

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = auth.getCurrentUser();
  await loadTasks();
  setupEventListeners();
});

async function loadTasks() {
  try {
    utils.showLoading();

    // Load all data
    const [allTasks, allProjects] = await Promise.all([
      API.Tasks.getAll().catch(() => []),
      API.Projects.getAll().catch(() => []),
    ]);

    // Filter projects where current user is account manager
    const myProjects = allProjects.filter((project) => {
      const accountManagerId =
        project.accountManagerId || project.AccountManagerId;
      return accountManagerId === currentUser.userId;
    });

    const myProjectIds = new Set(
      myProjects.map((p) => p.projectId || p.ProjectId)
    );

    console.log(
      "[Tasks] My projects:",
      myProjects.length,
      "Total tasks before filter:",
      allTasks.length
    );

    // Filter tasks from my projects only
    tasks = allTasks
      .filter((task) => myProjectIds.has(task.projectId || task.ProjectId))
      .map((task) => ({
        TaskId: task.taskId || task.TaskId || task.id,
        Title: task.title || task.Title,
        Description: task.description || task.Description,
        ProjectId: task.projectId || task.ProjectId,
        ProjectName: task.projectName || task.ProjectName || "Unknown Project",
        ClientId: task.clientId || task.ClientId,
        ClientName: task.clientName || task.ClientName || "Unknown Client",
        AssignedToId:
          task.assignedTo ||
          task.assignedToId ||
          task.AssignedToId ||
          task.AssignedTo,
        AssignedToName:
          task.assignedToName || task.AssignedToName || "Unassigned",
        CreatedBy: task.createdBy || task.CreatedBy,
        CreatedByName: task.createdByName || task.CreatedByName || "Unknown",
        DueDate: task.dueDate || task.DueDate,
        StatusId: task.statusId !== undefined ? task.statusId : (task.StatusId !== undefined ? task.StatusId : TASK_STATUS.PENDING),
        Status: task.status || task.Status || "Pending",
        PriorityId: task.priorityId !== undefined ? task.priorityId : (task.PriorityId !== undefined ? task.PriorityId : 1),
        Priority:
          task.priority ||
          task.Priority ||
          task.priorityLevel ||
          task.PriorityLevel ||
          "Medium",

        // Review workflow fields
        // NOTE: These fields need to be added to backend Task model
        ReviewStatus: task.reviewStatus || task.ReviewStatus || "Not Submitted",
        SubmittedForReview:
          task.submittedForReview || task.SubmittedForReview || false,
        AccountManagerApproved:
          task.accountManagerApproved || task.AccountManagerApproved || false,
        AccountManagerNotes:
          task.accountManagerNotes || task.AccountManagerNotes || "",
        SentToClient: task.sentToClient || task.SentToClient || false,
        ClientApproved: task.clientApproved || task.ClientApproved || null,
        ClientFeedback: task.clientFeedback || task.ClientFeedback || "",
        ClientReviewDate:
          task.clientReviewDate || task.ClientReviewDate || null,
      }));

    console.log("[Tasks] Filtered to my tasks:", tasks.length);

    updateStats();
    renderTasks();
  } catch (error) {
    console.error("Error loading tasks:", error);
    utils.showError("Failed to load tasks");
  } finally {
    utils.hideLoading();
  }
}

function updateStats() {
  // Pending account manager review (Status = PENDING_AM_REVIEW or custom flag)
  const pendingReview = tasks.filter(
    (t) =>
      t.StatusId === TASK_STATUS.PENDING_AM_REVIEW ||
      (t.SubmittedForReview && !t.AccountManagerApproved && !t.SentToClient)
  ).length;

  // Sent to client (Status = SENT_TO_CLIENT or CLIENT_REVIEW)
  const sentToClient = tasks.filter(
    (t) =>
      t.StatusId === TASK_STATUS.SENT_TO_CLIENT ||
      t.StatusId === TASK_STATUS.CLIENT_REVIEW ||
      (t.AccountManagerApproved && t.SentToClient && t.ClientApproved === null)
  ).length;

  // Approved by client (Status = CLIENT_APPROVED)
  const approved = tasks.filter(
    (t) =>
      t.StatusId === TASK_STATUS.CLIENT_APPROVED || t.ClientApproved === true
  ).length;

  // Rejected by client (Status = CLIENT_REJECTED, needs rework)
  const rejected = tasks.filter(
    (t) =>
      t.StatusId === TASK_STATUS.CLIENT_REJECTED || t.ClientApproved === false
  ).length;

  document.getElementById("pendingMyReview").textContent = pendingReview;
  document.getElementById("sentToClient").textContent = sentToClient;
  document.getElementById("approvedCount").textContent = approved;
  document.getElementById("rejectedCount").textContent = rejected;

  // Update badges
  document.getElementById("badge-pending-review").textContent = pendingReview;
  document.getElementById("badge-sent-to-client").textContent = sentToClient;
  document.getElementById("badge-client-feedback").textContent = rejected;
}

function filterTasks(filter) {
  currentFilter = filter;

  // Update active tab
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.filter === filter) {
      btn.classList.add("active");
    }
  });

  // Update table title
  const titles = {
    "pending-review": "Tasks Pending Your Review",
    "sent-to-client": "Tasks Sent to Client",
    "client-feedback": "Tasks with Client Feedback",
    approved: "Approved Tasks",
  };
  document.getElementById("tableTitle").textContent = titles[filter];

  renderTasks();
}

function renderTasks() {
  const tbody = document.getElementById("tasksBody");

  // Filter tasks based on current filter
  let filteredTasks = [];

  switch (currentFilter) {
    case "pending-review":
      // Tasks waiting for account manager review
      filteredTasks = tasks.filter(
        (t) =>
          t.StatusId === TASK_STATUS.PENDING_AM_REVIEW ||
          (t.SubmittedForReview && !t.AccountManagerApproved && !t.SentToClient)
      );
      break;
    case "sent-to-client":
      // Tasks sent to client, awaiting client review
      filteredTasks = tasks.filter(
        (t) =>
          t.StatusId === TASK_STATUS.SENT_TO_CLIENT ||
          t.StatusId === TASK_STATUS.CLIENT_REVIEW ||
          (t.AccountManagerApproved &&
            t.SentToClient &&
            t.ClientApproved === null)
      );
      break;
    case "client-feedback":
      // Tasks rejected by client, need rework
      filteredTasks = tasks.filter(
        (t) =>
          t.StatusId === TASK_STATUS.CLIENT_REJECTED ||
          t.ClientApproved === false
      );
      break;
    case "approved":
      // Tasks approved by client
      filteredTasks = tasks.filter(
        (t) =>
          t.StatusId === TASK_STATUS.CLIENT_APPROVED ||
          t.ClientApproved === true
      );
      break;
  }

  if (filteredTasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No Tasks Found</h3>
            <p>There are no tasks in this category.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredTasks
    .map((task) => {
      const dueDate = task.DueDate
        ? new Date(task.DueDate).toLocaleDateString()
        : "-";

      const statusBadge = getStatusBadge(task);
      const priorityClass = getPriorityClass(task.Priority);

      let actionButtons = "";

      if (currentFilter === "pending-review") {
        actionButtons = `
          <button class="btn btn-sm btn-primary" onclick="reviewTask(${task.TaskId})" title="Review Task">
            <i class="fa-solid fa-clipboard-check"></i> Review
          </button>
        `;
      } else if (currentFilter === "sent-to-client") {
        actionButtons = `
          <button class="btn btn-sm btn-info" onclick="viewTask(${task.TaskId})" title="View Task">
            <i class="fa-solid fa-eye"></i> View
          </button>
        `;
      } else if (currentFilter === "client-feedback") {
        actionButtons = `
          <button class="btn btn-sm btn-warning" onclick="viewClientFeedback(${task.TaskId})" title="View Feedback">
            <i class="fa-solid fa-comment-dots"></i> View Feedback
          </button>
          <button class="btn btn-sm btn-primary" onclick="sendBackToEmployee(${task.TaskId})" title="Send to Employee">
            <i class="fa-solid fa-reply"></i> Send Back
          </button>
        `;
      } else {
        actionButtons = `
          <button class="btn btn-sm btn-success" onclick="viewTask(${task.TaskId})" title="View Task">
            <i class="fa-solid fa-check-circle"></i> Completed
          </button>
        `;
      }

      return `
        <tr>
          <td>
            <strong>${task.Title}</strong>
            <div style="font-size: var(--text-sm); color: var(--text-secondary);">
              <span class="badge ${priorityClass}">${task.Priority}</span>
            </div>
          </td>
          <td>${task.ProjectName}</td>
          <td>${task.ClientName}</td>
          <td>${task.AssignedToName}</td>
          <td>${dueDate}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function getStatusBadge(task) {
  if (task.ClientApproved === true) {
    return '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Client Approved</span>';
  } else if (task.ClientApproved === false) {
    return '<span class="badge badge-danger"><i class="fa-solid fa-times"></i> Client Rejected</span>';
  } else if (task.SentToClient) {
    return '<span class="badge badge-info"><i class="fa-solid fa-paper-plane"></i> With Client</span>';
  } else if (task.AccountManagerApproved) {
    return '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Approved</span>';
  } else if (task.SubmittedForReview) {
    return '<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Pending Review</span>';
  }
  return '<span class="badge badge-secondary">In Progress</span>';
}

function getPriorityClass(priority) {
  const priorityMap = {
    Low: "badge-info",
    Medium: "badge-warning",
    High: "badge-danger",
    Urgent: "badge-danger",
  };
  return priorityMap[priority] || "badge-secondary";
}

async function reviewTask(taskId) {
  currentTaskForReview = tasks.find((t) => t.TaskId === taskId);
  if (!currentTaskForReview) return;

  // Load task details with comments
  try {
    const taskDetails = await API.Tasks.getById(taskId);
    const comments = await API.Tasks.getComments(taskId).catch(() => []);

    renderTaskDetailsInModal(taskDetails, comments);
    document.getElementById("reviewModal").classList.remove("d-none");
  } catch (error) {
    console.error("Error loading task details:", error);
    utils.showError("Failed to load task details");
  }
}

function renderTaskDetailsInModal(task, comments) {
  const detailsContainer = document.getElementById("taskDetails");

  const dueDate =
    task.dueDate || task.DueDate
      ? new Date(task.dueDate || task.DueDate).toLocaleDateString()
      : "Not set";

  detailsContainer.innerHTML = `
    <div class="details-grid" style="margin-bottom: var(--space-4);">
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-heading"></i> Task Title</label>
        <div class="detail-value">${task.title || task.Title}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-calendar"></i> Due Date</label>
        <div class="detail-value">${dueDate}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user"></i> Assigned To</label>
        <div class="detail-value">${
          task.assignedToName || task.AssignedToName || "Unassigned"
        }</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-flag"></i> Priority</label>
        <div class="detail-value"><span class="badge ${getPriorityClass(
          task.priority || task.Priority
        )}">${task.priority || task.Priority}</span></div>
      </div>
    </div>
    <div class="detail-item" style="margin-bottom: var(--space-4);">
      <label class="detail-label"><i class="fa-solid fa-align-left"></i> Description</label>
      <div class="detail-value">${
        task.description || task.Description || "No description"
      }</div>
    </div>
    ${
      comments && comments.length > 0
        ? `
      <div style="margin-top: var(--space-4);">
        <h4 style="margin-bottom: var(--space-3);"><i class="fa-solid fa-comments"></i> Comments</h4>
        <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-2);">
          ${comments
            .map(
              (c) => `
            <div style="padding: var(--space-3); background: var(--surface-secondary); border-radius: var(--radius-md); border-left: 3px solid var(--primary-color);">
              <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2);">
                <strong>${c.userName || c.UserName || "User"}</strong>
                <span style="font-size: var(--text-sm); color: var(--text-secondary);">${new Date(
                  c.createdAt || c.CreatedAt
                ).toLocaleString()}</span>
              </div>
              <p style="margin: 0;">${c.comment || c.Comment}</p>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
        : ""
    }
  `;
}

function closeReviewModal() {
  document.getElementById("reviewModal").classList.add("d-none");
  document.getElementById("reviewNotes").value = "";
  currentTaskForReview = null;
}

async function approveAndSendToClient() {
  if (!currentTaskForReview) return;

  const notes = document.getElementById("reviewNotes").value;

  if (
    !confirm(
      `Are you sure you want to approve this task and send it to ${currentTaskForReview.ClientName}?`
    )
  ) {
    return;
  }

  try {
    utils.showLoading();

    // IMPLEMENTATION: Update task status to SENT_TO_CLIENT
    await API.Tasks.update(currentTaskForReview.TaskId, {
      StatusId: TASK_STATUS.SENT_TO_CLIENT,
      // NOTE: These fields require backend support
      AccountManagerApproved: true,
      SentToClient: true,
      AccountManagerNotes: notes || "Approved by Account Manager",
    });

    // Add audit comment
    await API.Tasks.addComment(
      currentTaskForReview.TaskId,
      `[ACCOUNT MANAGER APPROVED]\n${
        notes || "Task approved and sent to client for review."
      }`
    );

    // PLACEHOLDER: Notify client user
    // NOTE: Requires backend endpoint to get client user ID from project/client
    // await notifyClientUser(currentTaskForReview.ClientId, currentTaskForReview.TaskId);
    console.log(
      "[PLACEHOLDER] Should notify client user for task:",
      currentTaskForReview.TaskId
    );

    // Notify team leader that task was approved
    if (currentTaskForReview.AssignedToId) {
      await API.Notifications.create({
        UserId: currentTaskForReview.AssignedToId,
        Message: `Your task "${currentTaskForReview.Title}" was approved and sent to the client`,
        TaskId: currentTaskForReview.TaskId,
        ProjectId: currentTaskForReview.ProjectId,
      }).catch((err) => console.warn("Failed to send notification:", err));
    }

    utils.showSuccess(
      `Task approved and sent to ${currentTaskForReview.ClientName}`
    );

    closeReviewModal();
    await loadTasks();
  } catch (error) {
    console.error("Error approving task:", error);
    utils.showError("Failed to approve task");
  } finally {
    utils.hideLoading();
  }
}

async function rejectTask() {
  if (!currentTaskForReview) return;

  const notes = document.getElementById("reviewNotes").value;

  if (!notes) {
    utils.showError("Please provide feedback for rejection");
    return;
  }

  if (
    !confirm(
      `Are you sure you want to reject this task? It will be sent back to ${currentTaskForReview.AssignedToName}.`
    )
  ) {
    return;
  }

  try {
    utils.showLoading();

    // IMPLEMENTATION: Update task status back to IN_PROGRESS
    await API.Tasks.update(currentTaskForReview.TaskId, {
      StatusId: TASK_STATUS.IN_PROGRESS,
      // NOTE: These fields require backend support
      AccountManagerApproved: false,
      SentToClient: false,
      AccountManagerNotes: notes,
    });

    // Add rejection comment with feedback
    await API.Tasks.addComment(
      currentTaskForReview.TaskId,
      `[ACCOUNT MANAGER REJECTED]\n\n${notes}\n\nPlease address the feedback and resubmit.`
    );

    // Notify team leader/employee
    if (currentTaskForReview.AssignedToId) {
      await API.Notifications.create({
        UserId: currentTaskForReview.AssignedToId,
        Message: `Your task "${currentTaskForReview.Title}" needs revision. Check the comments for details.`,
        TaskId: currentTaskForReview.TaskId,
        ProjectId: currentTaskForReview.ProjectId,
      }).catch((err) => console.warn("Failed to send notification:", err));
    }

    utils.showSuccess(
      `Task rejected and sent back to ${currentTaskForReview.AssignedToName}`
    );

    closeReviewModal();
    await loadTasks();
  } catch (error) {
    console.error("Error rejecting task:", error);
    utils.showError("Failed to reject task");
  } finally {
    utils.hideLoading();
  }
}

async function viewClientFeedback(taskId) {
  const task = tasks.find((t) => t.TaskId === taskId);
  if (!task) return;

  // Show client feedback in a modal or alert
  alert(
    `Client Feedback for: ${task.Title}\n\n${
      task.ClientFeedback || "No feedback provided"
    }`
  );
}

async function sendBackToEmployee(taskId) {
  const task = tasks.find((t) => t.TaskId === taskId);
  if (!task) return;

  const clientFeedback = task.ClientFeedback || "No specific feedback provided";

  const feedback = prompt(
    `CLIENT FEEDBACK:\n${clientFeedback}\n\nAdd your instructions to ${task.AssignedToName}:`
  );

  if (!feedback) return;

  try {
    utils.showLoading();

    // IMPLEMENTATION: Reset task status to IN_PROGRESS for rework
    await API.Tasks.update(taskId, {
      StatusId: TASK_STATUS.IN_PROGRESS,
      // NOTE: These fields require backend support
      ClientApproved: false,
      SentToClient: false,
      AccountManagerApproved: false,
    });

    // Add combined feedback comment
    await API.Tasks.addComment(
      taskId,
      `[CLIENT REJECTED - NEEDS REWORK]\n\n` +
        `CLIENT FEEDBACK:\n${clientFeedback}\n\n` +
        `ACCOUNT MANAGER INSTRUCTIONS:\n${feedback}`
    );

    // Notify team leader/employee
    if (task.AssignedToId) {
      await API.Notifications.create({
        UserId: task.AssignedToId,
        Message: `Task "${task.Title}" rejected by client. Requires rework. Check comments for details.`,
        TaskId: taskId,
        ProjectId: task.ProjectId,
      }).catch((err) => console.warn("Failed to send notification:", err));
    }

    utils.showSuccess(`Task sent back to ${task.AssignedToName} for rework`);

    await loadTasks();
  } catch (error) {
    console.error("Error sending task back:", error);
    utils.showError("Failed to send task back");
  } finally {
    utils.hideLoading();
  }
}

function viewTask(taskId) {
  window.open(`../manager/tasks.html?id=${taskId}`, "_blank");
}

function setupEventListeners() {
  document
    .getElementById("searchInput")
    .addEventListener("input", handleSearch);

  // File upload listener (if file input exists in modal)
  const fileInput = document.getElementById("taskFileUpload");
  if (fileInput) {
    fileInput.addEventListener("change", handleFileSelection);
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

// ============================================================================
// FILE UPLOAD FUNCTIONALITY
// ============================================================================

let selectedFiles = [];

function handleFileSelection(e) {
  selectedFiles = Array.from(e.target.files);
  updateFileList();
}

function updateFileList() {
  const container = document.getElementById("selectedFilesList");
  if (!container) return;

  if (selectedFiles.length === 0) {
    container.innerHTML = '<p class="text-secondary">No files selected</p>';
    return;
  }

  container.innerHTML = selectedFiles
    .map(
      (file, index) => `
    <div class="file-item" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2); background: var(--surface-secondary); border-radius: var(--radius-sm); margin-bottom: var(--space-2);">
      <div>
        <i class="fa-solid fa-file"></i>
        <span>${file.name}</span>
        <span class="text-secondary" style="font-size: var(--text-sm);"> (${formatFileSize(
          file.size
        )})</span>
      </div>
      <button class="btn btn-sm btn-danger" onclick="removeFile(${index})" type="button">
        <i class="fa-solid fa-times"></i>
      </button>
    </div>
  `
    )
    .join("");
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateFileList();
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

async function uploadTaskFiles() {
  if (!currentTaskForReview || selectedFiles.length === 0) {
    utils.showError("No files selected");
    return;
  }

  try {
    utils.showLoading();

    // Upload each file
    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);

      await API.Files.upload(currentTaskForReview.TaskId, formData);
      console.log(`Uploaded: ${file.name}`);
    }

    utils.showSuccess(`${selectedFiles.length} file(s) uploaded successfully`);
    selectedFiles = [];
    updateFileList();

    // Reload task details to show new attachments
    await reviewTask(currentTaskForReview.TaskId);
  } catch (error) {
    console.error("Error uploading files:", error);
    utils.showError("Failed to upload files");
  } finally {
    utils.hideLoading();
  }
}

// ============================================================================
// PLACEHOLDER FUNCTIONS FOR BACKEND ENDPOINTS
// ============================================================================

/**
 * PLACEHOLDER: Get client user ID from client/project
 *
 * BACKEND REQUIREMENT:
 * - Add endpoint: GET /api/Clients/{clientId}/users
 *   Returns: [{ userId, userName, email, role }]
 *
 * - Or add field to Project model: ClientUserId
 *
 * USAGE: To notify client when task is ready for review
 */
async function getClientUserId(clientId, projectId) {
  console.warn("[PLACEHOLDER] getClientUserId - Backend endpoint needed");
  console.log("Need endpoint: GET /api/Clients/" + clientId + "/users");

  // WORKAROUND: Return null for now
  // When backend is ready, implement:
  // const clientUsers = await API.Clients.getUsers(clientId);
  // return clientUsers.find(u => u.role === 'ClientAdmin')?.userId;

  return null;
}

/**
 * PLACEHOLDER: Notify client user about task ready for review
 *
 * BACKEND REQUIREMENT:
 * - Ensure Notifications API accepts notifications for client users
 * - Add email notification trigger for client users
 *
 * USAGE: Called when account manager approves task
 */
async function notifyClientUser(clientId, taskId) {
  console.warn(
    "[PLACEHOLDER] notifyClientUser - Requires client user association"
  );

  const clientUserId = await getClientUserId(clientId);

  if (!clientUserId) {
    console.log("[PLACEHOLDER] No client user ID found, skipping notification");
    return;
  }

  // When backend is ready:
  // await API.Notifications.create({
  //   UserId: clientUserId,
  //   Message: `Task ready for your review: ${taskTitle}`,
  //   TaskId: taskId
  // });
}

/**
 * PLACEHOLDER: Submit task for account manager review (Team Leader action)
 *
 * BACKEND REQUIREMENT:
 * - Add endpoint: PUT /api/Tasks/{id}/submit-for-review
 *   Body: { notes: string }
 *   Updates: StatusId to PENDING_AM_REVIEW, SubmittedForReview = true
 *
 * CURRENT WORKAROUND: Team leader can update status manually
 */
async function submitTaskForReview(taskId, notes) {
  console.warn(
    "[PLACEHOLDER] submitTaskForReview - Should be in Team Leader page"
  );
  console.log("Need endpoint: PUT /api/Tasks/" + taskId + "/submit-for-review");

  // WORKAROUND:
  await API.Tasks.update(taskId, {
    StatusId: TASK_STATUS.PENDING_AM_REVIEW,
    SubmittedForReview: true,
  });

  await API.Tasks.addComment(
    taskId,
    `[SUBMITTED FOR REVIEW]\n${notes || "Ready for Account Manager review"}`
  );
}

/**
 * PLACEHOLDER: Client approves task
 *
 * BACKEND REQUIREMENT:
 * - Add endpoint: PUT /api/Tasks/{id}/client-approve
 *   Body: { notes: string, clientUserId: int }
 *   Updates: StatusId to CLIENT_APPROVED, ClientApproved = true
 *
 * - Add client portal page for task review
 *
 * USAGE: Called from client portal (not account manager page)
 */
async function clientApproveTask(taskId, notes, clientUserId) {
  console.warn("[PLACEHOLDER] clientApproveTask - Requires client portal");
  console.log("Need endpoint: PUT /api/Tasks/" + taskId + "/client-approve");

  // When backend is ready:
  // await API.Tasks.clientApprove(taskId, {
  //   notes: notes,
  //   clientUserId: clientUserId,
  //   approved: true
  // });
}

/**
 * PLACEHOLDER: Client rejects task with feedback
 *
 * BACKEND REQUIREMENT:
 * - Add endpoint: PUT /api/Tasks/{id}/client-reject
 *   Body: { feedback: string, clientUserId: int }
 *   Updates: StatusId to CLIENT_REJECTED, ClientApproved = false, ClientFeedback
 *
 * - Add client portal page for task review
 *
 * USAGE: Called from client portal (not account manager page)
 */
async function clientRejectTask(taskId, feedback, clientUserId) {
  console.warn("[PLACEHOLDER] clientRejectTask - Requires client portal");
  console.log("Need endpoint: PUT /api/Tasks/" + taskId + "/client-reject");

  // When backend is ready:
  // await API.Tasks.clientReject(taskId, {
  //   feedback: feedback,
  //   clientUserId: clientUserId,
  //   approved: false
  // });
}
