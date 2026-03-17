// Client Details Page Script
auth.requireRole([USER_ROLES.ACCOUNT_MANAGER]);

let clientId = null;
let clientData = null;
let clientProjects = [];
let clientTasks = [];
let currentDate = new Date();
let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = auth.getCurrentUser();

  // Get client ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  clientId = urlParams.get("id");

  if (!clientId) {
    showError("No client ID provided");
    return;
  }

  await loadClientDetails();
});

async function loadClientDetails() {
  try {
    showLoading();

    console.log("Loading client with ID:", clientId);

    // Load client details using the API endpoint
    const clientResponse = await API.Clients.getById(clientId);

    console.log("Client response:", clientResponse);

    if (!clientResponse) {
      console.error("No client data returned from API");
      showError();
      return;
    }

    // Normalize client data
    clientData = {
      ClientId:
        clientResponse.clientId || clientResponse.ClientId || clientResponse.id,
      ClientName:
        clientResponse.name ||
        clientResponse.Name ||
        clientResponse.clientName ||
        clientResponse.ClientName,
      Email: clientResponse.email || clientResponse.Email || "",
      PhoneNumber:
        clientResponse.phoneNumber || clientResponse.PhoneNumber || "",
      Company: clientResponse.company || clientResponse.Company || "",
      Address: clientResponse.address || clientResponse.Address || "",
      ProjectCount:
        clientResponse.projectCount || clientResponse.ProjectCount || 0,
    };

    console.log("Normalized client data:", clientData);

    // Load projects for this client using the API endpoint
    try {
      const allClientProjects = await API.Clients.getProjects(clientId);
      console.log("Client projects:", allClientProjects);

      // SECURITY: Filter to only projects where current user is account manager
      clientProjects = allClientProjects.filter((project) => {
        const accountManagerId =
          project.accountManagerId || project.AccountManagerId;
        return accountManagerId === currentUser.userId;
      });

      console.log(
        `[Client Details] Filtered ${allClientProjects.length} projects to ${clientProjects.length} managed by current user`
      );

      // If no authorized projects, deny access
      if (clientProjects.length === 0) {
        console.warn("[Client Details] User not authorized for this client");
        showError("You are not authorized to view this client's details.");
        return;
      }
    } catch (projectError) {
      console.warn("Error loading projects:", projectError);
      clientProjects = [];
    }

    // Load all tasks for client projects
    await loadClientTasks();

    renderClientDetails();
    renderProjects();
    renderCalendar();
    renderUpcomingTasks();
    hideLoading();
  } catch (error) {
    console.error("Error loading client details:", error);
    console.error("Error details:", error.message, error.stack);
    showError("Failed to load client details");
  }
}

async function loadClientTasks() {
  try {
    // Get all tasks from client projects
    const taskPromises = clientProjects.map((project) =>
      API.Tasks.getByProject(project.projectId || project.ProjectId).catch(
        () => []
      )
    );

    const tasksArrays = await Promise.all(taskPromises);
    clientTasks = tasksArrays.flat();

    console.log("Loaded client tasks:", clientTasks);
  } catch (error) {
    console.error("Error loading client tasks:", error);
    clientTasks = [];
  }
}

function renderClientDetails() {
  // Update page title and breadcrumb
  document.getElementById("clientName").textContent = clientData.ClientName;
  document.getElementById("clientNameBreadcrumb").textContent =
    clientData.ClientName;
  document.title = `${clientData.ClientName} - Client Details - Barq TMS`;

  // Fill in client information
  document.getElementById("clientId").textContent = `#${clientData.ClientId}`;
  document.getElementById("clientNameDetail").textContent =
    clientData.ClientName;
  document.getElementById("clientEmail").textContent =
    clientData.Email || "Not provided";
  document.getElementById("clientPhone").textContent =
    clientData.PhoneNumber || "Not provided";
  document.getElementById("clientCompany").textContent =
    clientData.Company || "Not provided";
  document.getElementById("clientAddress").textContent =
    clientData.Address || "Not provided";

  // Calculate statistics
  const totalTasks = clientProjects.reduce(
    (sum, p) => sum + (p.taskCount || 0),
    0
  );
  const completedTasks = clientProjects.reduce(
    (sum, p) => sum + (p.completedTaskCount || 0),
    0
  );
  const pendingTasks = totalTasks - completedTasks;

  document.getElementById("totalProjects").textContent = clientProjects.length;
  document.getElementById("totalTasks").textContent = totalTasks;
  document.getElementById("completedTasks").textContent = completedTasks;
  document.getElementById("pendingTasks").textContent = pendingTasks;
}

