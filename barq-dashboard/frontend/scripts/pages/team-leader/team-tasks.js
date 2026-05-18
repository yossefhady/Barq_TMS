// Team Leader Team Tasks
auth.requireRole([USER_ROLES.TEAM_LEADER]);

let allTasks = [];
let projects = [];
let employees = []; // Will contain only supervised employees
let priorities = [];
let statuses = [];
let departments = [];
let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (window.ReviewModal) ReviewModal.mount();
  currentUser = auth.getCurrentUser();
  await loadTeamTasks();
  setupEventListeners();
});

function setupEventListeners() {
  document
    .getElementById("statusFilter")
    .addEventListener("change", filterTasks);
  document.getElementById("taskForm").addEventListener("submit", handleSubmit);
  
  // Auto-assign department when employee is selected (for Creative TL)
  const assignedToSelect = document.getElementById("assignedToId");
  if(assignedToSelect) {
      assignedToSelect.addEventListener("change", (e) => {
          const userId = e.target.value;

          if(userId) {
              const emp = employees.find(u => (u.UserId || u.userId) == userId);
              if(emp && emp.Departments && emp.Departments.length > 0) {
                  const deptId = emp.Departments[0].DeptId || emp.Departments[0].deptId;
                  const deptSelect = document.getElementById("deptId");
                  if(deptSelect) deptSelect.value = deptId;
              }
          }
      });
  }
}

