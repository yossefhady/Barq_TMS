// Account Manager - My Tasks Page
auth.requireRole([USER_ROLES.ACCOUNT_MANAGER]);

let tasks = [];
let teamLeaders = [];
let currentFilter = "received";
let currentTaskForAction = null;
let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = auth.getCurrentUser();
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();

    // Load tasks assigned to current user
    const allTasks = await API.Tasks.getAll().catch(() => []);

    // Load projects for team leader filtering
    const allProjects = await API.Projects.getAll().catch(() => []);
    window.projectsData = allProjects; // Store for delegation modal

    // Load team leaders and employees for delegation
    const allUsers = await API.Users.getAll().catch(() => []);
    teamLeaders = allUsers.filter(
      (u) =>
        u.roleId === 4 ||
        u.RoleId === 4 || // Team Leader role
        u.roleId === 5 ||
        u.RoleId === 5 || // Employee role
        u.roleName === "Team Leader" ||
        u.RoleName === "Team Leader" ||
        u.roleName === "Employee" ||
        u.RoleName === "Employee"
    );
    window.allTeamLeaders = teamLeaders; // Store for delegation modal

    // Populate team leader/employee dropdown
    populateTeamLeaderSelect();

    // Filter and normalize tasks
    tasks = allTasks
      .filter((task) => {
        const assignedToId =
          task.assignedTo ||
          task.AssignedTo ||
          task.assignedToId ||
          task.AssignedToId;
        const createdById =
          task.createdBy ||
          task.CreatedBy ||
          task.createdById ||
          task.CreatedById;
        const delegatedById =
          task.delegatedBy ||
          task.DelegatedBy ||
          task.delegatedById ||
          task.DelegatedById;
        const currentUserId = currentUser.UserId || currentUser.userId;

        // Include tasks assigned to me OR delegated by me OR created by me
        return (
          assignedToId === currentUserId ||
          delegatedById === currentUserId ||
          createdById === currentUserId
        );
      })
      .map((task) => {
        const assignedToId =
          task.assignedTo ||
          task.AssignedTo ||
          task.assignedToId ||
          task.AssignedToId;
        const delegatedById =
          task.delegatedBy ||
          task.DelegatedBy ||
          task.delegatedById ||
          task.DelegatedById;
        const isAssignedToMe =
          assignedToId === currentUser.UserId ||
          assignedToId === currentUser.userId;
        const iDelegatedThisTask =
          delegatedById === currentUser.UserId ||
          delegatedById === currentUser.userId;

        return {
          TaskId: task.taskId || task.TaskId || task.id,
          Title: task.title || task.Title,
          Description: task.description || task.Description,
          ProjectId: task.projectId || task.ProjectId,
          ProjectName:
            task.projectName || task.ProjectName || "Unknown Project",
          Status:
            task.statusName ||
            task.StatusName ||
            task.status ||
            task.Status ||
            "Pending",
          StatusName:
            task.statusName ||
            task.StatusName ||
            task.status ||
            task.Status ||
            "Pending",
          Priority:
            task.priorityLevel ||
            task.PriorityLevel ||
            task.priority ||
            task.Priority ||
            "Medium",
          PriorityLevel:
            task.priorityLevel ||
            task.PriorityLevel ||
            task.priority ||
            task.Priority ||
            "Medium",
          DueDate: task.dueDate || task.DueDate,
          AssignedToId: assignedToId,
          AssignedToName:
            task.assignedToName || task.AssignedToName || "Unassigned",
          CreatedById: task.createdById || task.CreatedById,
          DelegatedById: delegatedById,
          DelegatedBy: delegatedById,
          OriginalAssignerId:
            task.originalAssignerId || task.OriginalAssignerId,
          // IsDelegated means: I passed this task to someone else (I'm the delegator, NOT the assignee)
          IsDelegated: iDelegatedThisTask && !isAssignedToMe,
          IsAssignedToMe: isAssignedToMe,
        };
      });

    updateStats();
    renderTasks();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load tasks");
  } finally {
    utils.hideLoading();
  }
}

function populateTeamLeaderSelect() {
  const select = document.getElementById("teamLeaderSelect");
  select.innerHTML = '<option value="">Select a user...</option>';

  teamLeaders.forEach((leader) => {
    const option = document.createElement("option");
    option.value = leader.userId || leader.UserId || leader.id;
    const roleName = leader.roleName || leader.RoleName || "";
    option.textContent = `${leader.firstName || leader.FirstName} ${
      leader.lastName || leader.LastName
    } (${roleName})`;
    select.appendChild(option);
  });
}

