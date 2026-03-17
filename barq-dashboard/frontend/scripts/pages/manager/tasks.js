// Manager Tasks Page Script
auth.requireRole([USER_ROLES.MANAGER]);

let allTasks = [];
let tasks = [];
let projects = [];
let employees = [];
let departments = [];
let marketSegments = [];
let currentEditId = null;
let currentFilter = { column: "", value: "" };
let currentDeptType = null; // "creative" | "sales" | "mgmt" | null

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
      API.Sales.getSegments ? API.Sales.getSegments().catch(() => []) : Promise.resolve([]),
    ]);
    tasks = [...allTasks];
    populateDeptDropdown();
    populateFilterDropdowns();
    renderTasks();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load tasks");
  } finally {
    utils.hideLoading();
  }
}

// --- Dropdown Helpers ---

function populateDeptDropdown() {
  const select = document.getElementById("deptId");
  if (select && departments.length > 0) {
    select.innerHTML = '<option value="">Select Department</option>' +
      departments.map(d => `<option value="${d.DeptId}">${d.DeptName}</option>`).join("");
  }
}

function populateEmployeesByDept(deptId) {
  const select = document.getElementById("assignedToId");
  if (!deptId) {
    select.innerHTML = '<option value="">Select Employee</option>';
    return;
  }
  const filtered = employees.filter(e => {
    const empDepts = e.Departments || e.departments || [];
    return empDepts.some(d => (d.DeptId || d.deptId) == deptId);
  });
  select.innerHTML =
    '<option value="">Select Employee</option>' +
    filtered.map(e =>
      `<option value="${e.UserId || e.Id}">${e.Name || e.name || e.Username || "Unknown"}</option>`
    ).join("");
}

function populateProjectDropdown(deptIds) {
  const select = document.getElementById("projectId");
  const filtered = deptIds && deptIds.length > 0
    ? projects.filter(p => {
        const pDepts = p.DepartmentIds || p.departmentIds || [];
        return pDepts.some(d => deptIds.includes(d));
      })
    : projects;
  select.innerHTML =
    '<option value="">Select Project</option>' +
    filtered.map(p =>
      `<option value="${p.projectId || p.ProjectId}">${p.projectName || p.ProjectName || p.Name || "Unnamed"}</option>`
    ).join("");
}

function populateSegmentDropdown() {
  const select = document.getElementById("salesMarketSegmentId");
  if (select && marketSegments.length > 0) {
    select.innerHTML = '<option value="">Select Segment</option>' +
      marketSegments.map(s => `<option value="${s.id || s.Id}">${s.name || s.Name || s.Place || s.place}</option>`).join("");
    const group = document.getElementById("salesMarketSegmentGroup");
    if (group) group.style.display = "block";
  }
}

// --- Department Detection ---

function getDeptType(deptName) {
  if (!deptName) return "creative";
  const name = deptName.toLowerCase();
  if (name === "sales") return "sales";
  if (name === "management") return "mgmt";
  return "creative";
}

// --- Department Selected: filter employees + show dept-specific fields ---

window.onDeptSelected = function() {
  const deptId = parseInt(document.getElementById("deptId").value);
  const deptFieldsContainer = document.getElementById("deptFields");
  const creativeFields = document.getElementById("creativeFields");
  const salesFields = document.getElementById("salesFields");
  const mgmtFields = document.getElementById("mgmtFields");

  // Reset employee dropdown based on selected dept
  populateEmployeesByDept(deptId);

  if (!deptId) {
    deptFieldsContainer.style.display = "none";
    creativeFields.style.display = "none";
    salesFields.style.display = "none";
    mgmtFields.style.display = "none";
    currentDeptType = null;
    disableRequiredInSection(creativeFields);
    disableRequiredInSection(salesFields);
    disableRequiredInSection(mgmtFields);
    return;
  }

  const dept = departments.find(d => d.DeptId == deptId);
  const deptName = dept ? (dept.DeptName || dept.name || "") : "";
  const type = getDeptType(deptName);
  currentDeptType = type;

  deptFieldsContainer.style.display = "block";

  creativeFields.style.display = "none";
  salesFields.style.display = "none";
  mgmtFields.style.display = "none";
  disableRequiredInSection(creativeFields);
  disableRequiredInSection(salesFields);
  disableRequiredInSection(mgmtFields);

  if (type === "creative") {
    creativeFields.style.display = "block";
    enableRequiredInSection(creativeFields);
    populateProjectDropdown([deptId]);
  } else if (type === "sales") {
    salesFields.style.display = "block";
    enableRequiredInSection(salesFields);
    populateSegmentDropdown();
  } else if (type === "mgmt") {
    mgmtFields.style.display = "block";
    enableRequiredInSection(mgmtFields);
  }
}