async function loadTeamTasks() {
  try {
    utils.showLoading();

    [allTasks, projects, allUsers, priorities, statuses, departments] =
      await Promise.all([
        API.Tasks.getAll(),
        API.Projects.getAll().catch(() => []),
        API.Users.getAll().catch(() => []),
        fetch(`${API_CONFIG.BASE_URL}/Lookups/priorities`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(
              API_CONFIG.TOKEN_KEY
            )}`,
          },
        })
          .then((r) => r.json())
          .catch(() => []),
        fetch(`${API_CONFIG.BASE_URL}/Lookups/statuses`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(
              API_CONFIG.TOKEN_KEY
            )}`,
          },
        })
          .then((r) => r.json())
          .catch(() => []),
        fetch(`${API_CONFIG.BASE_URL}/departments`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(
              API_CONFIG.TOKEN_KEY
            )}`,
          },
        })
          .then((r) => r.json())
          .catch(() => []),
      ]);

    // Filter employees to only those under this team leader
    employees = allUsers.filter((u) => {
      const roleId = u.Role || u.RoleId;
      const teamLeaderId = u.TeamLeaderId || u.teamLeaderId;
      return roleId === 5 && teamLeaderId === currentUser.UserId;
    });

    // Fallback for Priorities if API fails
    if (!priorities || priorities.length === 0) {
      priorities = [
        { PriorityId: 0, PriorityLevel: "Low" },
        { PriorityId: 1, PriorityLevel: "Medium" },
        { PriorityId: 2, PriorityLevel: "High" },
        { PriorityId: 3, PriorityLevel: "Critical" }
      ];
    }

    // Fallback for Statuses if API fails
    if (!statuses || statuses.length === 0) {
      statuses = [
        { StatusId: 0, StatusName: "Pending" },
        { StatusId: 1, StatusName: "In Progress" },
        { StatusId: 2, StatusName: "In Review" },
        { StatusId: 3, StatusName: "Completed" },
        { StatusId: 4, StatusName: "Closed" }
      ];
    }

    // Backend already filters tasks correctly, just render them
    populateDropdowns();
    
    // Initial filter to hide "In Review" tasks
    filterTasks();
  } catch (error) {
    console.error("Error loading team tasks:", error);
    utils.showError("Failed to load team tasks");
  } finally {
    utils.hideLoading();
  }
}

function populateDropdowns() {
  // Check if current user is a Creative Team Leader
  const isCreativeTeamLeader = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Creative");
  
  // Check if Sales Team Leader
  // Use currentUser.Departments since DepartmentId might not be on the root object
  const isSalesTeamLeader = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");

  // Projects
  const projectSelect = document.getElementById("projectId");
  const projectGroup = projectSelect.closest('.form-group');
  
  if (isSalesTeamLeader) {
       // Hide Project Selection for Sales
       if(projectGroup) projectGroup.style.display = 'none';
       projectSelect.innerHTML = '<option value="">Select Project (Optional)</option>';
  } else {
       if(projectGroup) projectGroup.style.display = 'block';
       projectSelect.innerHTML =
        '<option value="">Select Project (Optional)</option>';
      projects.forEach((project) => {
        const option = document.createElement("option");
        option.value = project.ProjectId;
        option.textContent = project.ProjectName;
        projectSelect.appendChild(option);
      });
  }

  // Employees (only supervised)
  const employeeSelect = document.getElementById("assignedToId");
  employeeSelect.innerHTML = '<option value="">Select Employee</option>';
  employees.forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp.UserId;
    option.textContent = emp.Name || emp.Username;
    employeeSelect.appendChild(option);
  });

  // Re-create element to clear listeners (populateDropdowns calls multiple times)
  const newEmployeeSelect = employeeSelect.cloneNode(true);
  // Ensure we have a parent before replacing (it should, but safety first)
  if(employeeSelect.parentNode) {
      employeeSelect.parentNode.replaceChild(newEmployeeSelect, employeeSelect);
  }

  // Auto-assign listener for Creative TL
  if (isCreativeTeamLeader) {
      newEmployeeSelect.addEventListener("change", (e) => {
          const userId = e.target.value;
          if(userId) {
             // We need to access employees array. It is available in scope.
             const emp = employees.find(u => (u.UserId || u.userId) == userId);
             if(emp && emp.Departments && emp.Departments.length > 0) {
                 const deptId = emp.Departments[0].DeptId || emp.Departments[0].deptId;
                 const targetDeptSelect = document.getElementById("deptId");
                 if(targetDeptSelect) targetDeptSelect.value = deptId;
             }
          }
      });
  }

  // Priorities
  const prioritySelect = document.getElementById("priorityId");
  prioritySelect.innerHTML = '<option value="">Select Priority</option>';
  priorities.forEach((priority) => {
    const option = document.createElement("option");
    const pId = priority.PriorityId !== undefined ? priority.PriorityId : priority.priorityId;
    option.value = pId;
    option.textContent = priority.PriorityLevel || priority.priorityLevel;
    prioritySelect.appendChild(option);
  });

  // Statuses
  const statusSelect = document.getElementById("statusId");
  statusSelect.innerHTML = '<option value="">Select Status</option>';
  
  let filteredStatuses = statuses;
  if (isCreativeTeamLeader) {
    // Creative Team Leader can only select Pending (0) or In Progress (1)
    filteredStatuses = statuses.filter(s => {
      const id = s.StatusId !== undefined ? s.StatusId : s.statusId;
      return id === 0 || id === 1;
    });
  }

  filteredStatuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status.StatusId !== undefined ? status.StatusId : status.statusId;
    option.textContent = status.StatusName || status.statusName;
    statusSelect.appendChild(option);
  });

  // Departments
  const deptSelect = document.getElementById("deptId");
  deptSelect.innerHTML = '<option value="">Select Department</option>';
  
  let filteredDepartments = departments;
  
  if (isCreativeTeamLeader) {
      // Creative Team Leader: Hide Department Selector (Auto-assigned)
      const formGroup = deptSelect.closest(".form-group");
      if(formGroup) formGroup.style.display = 'none';
      
      // Still populate all departments so we can set value programmatically
      filteredDepartments = departments;
  }


  filteredDepartments.forEach((dept) => {
    const option = document.createElement("option");
    option.value = dept.DeptId || dept.deptId;
    option.textContent = dept.DeptName || dept.deptName;
    deptSelect.appendChild(option);
  });
}

function filterTasks() {
  const statusFilter = document.getElementById("statusFilter").value;
  
  // Filter out tasks that are "In Review" (StatusId 2) as they should appear in "My Tasks"
  let filtered = allTasks.filter(task => {
    const sId = task.StatusId !== undefined ? task.StatusId : task.statusId;
    return sId !== 2;
  });

  if (statusFilter) {
    filtered = filtered.filter((task) => task.StatusId == statusFilter);
  }

  renderTasks(filtered);
}

function renderTasks(tasks) {
  const tbody = document.getElementById("teamTasksBody");
  
  // Check if Sales Team Leader
  const isSalesTeamLeader = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");

  const activityMap = {
    1: '<span class="badge badge-info">Meeting</span>',
    2: '<span class="badge badge-secondary">Cold Call</span>',
    3: '<span class="badge badge-warning">Data</span>',
    4: '<span class="badge badge-success">Closing</span>'
  };

  // Dynamic Header
  const thead = document.getElementById("teamTasksTableHead");
  if(thead) {
      if(isSalesTeamLeader) {
          thead.innerHTML = `
              <tr>
                <th>Task</th>
                <th>Activity</th>
                <th>Client Info</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>`;
      } else {
          thead.innerHTML = `
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>`;
      }
  }

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isSalesTeamLeader ? 8 : 7}" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No team tasks found</h3>
            <p>No tasks assigned to your team members</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tasks
    .map((task) => {
      const taskId = task.taskId || task.TaskId || task.Id;
      const statusId = task.statusId !== undefined ? task.statusId : task.StatusId;
      
      // Check if task needs review (StatusId 2 = "In Review")
      const needsReview = statusId === 2;
      
      const reviewBadge = needsReview
        ? '<span class="badge badge-warning" style="margin-left: 5px;">Needs Review</span>'
        : "";

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
      <td><strong>${utils.escapeHtml(task.Title || "Untitled Task")}</strong>${reviewBadge}</td>
      ${middleCols}
      <td>${utils.escapeHtml(task.AssignedToName || "Unassigned")}</td>
      <td>${utils.getStatusBadge(statusId)}</td>
      <td>${utils.getPriorityBadge(task.PriorityId !== undefined ? task.PriorityId : 1)}</td>
      <td>${utils.formatDate(task.DueDate)}</td>
      <td>
        <div class="action-buttons">
          ${
            needsReview
              ? `
          <button class="btn btn-sm btn-warning" onclick="openReviewModal(${taskId})" title="Review completed task">
            <i class="fa-solid fa-clipboard-check"></i>
          </button>
          `
              : ""
          }
          <button class="btn btn-sm btn-primary" onclick="viewTask(${taskId})" title="View details">
            <i class="fa-solid fa-eye"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
    })
    .join("");
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

function showCreateModal() {
  currentEditId = null;
  const form = document.getElementById("taskForm");
  form.reset();
  document.getElementById("modalTitle").textContent = "Create New Task";
  
  // Enforce Pending status for new tasks (state machine: create → Pending only)
  updateStatusDropdown(false, 0);
  const statusSelect = document.getElementById("statusId");
  statusSelect.disabled = true; // Prevent changing status during creation

  // Check Sales
  const isSales = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");
  // Check Creative
  const isCreativeTeamLeader = currentUser.Departments && currentUser.Departments.some(d => (d.DeptName || d.Name || '').toLowerCase().includes("creative"));

  const deptSelect = document.getElementById("deptId");
  const driveFolderLink = document.getElementById("driveFolderLink");
  const materialDriveFolderLink = document.getElementById("materialDriveFolderLink");
  
  if (isSales) {
      // Default to Sales Department (Logic to find ID)
      for(let i=0; i<deptSelect.options.length; i++) {
        const txt = deptSelect.options[i].text.toLowerCase();
        if(txt === 'sales') {
          deptSelect.value = deptSelect.options[i].value;
          break;
        }
      }
      if(deptSelect.closest(".form-group")) deptSelect.closest(".form-group").style.display = 'none'; // Lock/Hide for Sales
      
      // Hide Drive Links for Sales
      if(driveFolderLink) {
          driveFolderLink.closest(".form-group").style.display = 'none';
          driveFolderLink.required = false;
      }
      if(materialDriveFolderLink) materialDriveFolderLink.closest(".form-group").style.display = 'none';

  } else {
      if(deptSelect && deptSelect.closest(".form-group")) {
          // Hide for Creative too (Auto-assign background) or Show for others
          deptSelect.closest(".form-group").style.display = isCreativeTeamLeader ? 'none' : 'block';
      }
      // Restore Drive Links for others
      if(driveFolderLink) {
          driveFolderLink.closest(".form-group").style.display = 'block';
          driveFolderLink.required = true;
      }
      if(materialDriveFolderLink) materialDriveFolderLink.closest(".form-group").style.display = 'block';
  }
  

  // Handle Sales Fields Injection
  const existingSales = document.getElementById("salesFieldsArea");
  if(existingSales) existingSales.remove();

  if(isSales) {
      const salesHtml = `
      <div id="salesFieldsArea">
        <!-- Sales Fields (Integrated) -->
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
          // Load zones without selection for new task
          loadSalesZones("salesLocationTag", null);
      }
  }

  // Clear Sales Data if exists (timeout to ensure elements exist if just injected)
  if(isSales) {
      setTimeout(() => {
          if(document.getElementById("salesActivityType")) document.getElementById("salesActivityType").value = "";
          if(document.getElementById("salesClientInfo")) document.getElementById("salesClientInfo").value = "";
      }, 100);
  }
  
  document.getElementById("taskModal").classList.remove("d-none");
}