function renderProjects() {
  const tbody = document.getElementById("projectsBody");

  if (clientProjects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-folder-open"></i>
            <h3>No Projects</h3>
            <p>This client doesn't have any projects yet.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clientProjects
    .map((project) => {
      const startDate = project.startDate
        ? new Date(project.startDate).toLocaleDateString()
        : "-";
      const endDate = project.endDate
        ? new Date(project.endDate).toLocaleDateString()
        : "-";
      const statusClass = getStatusClass(project.status || "Active");
      const taskCount = project.taskCount || 0;
      const projectName = project.name || project.Name || "Untitled Project";

      return `
        <tr>
          <td><strong>${projectName}</strong></td>
          <td>${startDate}</td>
          <td>${endDate}</td>
          <td><span class="badge ${statusClass}">${
        project.status || "Active"
      }</span></td>
          <td><span class="badge badge-info">${taskCount} tasks</span></td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="viewProject(${
              project.projectId || project.ProjectId
            })">
              <i class="fa-solid fa-eye"></i> View
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Update header
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  document.getElementById(
    "currentMonthYear"
  ).textContent = `${monthNames[month]} ${year}`;

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Get previous month's last days
  const prevMonth = new Date(year, month, 0);
  const daysInPrevMonth = prevMonth.getDate();

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  // Day headers
  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayHeaders.forEach((day) => {
    const header = document.createElement("div");
    header.className = "calendar-day-header";
    header.textContent = day;
    grid.appendChild(header);
  });

  // Previous month days
  for (let i = 0; i < startingDayOfWeek; i++) {
    const day = daysInPrevMonth - startingDayOfWeek + i + 1;
    const dayCell = createDayCell(day, true);
    grid.appendChild(dayCell);
  }

  // Current month days
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = date.toDateString() === today.toDateString();
    const dayCell = createDayCell(day, false, isToday, date);
    grid.appendChild(dayCell);
  }

  // Next month days
  const totalDayCells = startingDayOfWeek + daysInMonth;
  const remainingCells = Math.ceil(totalDayCells / 7) * 7 - totalDayCells;
  for (let day = 1; day <= remainingCells; day++) {
    const dayCell = createDayCell(day, true);
    grid.appendChild(dayCell);
  }
}

function createDayCell(day, otherMonth = false, isToday = false, date = null) {
  const dayCell = document.createElement("div");
  dayCell.className = "calendar-day";
  if (otherMonth) dayCell.classList.add("other-month");
  if (isToday) dayCell.classList.add("today");

  const dayNumber = document.createElement("div");
  dayNumber.className = "calendar-day-number";
  dayNumber.textContent = day;
  dayCell.appendChild(dayNumber);

  const eventsContainer = document.createElement("div");
  eventsContainer.className = "calendar-day-events";

  // Add tasks for this day
  if (date && !otherMonth) {
    const dayTasks = clientTasks.filter((task) => {
      if (!task.dueDate && !task.DueDate) return false;
      const taskDate = new Date(task.dueDate || task.DueDate);
      return taskDate.toDateString() === date.toDateString();
    });

    dayTasks.forEach((task) => {
      const taskEl = document.createElement("div");
      taskEl.className = "calendar-event task";
      taskEl.textContent = task.title || task.Title || "Untitled Task";
      taskEl.title = task.title || task.Title || "Untitled Task";

      taskEl.onclick = (e) => {
        e.stopPropagation();
        viewTaskDetails(task);
      };

      eventsContainer.appendChild(taskEl);
    });
  }

  dayCell.appendChild(eventsContainer);
  return dayCell;
}

function renderUpcomingTasks() {
  const container = document.getElementById("upcomingTasks");

  // Get tasks in the next 30 days
  const today = new Date();
  const thirtyDaysFromNow = new Date(
    today.getTime() + 30 * 24 * 60 * 60 * 1000
  );

  const upcomingTasks = clientTasks
    .filter((task) => {
      if (!task.dueDate && !task.DueDate) return false;
      const dueDate = new Date(task.dueDate || task.DueDate);
      return dueDate >= today && dueDate <= thirtyDaysFromNow;
    })
    .sort((a, b) => {
      const dateA = new Date(a.dueDate || a.DueDate);
      const dateB = new Date(b.dueDate || b.DueDate);
      return dateA - dateB;
    })
    .slice(0, 10);

  if (upcomingTasks.length === 0) {
    container.innerHTML =
      '<p style="color: var(--text-secondary); text-align: center;">No upcoming tasks</p>';
    return;
  }

  container.innerHTML = upcomingTasks
    .map((task) => {
      const dueDate = new Date(task.dueDate || task.DueDate);
      const dateStr = dueDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const status = task.status || task.Status || "Pending";
      const priority = task.priority || task.Priority || "Medium";
      const taskName = task.title || task.Title || "Untitled Task";

      const statusClass = getStatusClass(status);
      const priorityClass = getPriorityClass(priority);

      return `
        <div class="upcoming-event-item" onclick="viewTaskDetails(${JSON.stringify(
          task
        ).replace(/"/g, "&quot;")})" style="cursor: pointer;">
          <div class="upcoming-event-date">${dateStr}</div>
          <div class="upcoming-event-details" style="flex: 1;">
            <div class="upcoming-event-title">${taskName}</div>
            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-1);">
              <span class="badge ${statusClass}">${status}</span>
              <span class="badge ${priorityClass}">${priority}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
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

function viewTaskDetails(task) {
  const taskId = task.taskId || task.TaskId || task.id;
  if (taskId) {
    // Open task details in a modal or navigate to task page
    window.open(`../manager/tasks.html?id=${taskId}`, "_blank");
  }
}

function getStatusClass(status) {
  const statusMap = {
    Active: "badge-success",
    Completed: "badge-info",
    "On Hold": "badge-warning",
    Cancelled: "badge-danger",
    Planning: "badge-secondary",
  };
  return statusMap[status] || "badge-secondary";
}

function viewProject(projectId) {
  window.location.href = `../account-manager/projects.html?id=${projectId}`;
}

async function previousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
}

async function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
}

function showLoading() {
  document.getElementById("loadingState").classList.remove("d-none");
  document.getElementById("clientDetailsContainer").classList.add("d-none");
  document.getElementById("errorState").classList.add("d-none");
}

function hideLoading() {
  document.getElementById("loadingState").classList.add("d-none");
  document.getElementById("clientDetailsContainer").classList.remove("d-none");
  document.getElementById("errorState").classList.add("d-none");
}

function showError() {
  document.getElementById("loadingState").classList.add("d-none");
  document.getElementById("clientDetailsContainer").classList.add("d-none");
  document.getElementById("errorState").classList.remove("d-none");
}

// Contract Modal Functions
let selectedFiles = [];

function showContractModal() {
  document.getElementById("contractModal").classList.remove("d-none");
  document.getElementById("contractForm").reset();
  selectedFiles = [];
  updateFileList();
  setupFileUpload();
}

function closeContractModal() {
  document.getElementById("contractModal").classList.add("d-none");
  selectedFiles = [];
  updateFileList();
}

function setupFileUpload() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("contractFiles");

  // Click to browse
  dropZone.onclick = () => fileInput.click();

  // File input change
  fileInput.onchange = (e) => {
    handleFiles(e.target.files);
  };

  // Drag and drop
  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--primary-color)";
    dropZone.style.background = "rgba(126, 45, 150, 0.1)";
  };

  dropZone.ondragleave = (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--border)";
    dropZone.style.background = "var(--surface-secondary)";
  };

  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--border)";
    dropZone.style.background = "var(--surface-secondary)";
    handleFiles(e.dataTransfer.files);
  };

  // Form submit
  document.getElementById("contractForm").onsubmit = handleContractSubmit;
}

