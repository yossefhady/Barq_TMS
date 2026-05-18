// Team Leader My Tasks Page
auth.requireRole([USER_ROLES.TEAM_LEADER]);

let allTasks = [];
let projects = [];
let employees = [];
let priorities = [];
let statuses = [];
let departments = [];
let currentUser = null;
let currentTaskForAction = null;
let currentFilter = 'self';
let currentEditId = null; // reused if we eventually allow editing self tasks

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  if (window.ReviewModal) ReviewModal.mount();
  currentUser = auth.getCurrentUser();
  if (currentUser && currentUser.UserId === undefined && currentUser.userId !== undefined) {
    currentUser.UserId = currentUser.userId;
  }
  await loadData();
  await loadSalesTargets(); // Load sales targets if applicable
});

// Filter function
window.filterTasks = function(filter) {
    currentFilter = filter;
    
    // Update active tab UI
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.dataset.filter === filter) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Update table title
    const titles = {
        'self': 'My Self Tasks',
        'received': 'Received from Managers',
        'employee-review': 'Team Submissions',
        'in-progress': 'In Progress',
        'completed': 'Completed Tasks'
    };
    const titleEl = document.getElementById("tableTitle");
    if(titleEl) titleEl.textContent = titles[filter] || 'Tasks';
    
    // Re-render
    renderTasks();
}

async function loadSalesTargets() {
    try {
        const user = auth.getCurrentUser();
        // Support PascalCase or camelCase for UserId
        const userId = user?.UserId || user?.userId;
        const container = document.getElementById("salesTargetContainer");
        const loading = document.getElementById("salesTargetLoading");
        const content = document.getElementById("salesTargetContent");
        
        if (!userId) {
            console.warn("User ID not found, skipping sales targets");
            if(container) container.classList.add("d-none");
            return;
        }

        const now = new Date();
        const apiResponse = await API.Sales.getDashboardStats(userId, now.getMonth() + 1, now.getFullYear());
        
        // Normalize response
        const tClients = apiResponse?.TargetClients ?? apiResponse?.targetClients ?? 0;
        const tMeetings = apiResponse?.TargetMeetings ?? apiResponse?.targetMeetings ?? 0;
        const tData = apiResponse?.TargetData ?? apiResponse?.targetData ?? 0;

        const aClients = apiResponse?.ActualClients ?? apiResponse?.actualClients ?? 0;
        const aMeetings = apiResponse?.ActualMeetings ?? apiResponse?.actualMeetings ?? 0;
        const aData = apiResponse?.ActualData ?? apiResponse?.actualData ?? 0;
        
        // Only show if at least one target is set (> 0)
        const hasTargets = (tClients > 0 || tMeetings > 0 || tData > 0);
        
        if (loading) loading.classList.add("d-none");

        if (hasTargets) {
            if (container) {
              container.classList.remove("d-none");
              container.style.display = 'block'; // Ensure it overrides d-none if inline style present
            }
            if (content) content.classList.remove("d-none");
            
            // New Clients
            updateProgressBar("targetClients", aClients, tClients);
            
            // Meetings
            updateProgressBar("targetMeetings", aMeetings, tMeetings);
            
            // Data
            updateProgressBar("targetData", aData, tData);
        } else {
            // Hide container if no targets
            if (container) container.classList.add("d-none");
        }
    } catch (e) {
        console.error("Failed to load sales targets", e);
        const container = document.getElementById("salesTargetContainer");
        if(container) container.classList.add("d-none");
    }
}

function updateProgressBar(idPrefix, actual, target) {
    const textEl = document.getElementById(`${idPrefix}Text`);
    if(!textEl) return;
    const container = textEl.closest('.progress-group');

    if (!target || target === 0) {
        if(container) container.style.display = 'none';
        return;
    }

    if(container) container.style.display = 'block';

    const percentage = Math.min((actual / target) * 100, 100);
    
    // Color logic
    let color = 'var(--primary-color)';
    if (percentage >= 100) color = 'var(--success)'; // Use CSS variable or fallback
    
    // Colors specific to types just for flavor (matching HTML inline styles if desired, but here we dynamic)
    if(idPrefix.includes('Meetings')) color = 'var(--info)';
    if(idPrefix.includes('Data')) color = 'var(--success)';

    textEl.textContent = `${actual} / ${target}`;
    document.getElementById(`${idPrefix}Bar`).style.width = `${percentage}%`;
    document.getElementById(`${idPrefix}Bar`).style.backgroundColor = color;
}