function updateStats() {
  // Tasks received from manager (assigned to me, not delegated)
  const received = tasks.filter(
    (t) => t.IsAssignedToMe && !t.IsDelegated && t.Status !== "Completed"
  ).length;

  // My active tasks (working on personally)
  const myActive = tasks.filter(
    (t) => t.IsAssignedToMe && !t.IsDelegated && t.Status !== "Completed"
  ).length;

  // Delegated to team leaders
  const delegated = tasks.filter(
    (t) => t.IsDelegated && t.Status !== "Completed"
  ).length;

  // Tasks needing review (delegated and in review status)
  const needingReview = tasks.filter(
    (t) => t.IsDelegated && t.StatusName === "In Review"
  ).length;

  // Completed tasks
  const completed = tasks.filter((t) => t.Status === "Completed").length;

  document.getElementById("receivedFromManager").textContent = received;
  document.getElementById("myActiveTasks").textContent = myActive;
  document.getElementById("delegatedToTeam").textContent = delegated;
  document.getElementById("completedTasks").textContent = completed;

  // Update badges
  document.getElementById("badge-received").textContent = received;
  document.getElementById("badge-assigned").textContent = myActive;
  document.getElementById("badge-delegated").textContent = `${delegated}${
    needingReview > 0 ? ` (${needingReview} ⚠)` : ""
  }`;
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
    received: "Tasks Received from Manager",
    "assigned-to-me": "Tasks Assigned to Me",
    delegated: "Tasks Delegated to Team",
    completed: "Completed Tasks",
  };
  document.getElementById("tableTitle").textContent = titles[filter];

  renderTasks();
}

