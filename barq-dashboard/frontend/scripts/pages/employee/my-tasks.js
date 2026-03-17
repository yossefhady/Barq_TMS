// Employee My Tasks Script

// Protect page - require Employee role
auth.requireRole([USER_ROLES.EMPLOYEE]);

let myTasks = [];
let currentTaskId = null;

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await loadMyTasks();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  const statusFilter = document.getElementById("statusFilter");
  if(statusFilter) {
      statusFilter.addEventListener("change", filterTasks);
  }
}

// Load my tasks
async function loadMyTasks() {
  try {
    utils.showLoading();
    const allTasks = await API.Tasks.getAll();

    // Filter tasks assigned to current user (tolerate PascalCase/camelCase)
    const currentUser = auth.getCurrentUser();
    myTasks = allTasks.filter(
      (task) => (task.AssignedTo || task.assignedTo) == currentUser.UserId
    );

    renderTasks(myTasks);
  } catch (error) {
    console.error("Error loading my tasks:", error);
    utils.showError("Failed to load your tasks");
  } finally {
    utils.hideLoading();
  }
}

// Filter tasks
function filterTasks() {
  const statusFilter = document.getElementById("statusFilter").value;

  let filtered = myTasks;

  if (statusFilter) {
    filtered = filtered.filter((task) => task.StatusId == statusFilter);
  }

  renderTasks(filtered);
}