// Load tasks and employees
async function loadData() {
  try {
    utils.showLoading();
    
    // Fetch all necessary data including dictionaries for dropdowns
    const [tasksResponse, projectsResponse, usersResponse, prioritiesResponse, statusesResponse, departmentsResponse] = await Promise.all([
      API.Tasks.getAll(),
      API.Projects.getAll().catch(() => []),
      API.Users.getAll().catch(() => []),
      fetch(`${API_CONFIG.BASE_URL}/Lookups/priorities`, {
          headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY)}` }
      }).then(r => r.json()).catch(() => []),
      fetch(`${API_CONFIG.BASE_URL}/Lookups/statuses`, {
          headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY)}` }
      }).then(r => r.json()).catch(() => []),
      API.Departments.getAll().catch(() => [])
    ]);

    allTasks = tasksResponse || [];
    projects = projectsResponse || [];
    priorities = prioritiesResponse || [];
    statuses = statusesResponse || [];
    departments = departmentsResponse || [];

    // Fallback for Priorities if API fails (matching team-tasks.js)
    if (!priorities || priorities.length === 0) {
      priorities = [
        { PriorityId: 0, PriorityLevel: "Low" },
        { PriorityId: 1, PriorityLevel: "Medium" },
        { PriorityId: 2, PriorityLevel: "High" },
        { PriorityId: 3, PriorityLevel: "Critical" }
      ];
    }

    // Filter employees (Role 5) who are in this team leader's team
    const currentUserId = Number(currentUser.UserId || currentUser.userId);
    employees = usersResponse.filter((u) => {
      const roleId = u.Role || u.RoleId || u.role;
      const teamLeaderId = u.TeamLeaderId || u.teamLeaderId;
      return Number(roleId) === 5 && Number(teamLeaderId) === currentUserId;
    });

    updateStats();
    renderTasks();
  } catch (error) {
    console.error("Failed to load data:", error);
    utils.showError("Failed to load tasks");
  } finally {
    utils.hideLoading();
  }
}

// Update stats
function updateStats() {
  const supervisedEmployeeIds = employees.map((e) => e.UserId || e.userId);
  
  // Base set of relevant tasks
  const relevantTasks = allTasks.filter((t) => {
    const assignedTo = t.AssignedTo || t.assignedTo;
    const statusId = t.StatusId !== undefined ? t.StatusId : t.statusId;
    return assignedTo === currentUser.UserId || 
           (supervisedEmployeeIds.includes(assignedTo) && statusId === 2);
  });

  // Calculate counts based on the 4 buckets
  let selfCount = 0;
  let submissionCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;

  relevantTasks.forEach(t => {
      const isSelf = (t.OriginalAssignerId === currentUser.UserId) || (t.CreatedBy === currentUser.UserId);
      const statusId = t.StatusId !== undefined ? t.StatusId : t.statusId;
      const isTeam = supervisedEmployeeIds.includes(t.AssignedTo || t.assignedTo);
      const isAssignedToMe = (t.AssignedTo || t.assignedTo) === currentUser.UserId;

      // 1. Completed
      if (statusId === 3) { // Completed
          if (isAssignedToMe) completedCount++;
          return;
      }

      // 2. Submissions (Team only, waiting for review)
      if (isTeam && statusId === 2) {
          submissionCount++;
          return;
      }

      // 3. Self Tasks (Assigned to me and Created by me)
      if (isAssignedToMe && isSelf && statusId !== 3 && statusId !== 4) {
          selfCount++;
          return;
      }

      // 4. In Progress (From others? Or keep as is?)
      // Original logic was: isAssignedToMe && !isSelf && statusId === 1
      if (isAssignedToMe && !isSelf && statusId === 1) {
          inProgressCount++;
          return;
      }
      
      // Note: "Received from Manager" (Pending, !isSelf) is currently not tracked in top buckets explicitly?
      // Wait, user removed "Received from Manager".
      // If a manager assigns a task to me, and it is Pending (0), where does it go?
      // With new logic:
      // - Self Tasks: NO
      // - Submissions: NO
      // - In Progress: NO (Status 0 != 1)
      // So it's lost from stats?
      // Maybe I should add it to "In Progress" or rename "In Progress" to "Assigned to Me"?
      // The user asked "remove the filter of recived from the manger and make it the self tasks".
      // I will follow instructions and track Self Tasks.
      // If needed I can add "Received" back later or map it to InProgress.
      if (isAssignedToMe && !isSelf && statusId === 0) {
           inProgressCount++; // Map pending manager tasks to In Progress bucket for now so they appear somewhere
      }
  });

  // Update UI
  const selfEl = document.getElementById("selfTasks");
  const submissionsEl = document.getElementById("employeeSubmissions");
  const inProgressEl = document.getElementById("inProgress");
  const completedEl = document.getElementById("completedCount");
  
  const badgeSelf = document.getElementById("badge-self");
  const badgeReview = document.getElementById("badge-employee-review");
  const badgeProgress = document.getElementById("badge-in-progress");

  if (selfEl) selfEl.textContent = selfCount;
  if (submissionsEl) submissionsEl.textContent = submissionCount;
  if (inProgressEl) inProgressEl.textContent = inProgressCount;
  if (completedEl) completedEl.textContent = completedCount;

  if (badgeSelf) badgeSelf.textContent = selfCount;
  if (badgeReview) badgeReview.textContent = submissionCount;
  if (badgeProgress) badgeProgress.textContent = inProgressCount;
}