// Disable/enable required on hidden/shown sections to prevent validation blocking
function disableRequiredInSection(section) {
  if (!section) return;
  section.querySelectorAll("[required]").forEach(el => {
    el.dataset.wasRequired = "true";
    el.removeAttribute("required");
  });
}

function enableRequiredInSection(section) {
  if (!section) return;
  section.querySelectorAll("[data-was-required]").forEach(el => {
    el.setAttribute("required", "");
  });
}

// --- Filter Dropdowns (table filters) ---

function populateFilterDropdowns() {
  const filterColumn = document.getElementById("filterColumn");
  const filterValue = document.getElementById("filterValue");

  filterColumn.addEventListener("change", (e) => {
    const column = e.target.value;
    currentFilter.column = column;
    currentFilter.value = "";
    if (!column) {
      filterValue.innerHTML = '<option value="">All</option>';
      filterValue.disabled = true;
      applyFilters();
      return;
    }
    const uniqueValues = new Set();
    allTasks.forEach(task => {
      let val = task[column] || task[column.charAt(0).toLowerCase() + column.slice(1)];
      if (val !== undefined && val !== null) uniqueValues.add(val);
    });
    const sortedValues = Array.from(uniqueValues).sort();
    let optionsHtml = '<option value="">All</option>';
    sortedValues.forEach(val => {
      let label = val;
      if (column === 'StatusId') {
        const statusMap = {0: "Pending", 1: "In Progress", 2: "In Review", 3: "Completed", 4: "Cancelled"};
        label = statusMap[val] || `Status ${val}`;
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
      return String(taskVal) === String(currentFilter.value);
    });
  }
  renderTasks();
}

// --- Render Tasks Table ---

function renderTasks() {
  const tbody = document.getElementById("tasksBody");
  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No tasks found</h3>
            <p>Create your first task to get started</p>
          </div>
        </td>
      </tr>`;
    return;
  }
  tbody.innerHTML = tasks.map((task) => {
    const taskId = task.taskId || task.TaskId || task.Id;
    const statusId = task.statusId ?? task.StatusId ?? task.Status ?? 0;
    const priorityId = task.priorityId ?? task.PriorityId ?? task.Priority ?? 0;
    const needsReview = statusId === 2;
    const reviewBadge = needsReview
      ? '<span class="badge badge-warning" style="margin-left: 5px;">Needs Review</span>' : "";
    return `
    <tr style="${needsReview ? "border-left: 4px solid #ff9800;" : ""}">
      <td><strong>${utils.escapeHtml(task.Title || task.title || "Untitled")}</strong>${reviewBadge}</td>
      <td>${utils.escapeHtml(task.ProjectName || task.projectName || "N/A")}</td>
      <td>${utils.escapeHtml(task.AssignedToName || task.assignedToName || "Unassigned")}</td>
      <td>${utils.getStatusBadge(statusId)}</td>
      <td>${utils.getPriorityBadge(priorityId)}</td>
      <td>${utils.formatDate(task.DueDate || task.dueDate)}</td>
      <td>${utils.formatDate(task.UpdatedAt || task.updatedAt || task.CreatedAt || task.createdAt)}</td>
      <td>${utils.escapeHtml(task.CreatedByName || task.createdByName || "System")}</td>
      <td>
        <div class="table-actions">
          ${needsReview ? `
          <button class="btn btn-sm btn-warning" onclick="openReviewModal(${taskId})" title="Review completed task">
            <i class="fa-solid fa-clipboard-check"></i>
          </button>` : ""}
          <button class="btn btn-sm btn-primary" onclick="editTask(${taskId})">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteTask(${taskId})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// --- Status Dropdown for Edit Mode ---

function updateStatusDropdown(selectId, isEdit, currentStatusId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  if (!isEdit) {
    select.innerHTML = '<option value="0">Pending</option>';
    return;
  }
  const statusLabels = {0: "Pending", 1: "In Progress", 2: "In Review", 3: "Completed", 4: "Closed"};
  let options = [{value: parseInt(currentStatusId), label: statusLabels[currentStatusId] || "Unknown"}];
  switch (parseInt(currentStatusId)) {
    case 0: options.push({value: 1, label: "In Progress"}); break;
    case 1: options.push({value: 2, label: "In Review"}); options.push({value: 4, label: "Closed"}); break;
    case 2: options.push({value: 3, label: "Completed"}); options.push({value: 1, label: "In Progress"}); break;
  }
  const seen = new Set();
  const unique = options.filter(o => { if (seen.has(o.value)) return false; seen.add(o.value); return true; });
  select.innerHTML = unique.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
}

// --- Modal: Create / Edit ---

function showCreateModal() {
  currentEditId = null;
  currentDeptType = null;
  document.getElementById("modalTitle").textContent = "Create Task";
  document.getElementById("taskForm").reset();
  clearFormErrors(document.getElementById("taskForm"));
  document.getElementById("taskId").value = "";
  document.getElementById("deptId").value = "";

  // Reset status dropdowns to Pending
  updateStatusDropdown("status", false, 0);
  updateStatusDropdown("salesStatus", false, 0);
  updateStatusDropdown("mgmtStatus", false, 0);

  // Hide all dept fields
  document.getElementById("deptFields").style.display = "none";
  document.getElementById("creativeFields").style.display = "none";
  document.getElementById("salesFields").style.display = "none";
  document.getElementById("mgmtFields").style.display = "none";
  disableRequiredInSection(document.getElementById("creativeFields"));
  disableRequiredInSection(document.getElementById("salesFields"));
  disableRequiredInSection(document.getElementById("mgmtFields"));

  // Reset employee dropdown (will be populated when dept is selected)
  document.getElementById("assignedToId").innerHTML = '<option value="">Select Employee</option>';

  document.getElementById("taskModal").classList.remove("d-none");
}

function closeModal() {
  document.getElementById("taskModal").classList.add("d-none");
  document.getElementById("taskForm").reset();
  currentEditId = null;
  currentDeptType = null;
}

async function editTask(id) {
  const task = tasks.find((t) => (t.taskId || t.TaskId || t.Id) == id);
  if (!task) return;
  try {
    const full = await API.Tasks.getById(id).catch(() => null);
    if (full) Object.assign(task, full);
  } catch (e) {
    console.warn("Failed to fetch full task details:", e);
  }

  currentEditId = id;
  document.getElementById("modalTitle").textContent = "Edit Task";
  document.getElementById("taskId").value = id;

  // Set title & description
  document.getElementById("title").value = task.Title || "";
  document.getElementById("description").value = task.Description || "";

  // Set department and trigger dept-specific fields + employee filter
  const deptId = task.DeptId || task.deptId || 1;
  document.getElementById("deptId").value = deptId;
  onDeptSelected();

  // Set employee value (ensure the assignee is in the filtered dropdown)
  const empSelect = document.getElementById("assignedToId");
  const assignedTo = task.AssignedTo || "";
  if (assignedTo && !empSelect.querySelector(`option[value="${assignedTo}"]`)) {
    const empName = task.AssignedToName || "Unknown";
    empSelect.insertAdjacentHTML('beforeend', `<option value="${assignedTo}">${empName}</option>`);
  }
  empSelect.value = assignedTo;

  // Now populate the active section's fields
  const sId = task.StatusId !== undefined ? task.StatusId : (task.statusId ?? 0);
  const pId = task.PriorityId !== undefined ? task.PriorityId : (task.priorityId ?? 1);
  const dateStr = task.DueDate ? String(task.DueDate).substring(0, 10) : "";

  if (currentDeptType === "creative") {
    updateStatusDropdown("status", true, sId);
    document.getElementById("status").value = sId;
    document.getElementById("priority").value = pId;
    document.getElementById("dueDate").value = dateStr;
    document.getElementById("projectId").value = task.ProjectId || "";
    const upLink = document.getElementById("driveUploadLink");
    if (upLink) upLink.value = task.DriveFolderLink || "";
    const matLink = document.getElementById("driveMaterialLink");
    if (matLink) matLink.value = task.MaterialDriveFolderLink || "";
  } else if (currentDeptType === "sales") {
    updateStatusDropdown("salesStatus", true, sId);
    document.getElementById("salesStatus").value = sId;
    document.getElementById("salesPriority").value = pId;
    document.getElementById("salesDueDate").value = dateStr;
    const actType = document.getElementById("salesActivityType");
    if (actType) actType.value = task.SalesActivityType !== undefined && task.SalesActivityType !== null ? task.SalesActivityType : "";
    const clientInfo = document.getElementById("salesClientInfo");
    if (clientInfo) clientInfo.value = task.SalesClientInfo || "";
    const segId = document.getElementById("salesMarketSegmentId");
    if (segId) segId.value = task.SalesMarketSegmentId || "";
  } else if (currentDeptType === "mgmt") {
    updateStatusDropdown("mgmtStatus", true, sId);
    document.getElementById("mgmtStatus").value = sId;
    document.getElementById("mgmtPriority").value = pId;
    document.getElementById("mgmtDueDate").value = dateStr;
  }

  document.getElementById("taskModal").classList.remove("d-none");
}

// --- Submit ---

async function handleSubmit(e) {
  e.preventDefault();
  clearFormErrors(document.getElementById("taskForm"));

  // Read from the active department section
  let statusVal, priorityVal, dueDateInput;
  if (currentDeptType === "sales") {
    statusVal = parseInt(document.getElementById("salesStatus").value);
    priorityVal = parseInt(document.getElementById("salesPriority").value);
    dueDateInput = document.getElementById("salesDueDate").value || null;
  } else if (currentDeptType === "mgmt") {
    statusVal = parseInt(document.getElementById("mgmtStatus").value);
    priorityVal = parseInt(document.getElementById("mgmtPriority").value);
    dueDateInput = document.getElementById("mgmtDueDate").value || null;
  } else {
    statusVal = parseInt(document.getElementById("status").value);
    priorityVal = parseInt(document.getElementById("priority").value);
    dueDateInput = document.getElementById("dueDate").value || null;
  }

  const formData = {
    title: document.getElementById("title").value,
    description: document.getElementById("description").value || null,
    assignedTo: parseInt(document.getElementById("assignedToId").value) || null,
    statusId: !isNaN(statusVal) ? statusVal : 0,
    priorityId: !isNaN(priorityVal) ? priorityVal : 1,
    dueDate: dueDateInput,
    deptId: parseInt(document.getElementById("deptId").value) || 1,
    specificTime: null,
    estimatedHours: null,
    tags: null,
    // Creative fields (null if not creative)
    projectId: currentDeptType === "creative" ? (parseInt(document.getElementById("projectId").value) || null) : null,
    driveFolderLink: currentDeptType === "creative" ? (document.getElementById("driveUploadLink")?.value || null) : "N/A",
    materialDriveFolderLink: currentDeptType === "creative" ? (document.getElementById("driveMaterialLink")?.value || null) : null,
    // Sales fields (null if not sales)
    salesActivityType: currentDeptType === "sales" && document.getElementById("salesActivityType")?.value !== "" ? parseInt(document.getElementById("salesActivityType").value) : null,
    salesClientInfo: currentDeptType === "sales" ? (document.getElementById("salesClientInfo")?.value || null) : null,
    salesMarketSegmentId: currentDeptType === "sales" && document.getElementById("salesMarketSegmentId")?.value ? parseInt(document.getElementById("salesMarketSegmentId").value) : null,
  };

  // Validate due date
  if (dueDateInput) {
    const selectedDate = new Date(dueDateInput);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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

// --- Event Listeners ---

function setupEventListeners() {
  document.getElementById("taskForm").addEventListener("submit", handleSubmit);
  document.getElementById("searchInput").addEventListener("input", handleSearch);
}

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  document.querySelectorAll("#tasksBody tr").forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? "" : "none";
  });
}

// --- Form Error Helpers ---

function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
  form.querySelectorAll(".invalid-feedback").forEach(el => el.remove());
}

function applyFieldErrors(form, fieldErrors) {
  if (!form || !fieldErrors) return;
  let firstEl = null;
  Object.keys(fieldErrors).forEach((field) => {
    const msg = Array.isArray(fieldErrors[field]) ? fieldErrors[field].join(", ") : fieldErrors[field];
    const candidates = [field, field.charAt(0).toLowerCase() + field.slice(1), field.toLowerCase(), field + "Id", field.replace(/Id$/i, "")];
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
    if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'"))) {
      content = content.slice(1, -1);
    }
    let parsed = null;
    try { parsed = JSON.parse(content); } catch (e) { parsed = null; }
    if (parsed) {
      if (parsed.errors) { applyFieldErrors(form, parsed.errors); return true; }
      applyFieldErrors(form, parsed);
      return true;
    }
    return false;
  } catch (e) { return false; }
}

// --- Delete ---

async function deleteTask(id) {
  if (!utils.confirmAction("Are you sure you want to delete this task?")) return;
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

// --- Review Modal (unchanged logic) ---

async function openReviewModal(taskId) {
  let task = tasks.find((t) => (t.taskId || t.TaskId || t.Id) == taskId);
  try {
    utils.showLoading();
    const fullTask = await API.Tasks.getById(taskId);
    if (fullTask) task = fullTask;
    if (!task) return;

    currentEditId = taskId;
    document.getElementById("reviewTaskTitle").textContent = task.title || task.Title || "Untitled";
    document.getElementById("reviewDescription").textContent = task.description || task.Description || task.note || "No description";
    document.getElementById("reviewAssignee").textContent = task.assignedToName || task.AssignedToName || task.AssignedTo || "Unknown";
    document.getElementById("reviewCompletedDate").textContent = utils.formatDate(task.completedDate || task.CompletedDate || task.CompletedAt || new Date());

    const isSales = (task.DeptName && task.DeptName === "Sales") || (task.SalesActivityType !== undefined && task.SalesActivityType !== null);
    const uploadLinkGroup = document.getElementById("reviewUploadLinkGroup");
    const kpiGroup = document.getElementById("reviewSalesKpiGroup");
    const projectGroup = document.getElementById("reviewProjectGroup");
    const clientInfoGroup = document.getElementById("reviewClientInfoGroup");
    const locationGroup = document.getElementById("reviewLocationGroup");
    const activityTypeGroup = document.getElementById("reviewActivityTypeGroup");

    if (isSales) {
      if (uploadLinkGroup) uploadLinkGroup.style.display = "none";
      if (projectGroup) projectGroup.style.display = "none";
      if (clientInfoGroup) clientInfoGroup.style.display = "none";
      if (locationGroup) locationGroup.style.display = "none";
      if (activityTypeGroup) activityTypeGroup.style.display = "none";
      if (kpiGroup) {
        kpiGroup.style.display = "block";
        let kpiVal = 0;
        if (task.FinalKpiValue !== undefined && task.FinalKpiValue !== null) kpiVal = task.FinalKpiValue;
        else if (task.finalKpiValue !== undefined && task.finalKpiValue !== null) kpiVal = task.finalKpiValue;
        document.getElementById("reviewSalesKpi").textContent = kpiVal;
      }
    } else {
      if (kpiGroup) kpiGroup.style.display = "none";
      if (clientInfoGroup) clientInfoGroup.style.display = "none";
      if (locationGroup) locationGroup.style.display = "none";
      if (activityTypeGroup) activityTypeGroup.style.display = "none";
      if (projectGroup) projectGroup.style.display = "none";
      const uploadHref = task.driveFolderLink || task.DriveFolderLink || task.DriveUploadLink || task.driveUploadLink || null;
      if (uploadHref) {
        if (uploadLinkGroup) { uploadLinkGroup.style.display = "block"; document.getElementById("reviewUploadLink").href = utils.sanitizeUrl(uploadHref); }
      } else {
        if (uploadLinkGroup) uploadLinkGroup.style.display = "none";
      }
    }

    const employeeNotesGroup = document.getElementById("reviewEmployeeNotesGroup");
    if (employeeNotesGroup) employeeNotesGroup.style.display = "none";

    document.getElementById("reviewAction").value = "approve";
    document.getElementById("reviewNotes").value = "";
    document.getElementById("reviewNewDueDate").value = "";
    toggleReviewFields();
    document.getElementById("reviewAction").onchange = toggleReviewFields;
    document.getElementById("reviewModal").classList.remove("d-none");
  } catch (error) {
    console.error("Error loading review modal:", error);
    utils.showError("Failed to load task details for review");
  } finally {
    utils.hideLoading();
  }
}

function toggleReviewFields() {
  const action = document.getElementById("reviewAction").value;
  document.getElementById("reviewNotesGroup").style.display = action === "revise" ? "block" : "none";
  document.getElementById("reviewNewDueDateGroup").style.display = action === "revise" ? "block" : "none";
}

function closeReviewModal() {
  document.getElementById("reviewModal").classList.add("d-none");
  currentEditId = null;
}

async function submitReview() {
  if (!currentEditId) return;
  const action = document.getElementById("reviewAction").value;
  const notes = document.getElementById("reviewNotes").value;
  if (action === "revise" && !notes.trim()) { utils.showError("Please provide revision notes"); return; }
  try {
    utils.showLoading();
    const reviewData = {
      approve: action === "approve",
      notes: notes || null,
      newDueDate: document.getElementById("reviewNewDueDate").value || null
    };
    await API.Tasks.reviewCompletion(currentEditId, reviewData);
    closeReviewModal();
    utils.showSuccess(action === "approve" ? "Task approved successfully!" : "Revision request sent to employee.");
    await loadData();
  } catch (error) {
    console.error("Error submitting review:", error);
    utils.showError("Failed to submit review");
  } finally {
    utils.hideLoading();
  }
}