function closeModal() {
  document.getElementById("taskModal").classList.add("d-none");
  currentEditId = null;
  // Reset status field state
  document.getElementById("statusId").disabled = false;
}

async function handleSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const priorityId = document.getElementById("priorityId").value;
  const statusId = document.getElementById("statusId").value;
  const deptId = document.getElementById("deptId").value;
  const dueDateVal = document.getElementById("dueDate").value;

  if (!title) {
    utils.showError("Please enter a task title");
    return;
  }
  if (priorityId === "") {
    utils.showError("Please select a priority");
    return;
  }
  if (statusId === "") {
    utils.showError("Please select a status");
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
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

    if (selectedDate < today) {
      utils.showError("Due date cannot be in the past. Please select today or a future date.");
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
      
      // Map to proper backend field SalesMarketSegmentId
      const segId = document.getElementById("salesLocationTag")?.value;
      // Note: If segId is string/text from old code, it might break. 
      // But loadSalesZones now sets value=Id (int). So parseInt is correct.
      salesData.SalesMarketSegmentId = segId ? parseInt(segId) : null;
  }

  const formData = {
    Title: title,
    Description: document.getElementById("description").value,
    PriorityId: parseInt(priorityId),
    StatusId: parseInt(statusId),
    DueDate: dueDateVal || null,
    AssignedTo: document.getElementById("assignedToId").value ? parseInt(document.getElementById("assignedToId").value) : null,
    DeptId: parseInt(deptId),
    ProjectId: document.getElementById("projectId").value ? parseInt(document.getElementById("projectId").value) : null,
    DriveFolderLink: document.getElementById("driveFolderLink").value || "N/A", 
    MaterialDriveFolderLink: document.getElementById("materialDriveFolderLink").value || null,
    ...salesData // Merge sales data
  };

  console.log("Submitting Task Data:", formData);

  try {
    if (currentEditId) {
      await API.Tasks.update(currentEditId, formData);
      utils.showSuccess("Task updated successfully");
    } else {
      await API.Tasks.create(formData);
      utils.showSuccess("Task created successfully");
    }

    closeModal();
    await loadTeamTasks();
  } catch (error) {
    console.error("Error saving task:", error);
    utils.showError(error.message || "Failed to save task");
  }
}