function handleFiles(files) {
  const pdfFiles = Array.from(files).filter(
    (file) => file.type === "application/pdf"
  );

  if (pdfFiles.length !== files.length) {
    utils.showError("Only PDF files are allowed");
  }

  selectedFiles = [...selectedFiles, ...pdfFiles];
  updateFileList();
}

function updateFileList() {
  const fileList = document.getElementById("fileList");

  if (selectedFiles.length === 0) {
    fileList.innerHTML = "";
    return;
  }

  fileList.innerHTML = selectedFiles
    .map(
      (file, index) => `
    <div style="
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3);
      background: var(--surface-light);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
    ">
      <div style="display: flex; align-items: center; gap: var(--space-3);">
        <i class="fa-solid fa-file-pdf" style="color: #dc2626; font-size: 24px;"></i>
        <div>
          <div style="font-weight: 600; color: var(--text-main);">${
            file.name
          }</div>
          <div style="font-size: var(--text-sm); color: var(--text-secondary);">${formatFileSize(
            file.size
          )}</div>
        </div>
      </div>
      <button 
        type="button" 
        class="btn-icon" 
        onclick="removeFile(${index})"
        style="color: var(--danger);"
      >
        <i class="fa-solid fa-trash"></i>
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

async function handleContractSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("contractTitle").value;
  const description = document.getElementById("contractDescription").value;

  if (selectedFiles.length === 0) {
    utils.showError("Please select at least one PDF file");
    return;
  }

  try {
    utils.showLoading();

    // Create FormData for file upload
    const formData = new FormData();
    formData.append("Title", title);
    formData.append("Description", description);
    formData.append("ClientId", clientId);

    selectedFiles.forEach((file, index) => {
      formData.append(`Files`, file);
    });

    // Contract sending is not yet supported by the backend.
    utils.showWarning(
      "Contract sending is not yet available. This feature is coming soon."
    );
    closeContractModal();
  } catch (error) {
    console.error("Error sending contract:", error);
    utils.showError("Failed to send contract");
  } finally {
    utils.hideLoading();
  }
}
