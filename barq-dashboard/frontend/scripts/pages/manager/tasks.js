// Manager Tasks Page Script
auth.requireRole([USER_ROLES.MANAGER]);

let allTasks = []; // Store raw API data
let tasks = []; // Store currently filtered data
let projects = [];
let employees = [];
let departments = [];
let marketSegments = [];
let currentEditId = null;
let currentFilter = { column: "", value: "" };

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();

    [allTasks, projects, employees, departments, marketSegments] = await Promise.all([
      API.Tasks.getAll().catch(() => []),
      API.Projects.getAll().catch(() => []),
      API.Employees.getAll().catch(() => []),
      API.Departments.getAll().catch(() => []),
      API.Sales.getSegments ? API.Sales.getSegments().catch(() => []) : Promise.resolve([]), // Robust check
    ]);

    // Initial tasks are all tasks
    tasks = [...allTasks];

    console.log("[Manager] Loaded tasks from API:", tasks.length, "tasks");

    populateDropdowns();
    populateFilterDropdowns(); // Populate initial filter options
    renderTasks();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load tasks");
  } finally {
    utils.hideLoading();
  }
}

// Function to populate column-specific filters
function populateFilterDropdowns() {
    const filterColumn = document.getElementById("filterColumn");
    const filterValue = document.getElementById("filterValue");
    
    // Listen for column selection
    filterColumn.addEventListener("change", (e) => {
        const column = e.target.value;
        currentFilter.column = column;
        currentFilter.value = ""; // Reset value on column change

        if (!column) {
            filterValue.innerHTML = '<option value="">All</option>';
            filterValue.disabled = true;
            applyFilters();
            return;
        }

        // Extract unique values for this column from allTasks
        const uniqueValues = new Set();
        allTasks.forEach(task => {
            // Handle different casing/DTO structures
             let val = task[column] || task[column.charAt(0).toLowerCase() + column.slice(1)];
             
             // Handle StatusId specifically
             if (column === 'StatusId') {
                 // Use utils to get label or just the ID? 
                 // Better to group by logic. Let's start with raw values.
                 // Actually, for StatusId, we want distinct IDs.
                 // For PriorityId, distinct IDs.
             }
             if (val !== undefined && val !== null) {
                 uniqueValues.add(val);
             }
        });

        // Populate filterValue dropdown
        // Sort values
        const sortedValues = Array.from(uniqueValues).sort();
        
        // Custom rendering for IDs (Status, Priority)
        let optionsHtml = '<option value="">All</option>';
        sortedValues.forEach(val => {
            let label = val;
            if (column === 'StatusId') {
                // Map ID to label
                const badge = utils.getStatusBadge(val); // Returns HTML string, we need text.
                // Minimal map:
                const statusMap = {1: "Pending", 2: "In Progress", 3: "In Review", 4: "Completed", 5: "Cancelled"}; // Wait, check enum again.
                // Enums: Pending=0, InProgress=1, InReview=2, Completed=3
                // Check utils.js logic
                const statusMapUtils = {0: "Pending", 1: "In Progress", 2: "In Review", 3: "Completed", 4: "Cancelled"};
                label = statusMapUtils[val] || `Status ${val}`;
            } else if (column === 'PriorityId') {
                 const priorityMap = {0: "Low", 1: "Medium", 2: "High", 3: "Critical"};
                 label = priorityMap[val] || `Priority ${val}`;
            } else if (column === 'DueDate') {
                label = utils.formatDate(val);
            }

            optionsHtml += `<option value="${val}">${label}</option>`;
        });

        filterValue.innerHTML = optionsHtml;
        filterValue.disabled = false;
        applyFilters();
    });

    filterValue.addEventListener("change", (e) => {
        currentFilter.value = e.target.value;
        applyFilters();
    });
}

function applyFilters() {
    if (!currentFilter.column || currentFilter.value === "") {
        tasks = [...allTasks];
    } else {
        tasks = allTasks.filter(task => {
            const column = currentFilter.column;
            let taskVal = task[column] || task[column.charAt(0).toLowerCase() + column.slice(1)];
            
            // Loose comparison for IDs (string vs number)
            // Date comparison might need logic if exact string doesn't match
            if (column === 'DueDate') {
                // Filter by exact date string if possible, or maybe just string match
                 return String(taskVal) === String(currentFilter.value);
            }
            
            return String(taskVal) === String(currentFilter.value);
        });
    }
    renderTasks();
}