// View task details
async function viewTask(taskId) {
  try {
    utils.showLoading();
    const task = await API.Tasks.getById(taskId);
    
    // Check if Sales Team Leader
    const isSalesTeamLeader = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");

    if (!task) {
      utils.showError("Task not found");
      return;
    }

    const driveFolderLink = task.driveFolderLink || task.DriveFolderLink || "";
    const materialDriveFolderLink = task.materialDriveFolderLink || task.MaterialDriveFolderLink || "";

    const detailsContainer = document.getElementById("taskDetailsContent");
    detailsContainer.innerHTML = `
      <div class="details-grid" style="margin-bottom: var(--space-4);">
          <div class="detail-item">
            <label class="detail-label"><i class="fa-solid fa-heading"></i> Task Title</label>
            <div class="detail-value">${utils.escapeHtml(task.title || task.Title)}</div>
          </div>

          <div class="detail-item">
            <label class="detail-label"><i class="fa-solid fa-align-left"></i> Description</label>
            <div class="detail-value">${utils.escapeHtml(task.description || task.Description || "No description")}</div>
          </div>

          <div class="detail-item">
            <label class="detail-label"><i class="fa-solid fa-user"></i> Assigned To</label>
            <div class="detail-value">${utils.escapeHtml(task.assignedToName || task.AssignedToName || "Unassigned")}</div>
          </div>
          <div class="detail-item">
            <label class="detail-label"><i class="fa-solid fa-flag"></i> Priority</label>
            <div class="detail-value">${utils.getPriorityBadge(task.priorityId || task.PriorityId)}</div>
          </div>
          <div class="detail-item">
            <label class="detail-label"><i class="fa-solid fa-info-circle"></i> Status</label>
            <div class="detail-value">${utils.getStatusBadge(task.statusId ?? task.StatusId ?? 0)}</div>
          </div>
        ${!isSalesTeamLeader ? `
        <div class="detail-item">
          <label class="detail-label"><i class="fa-solid fa-folder"></i> Project</label>
          <div class="detail-value">${utils.escapeHtml(task.projectName || task.ProjectName || "No Project")}</div>
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
        ${ (task.StatusId == 2 || task.statusId == 2 || task.StatusId == 3 || task.statusId == 3) ? `
        <div class="detail-item">
            <label class="detail-label"><i class="fa-solid fa-chart-line"></i> KPI Value (Result)</label>
             <div class="detail-value" style="font-weight: bold; color: var(--primary); font-size: 1.1em;">${
                task.FinalKpiValue != null ? task.FinalKpiValue : "0"
             }</div>
        </div>
        ` : '' }
        `}
        <div class="detail-item">
          <label class="detail-label"><i class="fa-solid fa-user-pen"></i> Created By</label>
          <div class="detail-value">${utils.escapeHtml(task.createdByName || task.CreatedByName || "Unknown")}</div>
        </div>
        <div class="detail-item">
          <label class="detail-label"><i class="fa-solid fa-calendar"></i> Due Date</label>
          <div class="detail-value">${utils.formatDate(task.dueDate || task.DueDate)}</div>
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

    // Inject Actions into Footer (removed from helper template)
    const footerActions = document.getElementById("taskDetailsActions");
    if(footerActions) {
        footerActions.innerHTML = "";
        
        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-info";
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit'; // Edit Icon
        editBtn.onclick = () => {
             closeTaskDetailsModal();
             editTask(taskId);
        };
        footerActions.appendChild(editBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-danger";
        deleteBtn.style.marginLeft = "10px";
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
        deleteBtn.onclick = () => {
            closeTaskDetailsModal();
            deleteTask(taskId);
        };
        footerActions.appendChild(deleteBtn);
    }

    document.getElementById("taskDetailsModal").classList.remove("d-none");
  } catch (error) {
    console.error("Failed to load task details:", error);
    utils.showError("Failed to load task details");
  } finally {
    utils.hideLoading();
  }
}

// Close task details modal
function closeTaskDetailsModal() {
  document.getElementById("taskDetailsModal").classList.add("d-none");
}

// Open review modal — delegates to shared component (HIGH-01)
function openReviewModal(taskId) {
  if (!window.ReviewModal) { console.error("ReviewModal not loaded"); return; }
  return ReviewModal.open(taskId, { onSubmitted: () => (typeof loadTeamTasks === "function" ? loadTeamTasks() : null) });
}

async function _legacyOpenReviewModal_unused(taskId) {
  const task = allTasks.find((t) => (t.taskId || t.TaskId || t.Id) == taskId);
  if (!task) return;

  currentEditId = taskId;

  try {
    utils.showLoading();

    // Populate modal with task details
    document.getElementById("reviewTaskTitle").textContent =
      task.title || task.Title || "Untitled";
    document.getElementById("reviewDescription").textContent =
      task.description || task.Description || "No description";
    document.getElementById("reviewAssignee").textContent =
      task.assignedToName ||
      task.AssignedToName ||
      task.AssignedTo ||
      "Unknown";

    document.getElementById("reviewCompletedDate").textContent =
      utils.formatDate(
        task.completedDate ||
          task.CompletedDate ||
          task.CompletedAt ||
          new Date()
      );

    // Show/hide upload link
    const uploadLinkGroup = document.getElementById("reviewUploadLinkGroup");
    const isSalesTeamLeader = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");

    // --- Inject Sales KPI Field if needed ---
    const existingKpi = document.getElementById("salesKpiGroup");
    if(existingKpi) existingKpi.remove();

    if(isSalesTeamLeader) {
        // Pre-fill with existing value (from employee submission)
        const currentVal = (task.FinalKpiValue !== undefined && task.FinalKpiValue !== null) 
             ? task.FinalKpiValue 
             : ((task.finalKpiValue !== undefined && task.finalKpiValue !== null) ? task.finalKpiValue : "");

        const kpiHtml = `
        <div id="salesKpiGroup" class="form-group" style="background-color: #f0f8ff; padding: 10px; border-radius: 5px; border: 1px dashed #007bff; margin-bottom: 1rem;">
            <label class="text-primary" style="font-weight: bold;">
                <i class="fa-solid fa-calculator"></i> Final Result (KPI Value) *
            </label>
            <p class="text-muted small mb-2">Confirm or Edit the numeric result (e.g. 5 Leads, 1 Meeting, 1 (=Signed)/0 (=Not Signed)).</p>
            <input type="number" id="salesKpiValue" class="form-control" placeholder="Enter number..." value="${currentVal}" required>
        </div>
        `;
        // Insert before Notes
        const notesGroup = document.getElementById("managerNotesGroup");
        if(notesGroup) {
            notesGroup.insertAdjacentHTML('beforebegin', kpiHtml);
        }
    }
    // ----------------------------------------

    const uploadHref =
      task.driveFolderLink ||
      task.DriveFolderLink ||
      task.DriveUploadLink ||
      task.driveUploadLink ||
      null;
    
    if (uploadHref && !isSalesTeamLeader) {
      uploadLinkGroup.style.display = "block";
      document.getElementById("reviewUploadLink").href = utils.sanitizeUrl(uploadHref);
    } else {
      uploadLinkGroup.style.display = "none";
    }

    // Hide employee notes section
    const employeeNotesGroup = document.getElementById(
      "reviewEmployeeNotesGroup"
    );
    if (employeeNotesGroup) {
      employeeNotesGroup.style.display = "none";
    }

    document.getElementById("reviewAction").value = "approve";
    document.getElementById("managerNotes").value = "";
    document.getElementById("newDueDate").value = "";

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
  const notesGroup = document.getElementById("managerNotesGroup");
  const dueDateGroup = document.getElementById("newDueDateGroup");
  const salesKpiGroup = document.getElementById("salesKpiGroup");

  if (action === "revise") {
    notesGroup.style.display = "block";
    dueDateGroup.style.display = "block";
    if(salesKpiGroup) salesKpiGroup.style.display = "none";
  } else {
    // Approve
    notesGroup.style.display = "block"; // Keep notes for "Great job!" etc.
    dueDateGroup.style.display = "none";
    if(salesKpiGroup) salesKpiGroup.style.display = "block";
  }
}

// Close review modal
function closeReviewModal() {
  document.getElementById("reviewModal").classList.add("d-none");
  currentEditId = null;
}

// Submit review
async function submitReview() {
  if (!currentEditId) return;

  const action = document.getElementById("reviewAction").value;
  const notes = document.getElementById("managerNotes").value;
  const isSalesTeamLeader = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");

  if (action === "revise" && !notes.trim()) {
    utils.showError("Please provide revision notes");
    return;
  }
  
  // Validation for Sales KPI
  let finalKpiValue = null;
  if(isSalesTeamLeader && action === "approve") {
      const kpiInput = document.getElementById("salesKpiValue");
      if(kpiInput) {
          const val = kpiInput.value.trim();
          if(!val || isNaN(val)) {
             utils.showError("Please enter a valid Numeric Result (KPI Value) to approve this task.");
             return;
          }
          finalKpiValue = parseFloat(val);
      }
  }

  try {
    utils.showLoading();

    const newDueDate = document.getElementById("newDueDate").value;

    if (isSalesTeamLeader) {
        // Use Specialized Sales Review
        const reviewData = {
            TaskId: parseInt(currentEditId),
            IsApproved: action === "approve",
            FinalValue: finalKpiValue, // Will be null if revise
            RejectionReason: action === "revise" ? notes : null
        };
        await API.Sales.reviewTask(reviewData);
    } else {
        // Standard Review
        const reviewData = {
          approve: action === "approve",
          notes: notes || null,
          newDueDate: newDueDate || null,
        };
        await API.Tasks.reviewCompletion(currentEditId, reviewData);
    }

    // Close modal first
    closeReviewModal();

    // Show success message
    utils.showSuccess(
      action === "approve"
        ? "Task approved successfully!"
        : "Revision request sent."
    );

    // Reload tasks to refresh the list
    await loadTeamTasks();
  } catch (error) {
    console.error("Error submitting review:", error);
    utils.showError("Failed to submit review: " + (error.message || "Unknown error"));
  } finally {
    utils.hideLoading();
  }
}

async function editTask(taskId) {
  try {
    utils.showLoading();
    const task = await API.Tasks.getById(taskId);
    if (!task) {
      utils.showError("Task not found");
      return;
    }

    currentEditId = taskId;
    document.getElementById("modalTitle").textContent = "Edit Task";
    
    // Enable status selection for editing (unless it implies something else, usually fine)
    const statusSelect = document.getElementById("statusId");
    statusSelect.disabled = false;

    // Check Sales & Setup Fields
    const isSales = currentUser.Departments && currentUser.Departments.some(d => d.DeptName === "Sales" || d.Name === "Sales");
    // Check Creative
    const isCreativeTeamLeader = currentUser.Departments && currentUser.Departments.some(d => (d.DeptName || d.Name || '').toLowerCase().includes("creative"));
    
    const deptSelect = document.getElementById("deptId");
    const driveFolderLink = document.getElementById("driveFolderLink");
    const materialDriveFolderLink = document.getElementById("materialDriveFolderLink");
    
    // Handle Sales Fields Injection
    const existingSales = document.getElementById("salesFieldsArea");
    if(existingSales) existingSales.remove();

    if(isSales) {
        // Hide standard Department & Links
        if(deptSelect && deptSelect.closest(".form-group")) deptSelect.closest(".form-group").style.display = 'none';
        if(driveFolderLink) {
             driveFolderLink.closest(".form-group").style.display = 'none';
             driveFolderLink.required = false;
        }
        if(materialDriveFolderLink) materialDriveFolderLink.closest(".form-group").style.display = 'none';

        const salesHtml = `
        <div id="salesFieldsArea">
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
        const descElement = document.getElementById("description");
        if(descElement) {
            descElement.closest(".form-group").insertAdjacentHTML('afterend', salesHtml);
            const existingLoc = task.SalesMarketSegmentId || task.salesMarketSegmentId || task.SalesLocationTag || ""; 
            loadSalesZones("salesLocationTag", existingLoc);
        }
    } else {
        // Restore
        if(deptSelect && deptSelect.closest(".form-group")) {
            // Hide for Creative too
            deptSelect.closest(".form-group").style.display = isCreativeTeamLeader ? 'none' : 'block';
        }
        if(driveFolderLink) {
             driveFolderLink.closest(".form-group").style.display = 'block';
             driveFolderLink.required = true;
        }
        if(materialDriveFolderLink) materialDriveFolderLink.closest(".form-group").style.display = 'block';
    }

    // Populate form fields
    document.getElementById("title").value = task.Title || task.title || "";
    document.getElementById("description").value = task.Description || task.description || "";
    
    const pId = task.PriorityId !== undefined ? task.PriorityId : task.priorityId;
    document.getElementById("priorityId").value = pId !== undefined ? pId : "";

    const sId = task.StatusId !== undefined ? task.StatusId : task.statusId;
    // Restrict dropdown to valid state machine transitions for this status
    updateStatusDropdown(true, sId !== undefined ? sId : 0);
    
    // Handle date format
    const dueDate = task.DueDate || task.dueDate;
    if (dueDate) {
      const d = new Date(dueDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      document.getElementById("dueDate").value = `${year}-${month}-${day}`;
    } else {
      document.getElementById("dueDate").value = "";
    }

    document.getElementById("assignedToId").value = task.AssignedTo || task.assignedTo || "";
    document.getElementById("deptId").value = task.DeptId || task.deptId || "";
    document.getElementById("projectId").value = task.ProjectId || task.projectId || "";
    document.getElementById("driveFolderLink").value = task.DriveFolderLink || task.driveFolderLink || "";
    document.getElementById("materialDriveFolderLink").value = task.MaterialDriveFolderLink || task.materialDriveFolderLink || "";

    // Populate Sales Fields
    if(isSales) {
        if(document.getElementById("salesActivityType")) document.getElementById("salesActivityType").value = task.SalesActivityType || task.salesActivityType || "";
        if(document.getElementById("salesClientInfo")) document.getElementById("salesClientInfo").value = task.SalesClientInfo || task.salesClientInfo || "";
    }

    document.getElementById("taskModal").classList.remove("d-none");
  } catch (error) {
    console.error("Error loading task for edit:", error);
    utils.showError("Failed to load task details");
  } finally {
    utils.hideLoading();
  }
}

async function deleteTask(id) {
  if (!utils.confirmAction("Are you sure you want to delete this task?")) return;

  try {
    utils.showLoading();
    await API.Tasks.delete(id);
    utils.showSuccess("Task deleted successfully");
    await loadTeamTasks();
  } catch (error) {
    console.error("Error deleting task:", error);
    utils.showError("Failed to delete task");
  } finally {
    utils.hideLoading();
  }
}

// Helper to load sales zones
async function loadSalesZones(selectId, selectedValue = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">Loading zones...</option>';
    
    try {
        // MATCHING LOGIC FROM My Tasks (Load all then filter for Targeted)
        const zones = await API.Sales.getMarketSegments();
        // Filter for Targeted
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
                // Use Id for value
                opt.value = z.Id || z.id; 
                // Variable names matching my-tasks.js recent fix
                const zName = z.Place || z.place || z.ZoneName || z.zoneName || 'Unknown';
                const zCat = z.Category || z.category || '';
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