function renderTasks() {
  const tbody = document.getElementById("tasksBody");

  // Filter tasks based on current filter
  let filteredTasks = [];

  switch (currentFilter) {
    case "received":
      filteredTasks = tasks.filter(
        (t) => t.IsAssignedToMe && !t.IsDelegated && t.Status !== "Completed"
      );
      break;
    case "assigned-to-me":
      filteredTasks = tasks.filter(
        (t) => t.IsAssignedToMe && t.Status !== "Completed"
      );
      break;
    case "delegated":
      filteredTasks = tasks.filter(
        (t) => t.IsDelegated && t.Status !== "Completed"
      );
      break;
    case "completed":
      filteredTasks = tasks.filter((t) => t.Status === "Completed");
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
      // Properly map all fields from backend
      const title = utils.escapeHtml(task.Title || "");
      const projectName = utils.escapeHtml(task.ProjectName || "No Project");
      const statusName = task.StatusName || task.Status || "Unknown";
      const priorityLevel = task.PriorityLevel || task.Priority || "Medium";
      const assignedToName = utils.escapeHtml(task.AssignedToName || "Unassigned");

      const dueDate = task.DueDate
        ? new Date(task.DueDate).toLocaleDateString()
        : "-";

      const statusClass = getStatusClass(statusName);
      const priorityClass = getPriorityClass(priorityLevel);

      // Show who it's delegated to if delegated
      const delegatedInfo = task.IsDelegated
        ? `<span class="badge badge-info">${assignedToName}</span>`
        : '<span style="color: var(--text-secondary);">Not delegated</span>';

      let actionButtons = "";

      // Check if task needs review (status is "In Review" and I delegated it)
      const needsReview = statusName === "In Review" && task.IsDelegated;

      if (currentFilter === "received" || currentFilter === "assigned-to-me") {
        actionButtons = `
          <button class="btn btn-sm btn-primary" onclick="viewTaskDetails(${task.TaskId})" title="View Details">
            <i class="fa-solid fa-eye"></i> View
          </button>
          <button class="btn btn-sm btn-secondary" onclick="showDelegateTaskModal(${task.TaskId})" title="Delegate">
            <i class="fa-solid fa-share"></i> Delegate
          </button>
          <button class="btn btn-sm btn-success" onclick="completeTask(${task.TaskId})" title="Mark Complete">
            <i class="fa-solid fa-check"></i>
          </button>
        `;
      } else if (currentFilter === "delegated") {
        if (needsReview) {
          actionButtons = `
            <button class="btn btn-sm btn-warning" onclick="showReviewModal(${task.TaskId})" title="Review Completion">
              <i class="fa-solid fa-clipboard-check"></i> Review
            </button>
            <button class="btn btn-sm btn-primary" onclick="viewTaskDetails(${task.TaskId})" title="View Details">
              <i class="fa-solid fa-eye"></i> View
            </button>
          `;
        } else {
          actionButtons = `
            <button class="btn btn-sm btn-primary" onclick="viewTaskDetails(${task.TaskId})" title="View Details">
              <i class="fa-solid fa-eye"></i> View
            </button>
            <button class="btn btn-sm btn-info" onclick="followUpTask(${task.TaskId})" title="Follow Up">
              <i class="fa-solid fa-bell"></i> Follow Up
            </button>
          `;
        }
      } else {
        actionButtons = `
          <button class="btn btn-sm btn-success" onclick="viewTaskDetails(${task.TaskId})" title="View Details">
            <i class="fa-solid fa-check-circle"></i> View
          </button>
        `;
      }

      return `
        <tr ${needsReview ? 'style="background-color: #fff3cd;"' : ""}>
          <td>
            <strong>${title}</strong>
            ${
              task.IsDelegated
                ? '<br><span class="badge badge-warning" style="margin-top: 4px;"><i class="fa-solid fa-share"></i> Delegated</span>'
                : ""
            }
            ${
              needsReview
                ? '<br><span class="badge badge-danger" style="margin-top: 4px; animation: pulse 2s infinite;"><i class="fa-solid fa-exclamation-circle"></i> Needs Review</span>'
                : ""
            }
          </td>
          <td>${projectName}</td>
          <td><span class="badge ${statusClass}">${utils.escapeHtml(statusName)}</span></td>
          <td><span class="badge ${priorityClass}">${utils.escapeHtml(priorityLevel)}</span></td>
          <td>${dueDate}</td>
          <td>${delegatedInfo}</td>
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

function getStatusClass(status) {
  const statusMap = {
    "To Do": "badge-secondary",
    "In Progress": "badge-info",
    "In Review": "badge-warning",
    Done: "badge-success",
    Cancelled: "badge-danger",
  };
  return statusMap[status] || "badge-secondary";
}

function getPriorityClass(priority) {
  const priorityMap = {
    Low: "badge-info",
    Medium: "badge-warning",
    High: "badge-danger",
    Critical: "badge-danger",
  };
  return priorityMap[priority] || "badge-secondary";
}

// Delegate Modal Functions
function showDelegateModal() {
  document.getElementById("delegateModal").classList.remove("d-none");
  document.getElementById("delegateForm").reset();
}

function showDelegateTaskModal(taskId) {
  const task = tasks.find((t) => t.TaskId === taskId);
  if (!task) return;

  currentTaskForAction = task;
  document.getElementById("taskIdToDelegate").value = taskId;
  document.getElementById("taskNameDisplay").textContent = task.Title;

  // Set current due date as default
  if (task.DueDate) {
    const dueDate = new Date(task.DueDate);
    const dateStr = dueDate.toISOString().split("T")[0];
    document.getElementById("delegateDueDate").value = dateStr;
  }

  // Filter team leaders by project
  const select = document.getElementById("teamLeaderSelect");
  select.innerHTML = '<option value="">Select a user...</option>';

  // Find project for this task
  const projectId = task.ProjectId;
  if (projectId && window.projectsData) {
    const project = window.projectsData.find(
      (p) => (p.ProjectId || p.projectId) === projectId
    );
    if (project && project.TeamLeaderId) {
      // Show only the team leader assigned to this project
      const teamLeader = window.allTeamLeaders.find(
        (tl) => (tl.UserId || tl.userId) === project.TeamLeaderId
      );
      if (teamLeader) {
        const option = document.createElement("option");
        option.value = teamLeader.UserId || teamLeader.userId;
        option.textContent = `${
          teamLeader.Name || teamLeader.name || "Team Leader"
        } (Team Leader)`;
        select.appendChild(option);
      }

      // Also show employees under this team leader
      const teamEmployees = window.allTeamLeaders.filter(
        (emp) =>
          (emp.RoleId || emp.roleId) === 5 &&
          (emp.TeamLeaderId || emp.teamLeaderId) === project.TeamLeaderId
      );
      teamEmployees.forEach((emp) => {
        const option = document.createElement("option");
        option.value = emp.UserId || emp.userId;
        option.textContent = `${emp.Name || emp.name || "Employee"} (Employee)`;
        select.appendChild(option);
      });
    }
  }

  // If no team leader found, show all
  if (select.options.length === 1) {
    window.allTeamLeaders.forEach((leader) => {
      const option = document.createElement("option");
      option.value = leader.userId || leader.UserId;
      const roleName =
        (leader.RoleId || leader.roleId) === 4 ? "Team Leader" : "Employee";
      option.textContent = `${
        leader.Name || leader.name || "User"
      } (${roleName})`;
      select.appendChild(option);
    });
  }

  document.getElementById("delegateModal").classList.remove("d-none");
}

function closeDelegateModal() {
  document.getElementById("delegateModal").classList.add("d-none");
  document.getElementById("delegateForm").reset();
  currentTaskForAction = null;
}

// Form submit handler
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("delegateForm");
  if (form) {
    form.addEventListener("submit", handleDelegateSubmit);
  }
});

async function handleDelegateSubmit(e) {
  e.preventDefault();

  const taskId = document.getElementById("taskIdToDelegate").value;
  const teamLeaderId = document.getElementById("teamLeaderSelect").value;
  const notes = document.getElementById("delegateNotes").value;

  if (!taskId || !teamLeaderId) {
    utils.showError("Please select a team leader");
    return;
  }

  try {
    utils.showLoading();

    // Use the new pass task API endpoint
    await API.Tasks.passTask(parseInt(taskId), {
      assignToUserId: parseInt(teamLeaderId),
      notes: notes || null,
    });

    const teamLeader = teamLeaders.find(
      (l) => (l.userId || l.UserId) == teamLeaderId
    );
    const teamLeaderName = teamLeader
      ? `${teamLeader.firstName || teamLeader.FirstName} ${
          teamLeader.lastName || teamLeader.LastName
        }`
      : "team leader";

    console.log("Task passed:", {
      taskId,
      teamLeaderId,
      notes,
    });

    utils.showSuccess(`Task passed to ${teamLeaderName}`);

    closeDelegateModal();
    await loadData();
  } catch (error) {
    console.error("Error passing task:", error);
    utils.showError(error.message || "Failed to pass task");
  } finally {
    utils.hideLoading();
  }
}

// Review Modal Functions
async function showReviewModal(taskId) {
  const task = tasks.find((t) => t.TaskId === taskId);
  if (!task) return;

  currentTaskForAction = task;

  // Show task details in review modal
  document.getElementById("reviewTaskDetails").innerHTML = `
    <h4 style="margin-bottom: var(--space-3);"><i class="fa-solid fa-clipboard-list"></i> ${
      utils.escapeHtml(task.Title)
    }</h4>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3);">
      <div>
        <strong>Project:</strong> ${utils.escapeHtml(task.ProjectName)}
      </div>
      <div>
        <strong>Assigned To:</strong> ${utils.escapeHtml(task.AssignedToName)}
      </div>
      <div>
        <strong>Status:</strong> <span class="badge ${getStatusClass(
          task.StatusName
        )}">${utils.escapeHtml(task.StatusName)}</span>
      </div>
      <div>
        <strong>Priority:</strong> <span class="badge ${getPriorityClass(
          task.PriorityLevel
        )}">${utils.escapeHtml(task.PriorityLevel)}</span>
      </div>
    </div>
    ${
      task.Description
        ? `<div style="margin-top: var(--space-3);"><strong>Description:</strong><p>${utils.escapeHtml(task.Description)}</p></div>`
        : ""
    }
  `;

  // Setup form handler
  const form = document.getElementById("reviewForm");
  form.onsubmit = handleReviewSubmit;

  // Show/hide due date field based on action
  const actionSelect = document.getElementById("reviewAction");
  const dueDateGroup = document.getElementById("newDueDateGroup");
  actionSelect.onchange = function () {
    dueDateGroup.style.display = this.value === "reject" ? "block" : "none";
  };

  document.getElementById("reviewModal").classList.remove("d-none");
}

function closeReviewModal() {
  document.getElementById("reviewModal").classList.add("d-none");
  document.getElementById("reviewForm").reset();
  currentTaskForAction = null;
}

async function handleReviewSubmit(e) {
  e.preventDefault();

  if (!currentTaskForAction) return;

  const action = document.getElementById("reviewAction").value;
  const notes = document.getElementById("reviewNotes").value.trim();
  const newDueDate = document.getElementById("reviewNewDueDate").value;

  if (!action) {
    utils.showError("Please select an action");
    return;
  }

  if (action === "reject" && !notes) {
    if (
      !confirm("You haven't provided rejection notes. Continue without notes?")
    ) {
      return;
    }
  }

  try {
    utils.showLoading();

    await API.Tasks.reviewCompletion(currentTaskForAction.TaskId, {
      approve: action === "approve",
      notes: notes || null,
      newDueDate: action === "reject" && newDueDate ? newDueDate : null,
    });

    utils.showSuccess(
      action === "approve"
        ? "Task approved and marked as complete"
        : "Task sent back for revision"
    );

    closeReviewModal();
    await loadData();
  } catch (error) {
    console.error("Error reviewing task:", error);
    utils.showError(error.message || "Failed to review task");
  } finally {
    utils.hideLoading();
  }
}

// Task Details Functions
async function viewTaskDetails(taskId) {
  const task = tasks.find((t) => t.TaskId === taskId);
  if (!task) return;

  currentTaskForAction = task;

  try {
    const taskDetails = await API.Tasks.getById(taskId);
    const comments = await API.Tasks.getComments(taskId).catch(() => []);

    renderTaskDetails(taskDetails, comments);
    document.getElementById("taskDetailsModal").classList.remove("d-none");
  } catch (error) {
    console.error("Error loading task details:", error);
    utils.showError("Failed to load task details");
  }
}

function renderTaskDetails(task, comments) {
  const detailsContainer = document.getElementById("taskDetailsContent");

  const dueDate =
    task.dueDate || task.DueDate
      ? new Date(task.dueDate || task.DueDate).toLocaleDateString()
      : "Not set";

  const driveFolderLink = task.driveFolderLink || task.DriveFolderLink || "";
  const materialDriveFolderLink = task.materialDriveFolderLink || task.MaterialDriveFolderLink || "";

  detailsContainer.innerHTML = `
    <div class="details-grid" style="margin-bottom: var(--space-4);">
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-heading"></i> Task Title</label>
        <div class="detail-value">${utils.escapeHtml(task.title || task.Title)}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-calendar"></i> Due Date</label>
        <div class="detail-value">${dueDate}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user"></i> Assigned To</label>
        <div class="detail-value">${
          utils.escapeHtml(task.assignedToName || task.AssignedToName || "Unassigned")
        }</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-flag"></i> Priority</label>
        <div class="detail-value"><span class="badge ${getPriorityClass(
          task.priorityLevel || task.PriorityLevel
        )}">${utils.escapeHtml(task.priorityLevel || task.PriorityLevel)}</span></div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-info-circle"></i> Status</label>
        <div class="detail-value"><span class="badge ${getStatusClass(
          task.statusName || task.StatusName
        )}">${utils.escapeHtml(task.statusName || task.StatusName)}</span></div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-folder"></i> Project</label>
        <div class="detail-value">${
          utils.escapeHtml(task.projectName || task.ProjectName || "Unknown")
        }</div>
      </div>
    </div>
    <div class="detail-item" style="margin-bottom: var(--space-4);">
      <label class="detail-label"><i class="fa-solid fa-align-left"></i> Description</label>
      <div class="detail-value">${
        utils.escapeHtml(task.description || task.Description || "No description")
      }</div>
    </div>
    ${(driveFolderLink || materialDriveFolderLink) ? `
    <div class="detail-item" style="margin-bottom: var(--space-4);">
      <label class="detail-label"><i class="fa-solid fa-link"></i> Resources</label>
      <div class="detail-value" style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
        ${driveFolderLink ? `
        <a href="${utils.sanitizeUrl(driveFolderLink)}" target="_blank" class="btn btn-primary" style="text-decoration: none; flex: 1;">
          <i class="fa-brands fa-google-drive"></i> Open Task Folder
        </a>
        ` : ''}
        ${materialDriveFolderLink ? `
        <a href="${utils.sanitizeUrl(materialDriveFolderLink)}" target="_blank" class="btn btn-secondary" style="text-decoration: none; flex: 1;">
          <i class="fa-solid fa-folder-open"></i> Open Material Folder
        </a>
        ` : ''}
      </div>
    </div>
    ` : ''}
    ${
      comments && comments.length > 0
        ? `
      <div style="margin-top: var(--space-4);">
        <h4 style="margin-bottom: var(--space-3);"><i class="fa-solid fa-comments"></i> Comments</h4>
        <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-2);">
          ${comments
            .map(
              (c) => `
            <div style="padding: var(--space-3); background: var(--surface-secondary); border-radius: var(--radius-md); border-left: 3px solid var(--primary-color);">
              <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2);">
                <strong>${utils.escapeHtml(c.userName || c.UserName || "User")}</strong>
                <span style="font-size: var(--text-sm); color: var(--text-secondary);">${new Date(
                  c.createdAt || c.CreatedAt
                ).toLocaleString()}</span>
              </div>
              <p style="margin: 0;">${utils.escapeHtml(c.comment || c.Comment)}</p>
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

  // Determine if current user can add comments (is a reviewer)
  const userId = currentUser.UserId || currentUser.userId;
  const isReviewer =
    (task.DelegatedBy && task.DelegatedBy === userId) ||
    (task.OriginalAssignerId && task.OriginalAssignerId === userId) ||
    (task.CreatedBy && task.CreatedBy === userId);

  // Show/hide comment section based on reviewer status
  const commentGroup = document.querySelector("#taskDetailsModal .form-group");
  const addCommentBtn = document.querySelector(
    '#taskDetailsModal button[onclick="addTaskComment()"]'
  );

  if (commentGroup) {
    commentGroup.style.display = isReviewer ? "block" : "none";
  }
  if (addCommentBtn) {
    addCommentBtn.style.display = isReviewer ? "inline-block" : "none";
  }
}