function populateDropdowns() {
  const projectSelect = document.getElementById("projectId");
  const employeeSelect = document.getElementById("assignedToId");
  const deptSelect = document.getElementById("deptId");
  const segmentSelect = document.getElementById("salesMarketSegmentId");

  // API returns: ProjectId, ProjectName for projects
  projectSelect.innerHTML =
    '<option value="">Select Project</option>' +
    projects
      .map(
        (p) =>
          `<option value="${p.projectId || p.ProjectId}">${p.projectName || p.ProjectName || p.Name || "Unnamed"
          }</option>`
      )
      .join("");

  // API returns: UserId, Name for users
  employeeSelect.innerHTML =
    '<option value="">Select Employee</option>' +
    employees
      .map(
        (e) =>
          `<option value="${e.UserId || e.Id}">${e.Name || e.name || e.Username || e.username || "Unknown"
          }</option>`
      )
      .join("");

  // Departments
  if (deptSelect && departments.length > 0) {
      deptSelect.innerHTML = '<option value="">Select Department</option>' + 
        departments.map(d => `<option value="${d.DeptId}">${d.DeptName}</option>`).join("");
  }

  // Market Segments
  if (segmentSelect && marketSegments.length > 0) {
      segmentSelect.innerHTML = '<option value="">Select Segment</option>' + 
        marketSegments.map(s => `<option value="${s.id || s.Id}">${s.name || s.Name || s.Place || s.place}</option>`).join("");
  }
}