// Render tasks
function renderTasks() {
  const tbody = document.getElementById("tasksBody");
  if (!tbody) return;

  const supervisedEmployeeIds = employees.map((e) => e.UserId || e.userId);
  // Check role for column rendering
  const isSalesTeamLeader = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");

  const activityMap = {
    1: '<span class="badge badge-info">Meeting</span>',
    2: '<span class="badge badge-secondary">Cold Call</span>',
    3: '<span class="badge badge-warning">Data</span>',
    4: '<span class="badge badge-success">Closing</span>'
  };
  
  // Dynamic Header
  const thead = document.getElementById("tasksTableHead");
  if(thead) {
      if(isSalesTeamLeader) {
          thead.innerHTML = `
              <tr>
                <th>Task</th>
                <th>Activity</th>
                <th>Client Info</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>`;
      } else {
          thead.innerHTML = `
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>`;
      }
  }
  
  // Filter for the *Current Tab*
  const tasksToRender = allTasks.filter((t) => {
    const assignedTo = t.AssignedTo || t.assignedTo;
    const statusId = t.StatusId !== undefined ? t.StatusId : t.statusId;
    
    // Check ownership
    const isTeam = supervisedEmployeeIds.includes(assignedTo);
    const isAssignedToMe = assignedTo === currentUser.UserId;
    const isSelf = (t.OriginalAssignerId === currentUser.UserId) || (t.CreatedBy === currentUser.UserId);

    // Filter Logic matching updateStats
    switch (currentFilter) {
        case 'completed':
            return isAssignedToMe && statusId === 3;
        
        case 'employee-review':
            // Team Member In Review only
            return (isTeam && statusId === 2);
        
        case 'self':
            // Self Tasks
            return isAssignedToMe && isSelf && statusId !== 3 && statusId !== 4;
            
        case 'in-progress':
            // Assigned to me.
            // Includes:
            // 1. Tasks from Managers/Others: Pending (0) or In Progress (1)
            // 2. Self Tasks: In Progress (1) only (Pending Self Tasks stay in Self tab?)
            //    User request: "the In Progress tab still dont have the in progress self tasks"
            return isAssignedToMe && (statusId === 1 || (!isSelf && statusId === 0));
            
        default:
            return false;
    }
  });

  if (!tasksToRender || tasksToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No tasks found</h3>
            <p>No tasks matching current filter</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tasksToRender
    .map((task) => {
      const sId = task.StatusId !== undefined ? task.StatusId : task.statusId;
      const needsReview = sId === 2; // In Review
      const isAssignedToMe = task.AssignedTo === currentUser.UserId;
      const isTeamMemberTask = supervisedEmployeeIds.includes(task.AssignedTo);
      // Check if self-assigned (CreatedBy is usually OriginalAssignerId in DTO)
      // FIX: Only treat as "Self Task" badge if assigned to ME. 
      // Otherwise it's just a task I delegated (Team Submission).
      const isSelfAssigned = isAssignedToMe && ((task.OriginalAssignerId === currentUser.UserId) || (task.CreatedBy === currentUser.UserId));

      // Specific columns for Sales
      let middleCols = '';
      if(isSalesTeamLeader) {
          const act = (task.SalesActivityType && activityMap[task.SalesActivityType]) 
                    ? activityMap[task.SalesActivityType] 
                    : '<span style="color:var(--text-secondary)">-</span>';
          const client = task.SalesClientInfo ? utils.escapeHtml(task.SalesClientInfo) : '<span style="color:var(--text-secondary)">-</span>';

          middleCols = `
            <td>${act}</td>
            <td>${client}</td>
          `;
      } else {
        middleCols = `<td>${utils.escapeHtml(task.ProjectName || "N/A")}</td>`;
      }

      return `
    <tr style="${needsReview ? "border-left: 4px solid #ff9800;" : ""}">
      <td><strong>${utils.escapeHtml(task.Title || "Untitled Task")}</strong>${
        needsReview
          ? '<span class="badge badge-warning" style="margin-left: 8px;">Needs Review</span>'
          : ""
      }${
        isSelfAssigned
          ? '<span class="badge badge-info" style="margin-left: 8px;">Self Task</span>'
          : ""
      }</td>
      ${middleCols}
      <td>${utils.getPriorityBadge(task.PriorityId !== undefined ? task.PriorityId : 1)}</td>
      <td>${utils.getStatusBadge(sId)}</td>
      <td>${utils.escapeHtml(task.AssignedToName || "Unassigned")}</td>
      <td>${utils.formatDate(task.DueDate)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openTaskDetailsModal(${
          task.TaskId
        })" title="View Details">
          <i class="fa-solid fa-eye"></i>
        </button>
        ${
          isAssignedToMe && !needsReview && !isSelfAssigned
            ? `
          <button class="btn btn-sm btn-secondary" onclick="showPassTaskModal(${task.TaskId})" title="Pass to Employee">
            <i class="fa-solid fa-share"></i>
          </button>
          <button class="btn btn-sm btn-success" onclick="requestCompletion(${task.TaskId})" title="Request Completion">
            <i class="fa-solid fa-check"></i>
          </button>
        `
            : ""
        }
        ${
          (needsReview && isTeamMemberTask) || (isSelfAssigned && isAssignedToMe)
            ? `
            ${
                isSelfAssigned && !needsReview && sId !== 3
                ? `
                ${ sId === 0 ? `
                <button class="btn btn-sm btn-info" onclick="startTask(${task.TaskId})" title="Start Task">
                    <i class="fa-solid fa-play"></i>
                </button>
                ` : `
                <button class="btn btn-sm btn-success" onclick="requestCompletion(${task.TaskId})" title="Mark as Completed">
                    <i class="fa-solid fa-check-double"></i>
                </button>
                ` }
                ` 
                : 
                // Standard Review Button for Team Tasks
                (needsReview ? 
                `<button class="btn btn-sm btn-warning" onclick="openReviewModal(${task.TaskId})" title="Review Task">
                    <i class="fa-solid fa-clipboard-check"></i>
                </button>` : '')
            }
        `
            : ""
        }
      </td>
    </tr>
  `;
    })
    .join("");
}

// Show pass task modal
function showPassTaskModal(taskId) {
  const task = allTasks.find((t) => t.TaskId === taskId);
  if (!task) return;

  currentTaskForAction = task;

  // Populate employee dropdown
  const employeeSelect = document.getElementById("employeeSelect");
  if (employeeSelect) {
    employeeSelect.innerHTML =
      '<option value="">Select an employee...</option>' +
      employees
        .map(
          (emp) => `
        <option value="${emp.UserId || emp.userId}">${utils.escapeHtml(
            emp.Name || emp.name
          )}</option>
      `
        )
        .join("");
  }

  document.getElementById("passTaskTitle").textContent = task.Title;
  document.getElementById("passTaskModal").classList.remove("d-none");
}

// Close pass task modal
function closePassTaskModal() {
  document.getElementById("passTaskModal").classList.add("d-none");
  document.getElementById("passTaskNotes").value = "";
  currentTaskForAction = null;
}

// Handle pass task
async function handlePassTask() {
  if (!currentTaskForAction) return;

  const employeeId = document.getElementById("employeeSelect").value;
  const notes = document.getElementById("passTaskNotes").value;

  if (!employeeId) {
    utils.showError("Please select an employee");
    return;
  }

  try {
    utils.showLoading();

    await API.Tasks.passTask(currentTaskForAction.TaskId, {
      assignToUserId: parseInt(employeeId),
      notes: notes || null,
    });

    const employee = employees.find(
      (e) => (e.UserId || e.userId) == employeeId
    );
    const employeeName = employee ? employee.Name || employee.name : "employee";

    utils.showSuccess(`Task passed to ${employeeName}`);
    closePassTaskModal();
    await loadData();
  } catch (error) {
    console.error("Error passing task:", error);
    utils.showError(error.message || "Failed to pass task");
  } finally {
    utils.hideLoading();
  }
}

// Start task (Pending -> In Progress)
async function startTask(taskId) {
  try {
    utils.showLoading();
    // 1 = In Progress
    await API.Tasks.updateStatus(taskId, { statusId: 1, notes: "Task Started" });
    utils.showSuccess("Task started");
    await loadData();
  } catch (error) {
    console.error("Error starting task:", error);
    utils.showError(error.message || "Failed to start task");
  } finally {
    utils.hideLoading();
  }
}

// Request completion for task
async function requestCompletion(taskId) {
  const task = allTasks.find(t => t.TaskId === taskId);
  const isSelf = task && ((task.OriginalAssignerId === currentUser.UserId) || (task.CreatedBy === currentUser.UserId));
  
  // Verify Sales Policy
  const isSales = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");

  let note = null;
  let finalKpiValue = null;

  // Unified Note Logic
  if (isSales) {
      // Prompt for KPI Value based on Activity Type
      // 1=Meeting, 2=ColdCall, 3=DataCollection, 4=Closing
      const actType = task.SalesActivityType;
      
      if (actType == 1 || actType == 2) { // Meeting/Call
          const val = prompt("Enter number of meetings/calls conducted:", "1");
          if (val === null) return;
          if (isNaN(val) || val.trim() === "") { utils.showError("Invalid Number"); return; }
          finalKpiValue = parseFloat(val);
      } else if (actType == 3) { // Data
          const val = prompt("Enter amount of data collected (Number):");
          if (val === null) return;
          if (isNaN(val) || val.trim() === "") { utils.showError("Invalid Number"); return; }
          finalKpiValue = parseFloat(val);
      } else if (actType == 4) { // Closing
          // User asked: "can be signed or not"
          const isSigned = confirm("Did the client sign the contract?\nOK = Signed (Success)\nCancel = Not Signed");
          finalKpiValue = isSigned ? 1 : 0;
      }

      // Sales Policy: Note is ALWAYS required (Self or Team)
      const msg = isSelf 
          ? "Sales Policy: You are completing your own task. A note explaining the work is REQUIRED." 
          : "Sales Policy: Requesting review. A note explaining the work is REQUIRED.";
      
      note = prompt(msg);
      if (note === null) return; // Cancelled
      if (!note.trim()) {
          utils.showError("Sales Department Policy: Note is required.");
          return;
      }
  } else {
      // General Policy: Note is optional
      if (isSelf) {
          // Self task completion
           note = prompt("Marking task as completed.\nAdd an optional note (or leave empty):");
           if (note === null) return; // Cancelled
      } else {
          // Request Review
          const wantNote = confirm("Request review for this task?\nClick OK to proceed.");
          if (!wantNote) return;
          note = prompt("Add an optional note for the reviewer:");
          if (note === null) return;
      }
  }

  try {
    utils.showLoading();
    // Using object style call updated in api.js
    await API.Tasks.requestComplete(taskId, { note: note, finalKpiValue: finalKpiValue });
    utils.showSuccess(isSelf ? "Task marked as completed" : "Task sent for review");
    await loadData();
    if (isSales) await loadSalesTargets(); // Refresh KPIs
  } catch (error) {
    console.error("Error requesting completion:", error);
    utils.showError(error.message || "Failed to request completion");
  } finally {
    utils.hideLoading();
  }
}

// Open review modal for team member tasks
function openReviewModal(taskId) {
  if (!window.ReviewModal) { console.error("ReviewModal not loaded"); return; }
  return ReviewModal.open(taskId, { onSubmitted: () => (typeof loadData === "function" ? loadData() : null) });
}

async function _legacyOpenReviewModal_unused(taskId) {
  // We need full details for Description (TaskListDto usually doesn't have Description)
  let task = allTasks.find((t) => t.TaskId === taskId);
  
  try {
    utils.showLoading();
    // Fetch full details to ensure we have Description (and latest data)
    const fullTask = await API.Tasks.getById(taskId);
    if(fullTask) task = fullTask; 
    
    if (!task) return;

    currentTaskForAction = task;

    // Populate modal with task details
    document.getElementById("reviewTaskTitle").textContent =
      task.Title || "Untitled";
    document.getElementById("reviewDescription").textContent =
      task.Description || "No description";
    document.getElementById("reviewAssignee").textContent =
      task.AssignedToName || "Unknown";
    document.getElementById("reviewCompletedDate").textContent =
      utils.formatDate(new Date());

    // Show/hide upload link
    const uploadLinkGroup = document.getElementById("reviewUploadLinkGroup");
    const kpiGroup = document.getElementById("reviewSalesKpiGroup");
    
    const isSalesTeamLeader = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");
    
    // Handle KPI Display for Sales
    if (isSalesTeamLeader && kpiGroup) {
        kpiGroup.style.display = "block";
        document.getElementById("reviewSalesKpi").textContent = (task.FinalKpiValue !== undefined && task.FinalKpiValue !== null) ? task.FinalKpiValue : "0";
    } else if (kpiGroup) {
        kpiGroup.style.display = "none";
    }
    
    const uploadHref = task.DriveFolderLink || null;
    if (uploadHref && !isSalesTeamLeader) {
      uploadLinkGroup.style.display = "block";
      document.getElementById("reviewUploadLink").href = utils.sanitizeUrl(uploadHref);
    } else {
      uploadLinkGroup.style.display = "none";
    }

    document.getElementById("reviewAction").value = "approve";
    document.getElementById("reviewNotes").value = "";
    document.getElementById("reviewNewDueDate").value = "";

    // Show/hide notes and due date fields based on action
    toggleReviewFields();

    // Add event listener for action change
    document.getElementById("reviewAction").onchange = toggleReviewFields;

    document.getElementById("reviewModal").classList.remove("d-none");
  } catch (error) {
    console.error("Error loading review modal:", error);
    utils.showError("Failed to load task details for review");
  } finally {
    utils.hideLoading();
  }
}

// Toggle review fields based on action
function toggleReviewFields() {
  const action = document.getElementById("reviewAction").value;
  const notesGroup = document.getElementById("reviewNotesGroup");
  const dueDateGroup = document.getElementById("reviewNewDueDateGroup");

  if (action === "revise") {
    notesGroup.style.display = "block";
    dueDateGroup.style.display = "block";
  } else {
    notesGroup.style.display = "none";
    dueDateGroup.style.display = "none";
  }
}

// Close review modal
function closeReviewModal() {
  document.getElementById("reviewModal").classList.add("d-none");
  currentTaskForAction = null;
}

// Submit review
async function submitReview() {
  if (!currentTaskForAction) return;

  const action = document.getElementById("reviewAction").value;
  const notes = document.getElementById("reviewNotes").value;

  if (action === "revise" && !notes.trim()) {
    utils.showError("Please provide revision notes");
    return;
  }

  try {
    utils.showLoading();

    const newDueDate = document.getElementById("reviewNewDueDate").value;

    const reviewData = {
      approve: action === "approve",
      notes: notes || null,
      newDueDate: newDueDate || null,
    };

    await API.Tasks.reviewCompletion(currentTaskForAction.TaskId, reviewData);

    // Close modal first
    closeReviewModal();

    // Show success message
    utils.showSuccess(
      action === "approve"
        ? "Task approved successfully!"
        : "Revision request sent to employee with notes."
    );

    // Reload tasks to refresh the list
    await loadData();
  } catch (error) {
    console.error("Error submitting review:", error);
    utils.showError("Failed to submit review");
  } finally {
    utils.hideLoading();
  }
}

// Open task details modal
async function openTaskDetailsModal(taskId) {
  try {
    utils.showLoading();
    const task = await API.Tasks.getById(taskId);
    
    if (!task) {
      utils.showError("Task not found");
      return;
    }

    currentTaskForAction = task;
    
    renderTaskDetails(task);

    // Inject actions dynamically
    const footerActions = document.getElementById("taskDetailsActions");
    if (footerActions) {
       footerActions.innerHTML = "";
       // If self task, allow delete
       const isSelf = (task.OriginalAssignerId === currentUser.UserId) || (task.CreatedBy === currentUser.UserId);
       // Also allow delete if status is 0 (Pending) and I am the assignee? No, usually not.
       // Only creator can delete.
       if (isSelf) {
          const editBtn = document.createElement("button");
          editBtn.className = "btn btn-info";
          editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit'; // Edit Icon
          editBtn.onclick = () => {
              closeTaskDetailsModal();
              showCreateSelfTaskModal(task);
          };
          footerActions.appendChild(editBtn);
       }
    }

    document.getElementById("taskDetailsModal").classList.remove("d-none");
  } catch (error) {
    console.error("Failed to load task details:", error);
    utils.showError("Failed to load task details");
  } finally {
    utils.hideLoading();
  }
}

async function deleteTask(taskId) {
  utils.showError("Deleting tasks is not allowed for Team Leaders.");
}

function renderTaskDetails(task) {
  console.log("Render Task Details:", task);
  const detailsContainer = document.getElementById("taskDetailsContent");
  
  const isSalesTeamLeader = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");

  const dueDate = task.DueDate
    ? new Date(task.DueDate).toLocaleDateString()
    : "Not set";

  const driveFolderLink = task.DriveFolderLink || "";
  const materialDriveFolderLink = task.MaterialDriveFolderLink || "";

  detailsContainer.innerHTML = `
    <div class="details-grid" style="margin-bottom: var(--space-4);">
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-heading"></i> Task Title</label>
        <div class="detail-value">${utils.escapeHtml(task.Title || "Untitled Task")}</div>
      </div>

      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-align-left"></i> Description</label>
        <div class="detail-value">${utils.escapeHtml(task.Description || "No description")}</div>
      </div>

      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user"></i> Assigned To</label>
        <div class="detail-value">${utils.escapeHtml(task.AssignedToName || "Unassigned")}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-flag"></i> Priority</label>
        <div class="detail-value">${utils.getPriorityBadge(task.PriorityId)}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-info-circle"></i> Status</label>
        <div class="detail-value">${utils.getStatusBadge(task.StatusId)}</div>
      </div>
      ${!isSalesTeamLeader ? `
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-folder"></i> Project</label>
        <div class="detail-value">${utils.escapeHtml(task.ProjectName || "N/A")}</div>
      </div>` : `
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user-tie"></i> Client Info</label>
        <div class="detail-value">${utils.escapeHtml(task.SalesClientInfo || "-")}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-location-dot"></i> Location</label>
        <div class="detail-value">${utils.escapeHtml(task.SalesMarketSegmentPlace || task.salesMarketSegmentPlace || "-")}</div>
      </div>
      <div class="detail-item">
          <label class="detail-label"><i class="fa-solid fa-list-check"></i> Activity Type</label>
           <div class="detail-value">${
              task.SalesActivityType == 1 ? "Meeting" :
              task.SalesActivityType == 2 ? "Cold Call" :
              task.SalesActivityType == 3 ? "Data Collection" :
              task.SalesActivityType == 4 ? "Closing / Client Signing" : "-"
           }</div>
      </div>
      `}
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user-pen"></i> Created By</label>
        <div class="detail-value">${utils.escapeHtml(task.CreatedByName || "Unknown")}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-calendar"></i> Due Date</label>
        <div class="detail-value">${dueDate}</div>
      </div>
    </div>
    
    ${ task.Comments && task.Comments.length > 0 ? `
      <div class="detail-item" style="margin-bottom: var(--space-4);">
        <label class="detail-label"><i class="fa-solid fa-comments"></i> Notes / History</label>
        <div class="detail-value" style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
          ${task.Comments.map(c => `
             <div style="margin-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 12px;">
                 <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: var(--text-primary); font-weight: 600;">${utils.escapeHtml(c.UserName)}</span>
                    <small style="color: var(--text-secondary);">${utils.formatDate(c.CreatedAt)}</small>
                 </div>
                 <div style="color: var(--text-secondary); line-height: 1.4;">${utils.escapeHtml(c.Comment)}</div>
             </div>
          `).join('')}
        </div>
      </div>` : '' }

    ${((driveFolderLink || materialDriveFolderLink) && !isSalesTeamLeader) ? `
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
  `;
}

// Close task details modal
function closeTaskDetailsModal() {
  document.getElementById("taskDetailsModal").classList.add("d-none");
  currentTaskForAction = null;
}

// ============================================
// SELF TASK CREATION LOGIC
// ============================================

function populateDropdowns() {
    // Check if Sales or Creative Team Leader to hide project/dept logic
    const isSalesTeamLeader = currentUser.Departments && currentUser.Departments.some(d => (d.DeptName || d.Name || '').toLowerCase().includes("sales"));
    const isCreativeTeamLeader = currentUser.Departments && currentUser.Departments.some(d => (d.DeptName || d.Name || '').toLowerCase().includes("creative"));

    // Projects
    const projectSelect = document.getElementById("projectId");
    const projectGroup = projectSelect.closest('.form-group');
    
    if (isSalesTeamLeader) {
        if(projectGroup) projectGroup.style.display = 'none';
        projectSelect.innerHTML = '<option value="">Select Project (Optional)</option>';
    } else {
        if(projectGroup) projectGroup.style.display = 'block';
        projectSelect.innerHTML = '<option value="">Select Project (Optional)</option>';
        projects.forEach(p => {
            const option = document.createElement("option");
            option.value = p.ProjectId;
            option.textContent = p.ProjectName;
            projectSelect.appendChild(option);
        });
    }

    // Departments
    const deptSelect = document.getElementById("deptId");
    deptSelect.innerHTML = '<option value="">Select Department</option>';
    departments.forEach(d => {
        const option = document.createElement("option");
        option.value = d.DeptId || d.deptId;
        option.textContent = d.DeptName || d.deptName;
        deptSelect.appendChild(option);
    });

    // Auto-select users primary department if possible
    if(currentUser.Departments && currentUser.Departments.length > 0) {
        // Try to match with capitalized DeptId or camelCase deptId
        const defDeptId = currentUser.Departments[0].DeptId || currentUser.Departments[0].deptId;
        if(defDeptId) deptSelect.value = defDeptId;
    }

    // Force Department & Hide for Sales OR Creative
    if (isSalesTeamLeader || isCreativeTeamLeader) {
        // Find matching option
        const targetName = isSalesTeamLeader ? 'sales' : 'creative';
        for(let i=0; i<deptSelect.options.length; i++) {
            const txt = deptSelect.options[i].text.toLowerCase();
            if(txt.includes(targetName)) {
                deptSelect.value = deptSelect.options[i].value;
                break;
            }
        }
        // Check if Form Group exists and hide it
        const formGroup = deptSelect.closest(".form-group");
        if(formGroup) formGroup.style.display = 'none';
    } else {
        const formGroup = deptSelect.closest(".form-group");
        if(formGroup) formGroup.style.display = 'block';
    }

    // Priorities
    const prioritySelect = document.getElementById("priorityId");
    prioritySelect.innerHTML = '<option value="">Select Priority</option>';
    priorities.forEach(p => {
        const option = document.createElement("option");
        option.value = p.PriorityId !== undefined ? p.PriorityId : p.priorityId;
        option.textContent = p.PriorityLevel || p.priorityLevel;
        prioritySelect.appendChild(option);
    });

    // We hardcoded status 0 (Pending) and 1 (In Progress) in HTML for simplicity, 
    // but we can ensure they are enabled.
}

// Restrict status dropdown options based on state machine transitions.
// isEdit=false (create): only show Pending.
// isEdit=true  (edit):   show current status + valid next states.
function updateStatusDropdown(isEdit, currentStatusId) {
  const statusSelect = document.getElementById("statusId");
  statusSelect.innerHTML = '';

  // Fallback labels in case the statuses array is empty
  const statusLabels = {
    0: 'Pending',
    1: 'In Progress',
    2: 'In Review',
    3: 'Completed',
    4: 'Closed'
  };

  // Valid state-machine transitions
  const validTransitions = {
    0: [1],        // Pending     → InProgress
    1: [2, 4],     // InProgress  → InReview, Closed
    2: [3, 1],     // InReview    → Completed, InProgress (reject back)
    3: [],         // Completed   → (terminal)
    4: []          // Closed      → (terminal)
  };

  let allowedIds;
  if (!isEdit) {
    allowedIds = [0]; // create mode – only Pending
  } else {
    const nextStates = validTransitions[currentStatusId] || [];
    allowedIds = [currentStatusId, ...nextStates];
  }

  allowedIds.forEach(id => {
    const option = document.createElement("option");
    option.value = id;
    const statusObj = statuses.find(s => (s.StatusId !== undefined ? s.StatusId : s.statusId) === id);
    option.textContent = statusObj
      ? (statusObj.StatusName || statusObj.statusName)
      : (statusLabels[id] || 'Unknown');
    statusSelect.appendChild(option);
  });

  statusSelect.value = currentStatusId;
}

// Show Create/Edit Modal
function showCreateSelfTaskModal(editTask = null) {
  document.getElementById("taskForm").reset();
  
  if (editTask) {
      currentEditId = editTask.TaskId;
      document.getElementById("modalTitle").textContent = "Edit Self Task";
      document.getElementById("title").value = editTask.Title || "";
      document.getElementById("description").value = editTask.Description || "";
      document.getElementById("projectId").value = editTask.ProjectId || "";
      document.getElementById("deptId").value = editTask.DeptId || editTask.DepartmentId || "";
      document.getElementById("priorityId").value = editTask.PriorityId !== undefined ? editTask.PriorityId : "";

      if(editTask.DueDate) {
          document.getElementById("dueDate").value = editTask.DueDate.split('T')[0];
      }
      
      document.getElementById("driveFolderLink").value = editTask.DriveFolderLink !== "N/A" ? editTask.DriveFolderLink : "";
      document.getElementById("materialDriveFolderLink").value = editTask.MaterialDriveFolderLink || "";

      // Sales Fields Population handled after injection
  } else {
      currentEditId = null;
      document.getElementById("modalTitle").textContent = "Create Self Task";
      document.getElementById("assignedToId").value = currentUser.UserId;
  }
  
  // Populate dropdowns fresh
  populateDropdowns();

  // Restrict status dropdown based on state machine transitions
  if (editTask) {
    const currentStatusId = editTask.StatusId !== undefined ? editTask.StatusId : (editTask.statusId !== undefined ? editTask.statusId : 0);
    updateStatusDropdown(true, currentStatusId);
  } else {
    updateStatusDropdown(false, 0);
  }

  // If editing, re-set values after populate (in case dropdowns cleared them)
  if(editTask) {
       document.getElementById("deptId").value = editTask.DeptId || editTask.DepartmentId || "";
       document.getElementById("projectId").value = editTask.ProjectId || "";
       document.getElementById("priorityId").value = editTask.PriorityId !== undefined ? editTask.PriorityId : "";
  }

  // Check Sales
  const isSales = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");

  // Handle Sales Fields Injection
  const existingSales = document.getElementById("selfTaskSalesFields");
  if(existingSales) existingSales.remove();

  if(isSales) {
      const salesHtml = `
      <div id="selfTaskSalesFields">
        <div class="row">
            <div class="col-md-6">
                <div class="form-group">
                    <label>Activity Type *</label>
                    <select id="salesActivityType" class="form-control">
                        <option value="">Select Activity</option>
                        <option value="1">Meeting</option>
                        <option value="2">Cold Call</option>
                        <option value="3">Data Collection</option>
                        <option value="4">Closing / Client Signing</option>
                    </select>
                </div>
            </div>
            <div class="col-md-6">
                <div class="form-group">
                    <label>Client Info</label>
                    <input type="text" id="salesClientInfo" class="form-control" placeholder="Client Name, Company, Phone..." >
                </div>
            </div>
        </div>
        <div class="form-group">
            <label>Location / Zone</label>
            <select id="salesLocationTag" class="form-control">
                <option value="">Select Zone</option>
            </select>
        </div>
      </div>
      `;
      // Insert after Description
      const descElement = document.getElementById("description");
      if(descElement) {
          descElement.closest(".form-group").insertAdjacentHTML('afterend', salesHtml);
          // Load zones
          loadSalesZones("salesLocationTag", editTask ? (editTask.SalesMarketSegmentId || editTask.salesMarketSegmentId) : null);
      }
      
      // Populate Sales Data if Editing
      if(editTask) {
          setTimeout(() => {
              if(document.getElementById("salesActivityType")) document.getElementById("salesActivityType").value = editTask.SalesActivityType || "";
              if(document.getElementById("salesClientInfo")) document.getElementById("salesClientInfo").value = editTask.SalesClientInfo || "";
          }, 100);
      }
      
      // Also hide Drive links for consistency if they exist in this form
      const driveLink = document.getElementById("driveFolderLink");
      const matLink = document.getElementById("materialDriveFolderLink");
      if(driveLink) driveLink.closest(".form-group").style.display = 'none';
      if(matLink) matLink.closest(".form-group").style.display = 'none';
  }

  document.getElementById("taskModal").classList.remove("d-none");
}

function closeCreateSelfModal() {
  document.getElementById("taskModal").classList.add("d-none");
}

async function handleSelfTaskSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const priorityId = document.getElementById("priorityId").value;
  const statusId = document.getElementById("statusId").value;
  const deptId = document.getElementById("deptId").value;
  const dueDateVal = document.getElementById("dueDate").value;
  const projectId = document.getElementById("projectId").value;

  if (!title) {
    utils.showError("Please enter a task title");
    return;
  }
  if (!priorityId) {
    utils.showError("Please select a priority");
    return;
  }
  if (!deptId) {
    utils.showError("Please select a department");
    return;
  }

  // Validate Due Date
  if (dueDateVal) {
    const selectedDate = new Date(dueDateVal);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      utils.showError("Due date cannot be in the past.");
      return;
    }
  }

  // Sales Data Collection
  let salesData = {};
  const isSales = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");
  if(isSales) {
      const activityType = document.getElementById("salesActivityType")?.value;
      if(activityType) {
          salesData.SalesActivityType = parseInt(activityType);
      }
      salesData.SalesClientInfo = document.getElementById("salesClientInfo")?.value || null;
      const segId = document.getElementById("salesLocationTag")?.value;
      salesData.SalesMarketSegmentId = segId ? parseInt(segId) : null;
  }

  const formData = {
    Title: title,
    Description: document.getElementById("description").value,
    PriorityId: parseInt(priorityId),
    StatusId: parseInt(statusId),
    DueDate: dueDateVal || null,
    AssignedTo: currentUser.UserId, // Forced self-assignment
    DeptId: parseInt(deptId),
    ProjectId: projectId ? parseInt(projectId) : null,
    DriveFolderLink: document.getElementById("driveFolderLink").value || "N/A",
    MaterialDriveFolderLink: document.getElementById("materialDriveFolderLink").value || null,
    ...salesData
  };

  try {
    utils.showLoading();
    
    if (currentEditId) {
        await API.Tasks.update(currentEditId, formData);
        utils.showSuccess("Self-task updated successfully");
    } else {
        await API.Tasks.create(formData);
        utils.showSuccess("Self-task created successfully");
    }
    
    closeCreateSelfModal();
    await loadData(); // Reload tasks
  } catch (error) {
    console.error("Error creating/updating self-task:", error);
    utils.showError(error.message || "Failed to save task");
  } finally {
    utils.hideLoading();
  }
}

// Search functionality
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll("#tasksBody tr");

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? "" : "none";
    });
  });
}

// Helper to load sales zones
async function loadSalesZones(selectId, selectedValue = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">Loading zones...</option>';
    
    try {
        const zones = await API.Sales.getMarketSegments();
        // Filter for Targeted (Status === 'Targeted')
        // Note: Status is a string in Backend (Open, Targeted, Completed)
        const targetedZones = zones.filter(z => {
            const s = z.Status || z.status || '';
            return s.toLowerCase() === 'targeted';
        });
        
        select.innerHTML = '<option value="">Select Zone</option>';
        
        if (targetedZones.length === 0) {
            const opt = document.createElement('option');
            opt.disabled = true;
            opt.text = "No targeted zones available";
            select.appendChild(opt);
        } else {
           targetedZones.forEach(z => {
               const opt = document.createElement('option');
               // Use Place from DTO
               const zName = z.Place || z.place || z.ZoneName || z.zoneName || 'Unknown';
               const zCat = z.Category || z.category || '';
               // Use Id for value
               opt.value = z.Id || z.id; 
               opt.text = `${zName} ${zCat ? `(${zCat})` : ''}`;
               select.appendChild(opt);
           });

        }
        
        if (selectedValue) {
            select.value = selectedValue;
        }
        
    } catch (err) {
        console.error("Error loading zones:", err);
        select.innerHTML = '<option value="">Error loading zones</option>';
    }
}