// Render tasks
function renderTasks(tasks) {
  const tbody = document.getElementById("myTasksBody");
  const currentUser = auth.getCurrentUser();
  
  // Robust check for Sales department
  const isSales = currentUser.Departments && currentUser.Departments.some(d => 
    (d.DeptName && d.DeptName.toLowerCase().includes("sales")) || 
    (d.Name && d.Name.toLowerCase().includes("sales"))
  );
  
  // Dynamically update table header
  const theadRow = document.querySelector(".table thead tr");
  if (theadRow && theadRow.children.length > 1) {
    if (isSales) {
      // Force update header for Sales
       if(theadRow.children[1]) theadRow.children[1].innerHTML = '<i class="fa-solid fa-user-tie"></i> Client Info';
    } else {
       if(theadRow.children[1]) theadRow.children[1].innerHTML = 'Project';
    }
  }

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No tasks assigned</h3>
            <p>You don't have any tasks assigned yet</p>
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
      <td><strong>${utils.escapeHtml(task.Title || "Untitled Task")}</strong></td>
      <td>${isSales ? utils.escapeHtml(task.SalesClientInfo || "-") : utils.escapeHtml(task.ProjectName || "N/A")}</td>
      <td>${utils.getStatusBadge(task.StatusId !== undefined ? task.StatusId : 1)}</td>
      <td>${utils.getPriorityBadge(task.PriorityId !== undefined ? task.PriorityId : 1)}</td>
      <td>${utils.formatDate(task.DueDate)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="viewTaskDetails(${task.TaskId || task.taskId})">
          <i class="fa-solid fa-eye"></i> View Details
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

// View task details
async function viewTaskDetails(taskId) {
  console.log("Opening task details for:", taskId);
  currentTaskId = taskId;
  const modal = document.getElementById("taskDetailsModal");
  modal.classList.remove("d-none");
  
  // Reset UI
  const contentDiv = document.getElementById("taskDetailsContent");
  contentDiv.innerHTML = `
      <div class="text-center p-3">
         <i class="fas fa-spinner fa-spin"></i> Loading...
      </div>
  `;

  try {
      // Find local task first (faster, and fallback if API fails)
      let task = myTasks.find((t) => (t.TaskId || t.taskId) == taskId);
      
      // Try fetch full details
      try {
          const apiTask = await API.Tasks.getById(taskId);
          if (apiTask) task = apiTask;
      } catch (e) {
          console.warn("Could not fetch full task details. Using list data.", e);
      }
      
      if(!task) throw new Error("Task not found");

      // Check Role
      const currentUser = auth.getCurrentUser();
      const isSales = currentUser.Departments && currentUser.Departments.some(d => 
        (d.DeptName && d.DeptName.toLowerCase().includes("sales")) || 
        (d.Name && d.Name.toLowerCase().includes("sales"))
      );

      // Build HTML parts
      let html = `
        <div class="details-grid" style="margin-bottom: var(--space-4);">
            <div class="detail-item">
              <label class="detail-label"><i class="fa-solid fa-heading"></i> Task Title</label>
              <div class="detail-value">${utils.escapeHtml(task.Title || task.title)}</div>
            </div>
            
            <div class="detail-item">
              <label class="detail-label"><i class="fa-solid fa-align-left"></i> Description</label>
              <div class="detail-value" style="white-space: pre-wrap;">${utils.escapeHtml(task.Description || task.description || "No description")}</div>
            </div>
            
            <div class="detail-item">
              <label class="detail-label"><i class="fa-solid fa-user"></i> Assigned To</label>
              <div class="detail-value">${utils.escapeHtml(task.AssignedToName || task.assignedToName || "Unassigned")}</div>
            </div>
            <div class="detail-item">
              <label class="detail-label"><i class="fa-solid fa-flag"></i> Priority</label>
              <div class="detail-value">${utils.getPriorityBadge(task.PriorityId !== undefined ? task.PriorityId : task.priorityId)}</div>
            </div>
            <div class="detail-item">
              <label class="detail-label"><i class="fa-solid fa-info-circle"></i> Status</label>
              <div class="detail-value">${utils.getStatusBadge(task.StatusId !== undefined ? task.StatusId : task.statusId)}</div>
            </div>
          ${!isSales ? `
          <div class="detail-item">
            <label class="detail-label"><i class="fa-solid fa-folder"></i> Project</label>
            <div class="detail-value">${utils.escapeHtml(task.ProjectName || task.projectName || "No Project")}</div>
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
            <div class="detail-value">${utils.escapeHtml(task.CreatedByName || task.createdByName || "Unknown")}</div>
          </div>
          <div class="detail-item">
            <label class="detail-label"><i class="fa-solid fa-calendar"></i> Due Date</label>
            <div class="detail-value">${utils.formatDate(task.DueDate || task.dueDate)}</div>
          </div>
        </div>
      `;

      // Unified Comments/History Section (Primary)
      html += `
      <div class="detail-item" style="margin-bottom: var(--space-4); display: block;">
            <label class="detail-label"><i class="fa-solid fa-comments"></i> Notes / History</label>
            
            <div id="integratedComments" class="detail-value" style="background: var(--surface-secondary); padding: 15px; border-radius: 8px; border: 1px solid var(--border); max-height: 300px; overflow-y: auto; display: none; margin-bottom: 10px;">
                <!-- Content injected via JS -->
            </div>
            
            <!-- Unified Input Area (Chat Style) -->
            <div class="d-flex align-items-center gap-2 mt-2">
               <input type="text" id="unifiedNoteInput" class="form-control" placeholder="Add a note..." style="border-radius: 20px; padding-left: 15px;">
               
               <!-- KPI Input (Hidden by default) -->
               <div id="inlineSalesKpi" style="display:none; width: 120px; margin-left: 5px; margin-right: 5px;">
                 <!-- Injected via JS -->
               </div>

               <button class="btn btn-primary" onclick="addTaskComment()" style="border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; padding: 0; min-width: 38px;">
                  <i class="fa-solid fa-paper-plane"></i>
               </button>
            </div>
      </div>
      `;
      
      // Links (Secondary, to match TL view order where Resources are below Notes if that is what "like" meant, OR keeping here if "above the link" meant Notes > Resources)
      // The user said: "make the notes above the like[link]".
      // So Resources Link should act as "Footer" or "Below".
      // Let's add it AFTER the comments section.
      
      const driveLink = task.DriveFolderLink || task.driveFolderLink;
      if (!isSales && driveLink) {
          html += `
          <div class="detail-item" style="margin-bottom: 20px; display: block; margin-top: 20px;">
            <label class="detail-label"><i class="fa-solid fa-link"></i> Resources</label>
            <div class="detail-value">
              <a href="${utils.sanitizeUrl(driveLink)}" target="_blank" class="btn btn-primary" style="text-decoration: none; width: 100%; display: block; text-align: center;">
                <i class="fa-brands fa-google-drive"></i> Open Task Folder
              </a>
            </div>
          </div>`;
      }

      contentDiv.innerHTML = html;

      // Footer Buttons Logic
      const status = task.StatusId !== undefined ? task.StatusId : task.statusId;
      const controlsContainer = document.querySelector(".modal-footer");
      
      controlsContainer.innerHTML = `
        <button class="btn btn-secondary" onclick="closeDetailsModal()">Close</button>
      `;
      
      if (status === 0) { // Pending
          controlsContainer.innerHTML += `
            <button class="btn btn-primary" onclick="startTask()"><i class="fa-solid fa-play"></i> Start Task</button>
          `;
      } else if (status === 1) { // In Progress
           controlsContainer.innerHTML += `
             <button class="btn btn-success" onclick="markTaskAsDone()"><i class="fa-solid fa-check"></i> Request Completion</button>
           `;
           
           // Handle Sales KPI Input visibility
           if (isSales && task.SalesActivityType) {
                const kpiContainer = document.getElementById("inlineSalesKpi");
                if(kpiContainer) {
                    kpiContainer.style.display = "block";
                    
                    let placeholder = "Value";
                    if(task.SalesActivityType == 1) placeholder = "Count";
                    if(task.SalesActivityType == 4) placeholder = "Deal Value";
                    
                    kpiContainer.innerHTML = `
                    <input type="number" id="salesKpiValue" class="form-control form-control-sm" placeholder="KPI Result (${placeholder}) *" style="border: 1px solid var(--primary-color);">
                    `;
                }
           }
      }

      // Load Comments
      await loadTaskCommentsUnified(taskId);
      
  } catch (error) {
      console.error(error);
      contentDiv.innerHTML = `<div class="alert alert-danger">Failed to load task details: ${utils.escapeHtml(error.message)}</div>`;
  }
}

// Load task comments into unified block
async function loadTaskCommentsUnified(taskId) {
     const container = document.getElementById("integratedComments");
     if(!container) return;
     
     try {
        const comments = await API.Tasks.getComments(taskId);
        
        if (!comments || comments.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        const sortedComments = comments.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
        
        container.innerHTML = sortedComments.map(c => `
             <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                 <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: var(--primary-color); font-weight: 600;">${utils.escapeHtml(c.UserName || 'User')}</span>
                    <small style="color: var(--text-secondary);">${utils.formatDate(c.CreatedAt)}</small>
                 </div>
                 <div style="color: var(--text-main); line-height: 1.4; white-space: pre-wrap;">${utils.escapeHtml(c.Comment)}</div>
             </div>
        `).join('');
        
     } catch (e) {
         console.error("Error loading comments", e);
         container.innerHTML = `<div class="text-danger">Failed to load history.</div>`;
     }
}

async function addTaskComment() {
    if (!currentTaskId) return;
    const input = document.getElementById("unifiedNoteInput");
    const val = input.value.trim();
    
    if(!val) {
        utils.showError("Please enter a note.");
        return;
    }
    
    try {
        utils.showLoading();
        await API.Tasks.addComment(currentTaskId, val);
        utils.showSuccess("Note added.");
        input.value = "";
        await loadTaskCommentsUnified(currentTaskId);
    } catch (e) {
        console.error(e);
        utils.showError("Failed to add note.");
    } finally {
        utils.hideLoading();
    }
}

async function markTaskAsDone() {
  const noteInput = document.getElementById("unifiedNoteInput");
  const note = noteInput ? noteInput.value.trim() : "";
  
  const kpiEl = document.getElementById("salesKpiValue");
  let kpiVal = null;
  const currentUser = auth.getCurrentUser();
  const isSales = currentUser.Departments && currentUser.Departments.some(d => 
    (d.DeptName && d.DeptName.toLowerCase().includes("sales")) || 
    (d.Name && d.Name.toLowerCase().includes("sales"))
  );
  
  if (isSales && kpiEl) {
      if (!kpiEl.value) {
          utils.showError("Please enter the KPI value.");
          kpiEl.focus();
          return;
      }
      kpiVal = parseFloat(kpiEl.value);
  } 
  
  try {
      if(!confirm("Are you sure you want to submit this task for review?" + (note ? "" : " (No note added)"))) return;
      
      utils.showLoading();
      await API.Tasks.requestComplete(currentTaskId, { Note: note, FinalKpiValue: kpiVal });
      utils.showSuccess("Submitted for Review successfully!");
      closeDetailsModal();
      await loadMyTasks();
  } catch(e) {
      console.error(e);
      const msg = e.response && e.response.data ? (typeof e.response.data === 'string' ? e.response.data : e.response.data.title || "Failed") : e.message;
      utils.showError("Submission Failed: " + msg);
  } finally {
      utils.hideLoading();
  }
}

function closeDetailsModal() {
  document.getElementById("taskDetailsModal").classList.add("d-none");
  currentTaskId = null;
}

async function startTask() {
  if (!currentTaskId) return;
  try {
    utils.showLoading();
    await API.Tasks.updateStatus(currentTaskId, { statusId: 1, notes: "Task started" });
    utils.showSuccess("Task Started!");
    await viewTaskDetails(currentTaskId);
    await loadMyTasks();
  } catch (error) {
    console.error(error);
    utils.showError("Failed to start task");
  } finally {
    utils.hideLoading();
  }
}

// Explicit export if needed (though browser uses globals)
window.viewTaskDetails = viewTaskDetails;
window.markTaskAsDone = markTaskAsDone;
window.startTask = startTask;
window.addTaskComment = addTaskComment;
window.closeDetailsModal = closeDetailsModal;