function closeTaskDetailsModal() {
  document.getElementById("taskDetailsModal").classList.add("d-none");
  document.getElementById("taskComment").value = "";
  currentTaskForAction = null;
}

async function addTaskComment() {
  if (!currentTaskForAction) return;

  const comment = document.getElementById("taskComment").value;
  if (!comment) {
    utils.showError("Please enter a comment");
    return;
  }

  try {
    utils.showLoading();
    await API.Tasks.addComment(currentTaskForAction.TaskId, comment);
    utils.showSuccess("Comment added successfully");
    document.getElementById("taskComment").value = "";

    // Reload task details
    await viewTaskDetails(currentTaskForAction.TaskId);
  } catch (error) {
    console.error("Error adding comment:", error);
    utils.showError("Failed to add comment");
  } finally {
    utils.hideLoading();
  }
}

async function markTaskComplete() {
  if (!currentTaskForAction) return;

  if (!confirm("Are you sure you want to request completion for this task?"))
    return;

  try {
    utils.showLoading();

    await API.Tasks.requestComplete(currentTaskForAction.TaskId);

    utils.showSuccess("Task completion requested. Waiting for review.");
    closeTaskDetailsModal();
    await loadData();
  } catch (error) {
    console.error("Error completing task:", error);
    utils.showError("Failed to request task completion");
  } finally {
    utils.hideLoading();
  }
}

async function completeTask(taskId) {
  if (
    !confirm(
      "Request review for this task? The task will be sent to the manager for approval."
    )
  )
    return;

  try {
    utils.showLoading();

    // Use request-complete endpoint for proper workflow
    await API.Tasks.requestComplete(taskId);

    utils.showSuccess("Task sent for review");
    await loadData();
  } catch (error) {
    console.error("Error requesting completion:", error);
    utils.showError("Failed to request task completion");
  } finally {
    utils.hideLoading();
  }
}

async function followUpTask(taskId) {
  const task = tasks.find((t) => t.TaskId === taskId);
  if (!task) return;

  const message = prompt(`Send follow-up message to ${task.AssignedToName}:`);
  if (!message) return;

  try {
    utils.showLoading();

    await API.Tasks.addComment(
      taskId,
      `Follow-up from Account Manager: ${message}`
    );

    // TODO: Send notification to assigned team leader
    console.log("Follow-up sent:", { taskId, message });

    utils.showSuccess(`Follow-up sent to ${task.AssignedToName}`);
  } catch (error) {
    console.error("Error sending follow-up:", error);
    utils.showError("Failed to send follow-up");
  } finally {
    utils.hideLoading();
  }
}

function setupEventListeners() {
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