function renderTasks() {
  const tbody = document.getElementById("tasksBody");

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center" style="padding: 40px;">
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
      const taskId = task.taskId || task.TaskId || task.Id;
      const statusId = task.statusId || task.StatusId || task.Status || 1;
      const priorityId =
        task.priorityId || task.PriorityId || task.Priority || 1;

      // Check if task needs review
      // StatusId 2 = "In Review" (set by backend when employee requests completion)
      const needsReview = statusId === 2;

      // Debug: Log tasks with "In Review" status
      if (needsReview) {
        console.log("[Tasks] Task needs review (StatusId=2):", task);
      }

      const reviewBadge = needsReview
        ? '<span class="badge badge-warning" style="margin-left: 5px;">Needs Review</span>'
        : "";

      return `
    <tr style="${needsReview ? "border-left: 4px solid #ff9800;" : ""}">
      <td><strong>${task.Title || task.title || "Untitled"
        }</strong>${reviewBadge}</td>
      <td>${task.ProjectName || task.projectName || "N/A"}</td>
      <td>${task.AssignedToName || task.assignedToName || "Unassigned"}</td>
      <td>${utils.getStatusBadge(statusId)}</td>
      <td>${utils.getPriorityBadge(priorityId)}</td>
      <td>${utils.formatDate(task.DueDate || task.dueDate)}</td>
      <td>${utils.formatDate(task.UpdatedAt || task.updatedAt || task.CreatedAt || task.createdAt)}</td>
      <td>${task.CreatedByName || task.createdByName || "System"}</td>
      <td>
        <div class="table-actions">
          ${needsReview
          ? `
          <button class="btn btn-sm btn-warning" onclick="openReviewModal(${taskId})" title="Review completed task">
            <i class="fa-solid fa-clipboard-check"></i>
          </button>
          `
          : ""
        }
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

// Toggle fields based on department
window.toggleTaskFields = function() {
    const deptId = parseInt(document.getElementById("deptId").value);
    const creativeFields = document.getElementById("creativeFields");
    const salesFields = document.getElementById("salesFields");
    
    // Find Sales department - Assuming name "Sales"
    const salesDept = departments.find(d => (d.DeptName || d.name) === "Sales");
    const isSales = salesDept && salesDept.DeptId === deptId;

    if (isSales) {
        if (salesFields) salesFields.style.display = "block";
        if (creativeFields) creativeFields.style.display = "none";
    } else {
        if (salesFields) salesFields.style.display = "none";
        // Creative fields are default for others or specifically Creative
        // For now show for all non-sales to maintain existing functionality
        if (creativeFields) creativeFields.style.display = "block";
    }
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

function updateStatusDropdown(isEdit) {
  const select = document.getElementById("status");
  
  let html = `
    <option value="1">Pending</option>
    <option value="2">In Progress</option>
  `;

  if (isEdit) {
    html += `
      <option value="3">In Review</option>
      <option value="4">Completed</option>
      <option value="5">Cancelled</option>
    `;
  }

  select.innerHTML = html;
}

function showCreateModal() {
  currentEditId = null;
  document.getElementById("modalTitle").textContent = "Create Task";
  document.getElementById("taskForm").reset();
  clearFormErrors(document.getElementById("taskForm"));
  document.getElementById("taskId").value = "";
  
  updateStatusDropdown(false);
  document.getElementById("status").value = "1";

  // Reset conditional fields
  document.getElementById("creativeFields").style.display = "block";
  document.getElementById("salesFields").style.display = "none";

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
  // Try to fetch full task details from the API to ensure optional fields
  // like Description and Drive links are available (list endpoints may omit them).
  try {
    const full = await API.Tasks.getById(id).catch(() => null);
    if (full) Object.assign(task, full);
  } catch (e) {
    // ignore and continue with available data
    console.warn("Failed to fetch full task details:", e);
  }

  currentEditId = id;
  document.getElementById("modalTitle").textContent = "Edit Task";
  document.getElementById("taskId").value = id;
  
  updateStatusDropdown(true);

  // Use detail DTO fields (PascalCase from getById)
  document.getElementById("title").value = task.Title || "";
  document.getElementById("description").value = task.Description || "";
  document.getElementById("projectId").value = task.ProjectId || "";
  document.getElementById("assignedToId").value = task.AssignedTo || "";
  
  // Populate Department
  const deptId = task.DeptId || task.deptId || 1;
  document.getElementById("deptId").value = deptId;
  
  // Trigger visibility toggle
  if (window.toggleTaskFields) window.toggleTaskFields();
  
  const sId = task.StatusId !== undefined ? task.StatusId : (task.statusId !== undefined ? task.statusId : 0);
  document.getElementById("status").value = sId;

  const pId = task.PriorityId !== undefined ? task.PriorityId : (task.priorityId !== undefined ? task.priorityId : 1);
  document.getElementById("priority").value = pId;

  // Creative Fields
  const upLink = document.getElementById("driveUploadLink");
  if (upLink) upLink.value = task.DriveFolderLink || "";
  
  const matLink = document.getElementById("driveMaterialLink");
  if (matLink) matLink.value = task.MaterialDriveFolderLink || "";

  // Sales Fields
  const actType = document.getElementById("salesActivityType");
  if (actType) actType.value = task.SalesActivityType !== undefined && task.SalesActivityType !== null ? task.SalesActivityType : "";
  
  const clientInfo = document.getElementById("salesClientInfo");
  if (clientInfo) clientInfo.value = task.SalesClientInfo || "";
  
  const segId = document.getElementById("salesMarketSegmentId");
  if (segId) segId.value = task.SalesMarketSegmentId || "";
    
  // New fields
  document.getElementById("specificTime").value = task.SpecificTime || "";
  document.getElementById("estimatedHours").value = task.EstimatedHours || "";
  document.getElementById("tags").value = task.Tags || "";

  if (task.DueDate) {
    // Fix Issue 1: Prevent timezone shift by using the date string directly
    // The API returns ISO string (e.g. 2023-11-23T00:00:00)
    // We just want the first 10 chars "2023-11-23"
    const dateStr = String(task.DueDate);
    document.getElementById("dueDate").value = dateStr.substring(0, 10);
  }

  document.getElementById("taskModal").classList.remove("d-none");
}

async function handleSubmit(e) {
  e.preventDefault();
  clearFormErrors(document.getElementById("taskForm"));
  
  // Fix Issue 4: Ensure dueDate is strictly null if empty
  let dueDateInput = document.getElementById("dueDate").value;
  if (!dueDateInput) dueDateInput = null;

  let specificTime = document.getElementById("specificTime").value;
  if (specificTime && specificTime.length === 5) {
      specificTime += ":00";
  }

  const statusVal = parseInt(document.getElementById("status").value);
  const priorityVal = parseInt(document.getElementById("priority").value);

  // Build payload matching API `CreateTaskDto` / `UpdateTaskDto` (camelCase)
  const formData = {
    title: document.getElementById("title").value,
    description: document.getElementById("description").value || null,
    projectId: parseInt(document.getElementById("projectId").value) || null,
    assignedTo: parseInt(document.getElementById("assignedToId").value) || null,
    statusId: !isNaN(statusVal) ? statusVal : 0, // Default to Pending (0)
    priorityId: !isNaN(priorityVal) ? priorityVal : 1, // Default to Medium (1)
    dueDate: dueDateInput,
    specificTime: specificTime || null,
    estimatedHours: parseFloat(document.getElementById("estimatedHours").value) || null,
    tags: document.getElementById("tags").value || null,
    deptId: parseInt(document.getElementById("deptId").value) || 1, // Default to 1 (General/Creative) if not set
    
    // Creative Fields
    driveFolderLink: document.getElementById("driveUploadLink")?.value || "https://drive.google.com/drive/folders/default", 
    materialDriveFolderLink: document.getElementById("driveMaterialLink")?.value || null,

    // Sales Fields
    salesActivityType: document.getElementById("salesActivityType")?.value ? parseInt(document.getElementById("salesActivityType").value) : null,
    salesClientInfo: document.getElementById("salesClientInfo")?.value || null,
    salesMarketSegmentId: document.getElementById("salesMarketSegmentId")?.value ? parseInt(document.getElementById("salesMarketSegmentId").value) : null,
  };

  // Validate due date
  if (dueDateInput) {
    const selectedDate = new Date(dueDateInput);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    if (selectedDate < today) {
      utils.showError("Due date cannot be in the past");
      return;
    }
  }

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
    // prefer showing server-provided message when available
    let msg = "Failed to save task";
    if (error && error.message) {
      const parts = error.message.split(":");
      msg = parts.length > 1 ? parts.slice(1).join(":").trim() : error.message;
      msg = msg.replace(/^\s*["']|["']\s*$/g, "");
    }
    // If there are field-level errors in the response attempt to show them
    if (typeof tryApplyFieldErrors === "function") {
      tryApplyFieldErrors(error, document.getElementById("taskForm"));
    }
    utils.showError(msg);
  } finally {
    utils.hideLoading();
  }
}

// --- Form error helpers ---
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
    // try several id/name variants
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
    // remove leading HTTP code if present
    let content = error.message.replace(/^HTTP\s*\d+\s*:\s*/i, "").trim();
    // if it's quoted JSON string, strip wrapping quotes
    if (
      (content.startsWith('"') && content.endsWith('"')) ||
      (content.startsWith("'") && content.endsWith("'"))
    ) {
      content = content.slice(1, -1);
    }
    // try parse JSON
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = null;
    }
    if (parsed) {
      // Common shapes: { errors: { field: [msg] } } or { field: [msg] }
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

// Open review modal
async function openReviewModal(taskId) {
  // Try to find in list first for basic info
  let task = tasks.find((t) => (t.taskId || t.TaskId || t.Id) == taskId);

  try {
    utils.showLoading();
    
    // FETCH FULL DETAILS (Fixes missing Description/KPI issue)
    const fullTask = await API.Tasks.getById(taskId);
    if(fullTask) task = fullTask;

    if (!task) return;

    currentEditId = taskId;

    // Populate modal with task details
    document.getElementById("reviewTaskTitle").textContent =
      task.title || task.Title || "Untitled";
    
    // Description (Handle null)
    document.getElementById("reviewDescription").textContent =
      task.description || task.Description || task.note || "No description";

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

    // Identify if Sales Task
    const isSales = (task.DeptName && task.DeptName === "Sales") || (task.SalesActivityType !== undefined && task.SalesActivityType !== null);
    
    const uploadLinkGroup = document.getElementById("reviewUploadLinkGroup");
    const kpiGroup = document.getElementById("reviewSalesKpiGroup");
    const projectGroup = document.getElementById("reviewProjectGroup");
    const clientInfoGroup = document.getElementById("reviewClientInfoGroup");
    const locationGroup = document.getElementById("reviewLocationGroup");
    const activityTypeGroup = document.getElementById("reviewActivityTypeGroup");

    if (isSales) {
        // SALES LAYOUT: Task, Desc, Assignee, Date, KPI
        if (uploadLinkGroup) uploadLinkGroup.style.display = "none";
        if (projectGroup) projectGroup.style.display = "none";
        
        // Hide Extra Sales Fields (Per user request: "only show Task/ description/ Assigned To/ Completed Date and KPI Value")
        if (clientInfoGroup) clientInfoGroup.style.display = "none";
        if (locationGroup) locationGroup.style.display = "none";
        if (activityTypeGroup) activityTypeGroup.style.display = "none";
        
        // Show KPI Display
        if (kpiGroup) {
            kpiGroup.style.display = "block";
            // Check FinalKpiValue carefully
            let kpiVal = 0;
            if (task.FinalKpiValue !== undefined && task.FinalKpiValue !== null) kpiVal = task.FinalKpiValue;
            else if (task.finalKpiValue !== undefined && task.finalKpiValue !== null) kpiVal = task.finalKpiValue;
            document.getElementById("reviewSalesKpi").textContent = kpiVal;
        }
    } else {
        // CREATIVE LAYOUT: Task, Desc, Assignee, Date, Submitted Link (assumed essential)
        // Hide Sales Specifics
        if (kpiGroup) kpiGroup.style.display = "none";
        if (clientInfoGroup) clientInfoGroup.style.display = "none";
        if (locationGroup) locationGroup.style.display = "none";
        if (activityTypeGroup) activityTypeGroup.style.display = "none";

        // Hide Project (Per user request: "only show Task/ description/ Assigned To/ Completed Date")
        if (projectGroup) projectGroup.style.display = "none";

        const uploadHref =
          task.driveFolderLink ||
          task.DriveFolderLink ||
          task.DriveUploadLink ||
          task.driveUploadLink ||
          null;
          
        if (uploadHref) {
           if (uploadLinkGroup) {
               uploadLinkGroup.style.display = "block";
               document.getElementById("reviewUploadLink").href = uploadHref;
           }
        } else {
           if (uploadLinkGroup) uploadLinkGroup.style.display = "none";
        }
    }

    // Hide employee notes section
    const employeeNotesGroup = document.getElementById(
      "reviewEmployeeNotesGroup"
    );
    if (employeeNotesGroup) {
      employeeNotesGroup.style.display = "none";
    }

    document.getElementById("reviewAction").value = "approve";
    document.getElementById("reviewNotes").value = "";
    document.getElementById("reviewNewDueDate").value = "";

    // Show/hide notes based on default action (Approve = Hidden)
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
    // Approve: Hide Feedback & Date
    notesGroup.style.display = "none";
    dueDateGroup.style.display = "none";
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
  const notes = document.getElementById("reviewNotes").value;

  if (action === "revise" && !notes.trim()) {
    utils.showError("Please provide revision notes");
    return;
  }
  
  try {
    utils.showLoading();

    // Use the new review-completion endpoint
    const newDueDate = document.getElementById("reviewNewDueDate").value;

    const reviewData = {
      approve: action === "approve",
      notes: notes || null,
      newDueDate: newDueDate || null
    };

    console.log("[Manager Review] Submitting review:", {
      taskId: currentEditId,
      action,
      reviewData,
    });
    await API.Tasks.reviewCompletion(currentEditId, reviewData);
    console.log("[Manager Review] Review submitted successfully");

    // Close modal first
    closeReviewModal();

    // Show success message
    utils.showSuccess(
      action === "approve"
        ? "Task approved successfully! Task marked as done."
        : "Revision request sent to employee with notes."
    );

    // Reload tasks to refresh the list and remove review flag
    await loadData();
  } catch (error) {
    console.error("Error submitting review:", error);
    utils.showError("Failed to submit review");
  } finally {
    utils.hideLoading();
  }
}
