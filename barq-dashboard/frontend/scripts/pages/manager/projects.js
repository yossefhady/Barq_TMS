// Manager Projects Page Script
auth.requireRole([USER_ROLES.MANAGER]);

let allProjects = []; // Store filtered data
let projects = [];
let clients = [];
let teamLeaders = [];
let departments = [];
let currentEditId = null;
let currentFilter = { column: "", value: "" };

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();

    // Load projects - clients are embedded in project data (ClientId, ClientName)
    allProjects = await API.Projects.getAll().catch(() => []);
    
    // Normalize status field if needed for filtering
    // and ensure consistency.
    projects = [...allProjects];

    // Load all clients so the dropdown shows every client, not only those
    // already referenced by existing projects.
    const allClients = await API.Clients.getAll().catch(() => []);
    clients = allClients.map((c) => ({
      ClientId: c.clientId || c.ClientId,
      ClientName: c.name || c.Name || c.clientName || c.ClientName,
    }));

    // Load all team leaders (users with RoleId = 4)
    const allUsers = await API.Users.getAll().catch(() => []);
    teamLeaders = allUsers
      .filter((u) => (u.roleId || u.RoleId) === 4)
      .map((u) => ({
        UserId: u.userId || u.UserId,
        UserName:
          u.name ||
          u.Name ||
          `${u.firstName || u.FirstName || ""} ${
            u.lastName || u.LastName || ""
          }`.trim(),
      }));

    // Load all departments
    departments = await API.Departments.getAll().catch(() => []);

    populateDropdowns();
    populateFilterDropdowns(); // Populate filter dropdowns
    renderProjects();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load projects");
  } finally {
    utils.hideLoading();
  }
}

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
        allProjects.forEach(proj => {
            // Mapping for StatusInt if that is used
            let val = proj[column] || proj[column.charAt(0).toLowerCase() + column.slice(1)];
            
            // Special handling if using StatusInt vs StatusId logic mismatch
            if (column === 'StatusInt') {
                 // Try StatusId or Status
                 val = proj.status || proj.Status || proj.StatusId || 0;
            }

            // Handle TeamLeaderName list
            if (column === 'TeamLeaderName') {
                 const names = proj.TeamLeaderNames || proj.teamLeaderNames;
                 if (names && names.length > 0) {
                     names.forEach(n => uniqueValues.add(n));
                     // We don't return here because we might want to also add the singular value if it differs or for fallback
                 }
            }

            if (val !== undefined && val !== null) {
                 uniqueValues.add(val);
            }
        });

        const sortedValues = Array.from(uniqueValues).sort();
        let optionsHtml = '<option value="">All</option>';
        
        sortedValues.forEach(val => {
            let label = val;
             if (column === 'StatusInt') {
                const statuses = {
                    0: "Planned",
                    1: "Active",
                    2: "Completed",
                    3: "On Hold",
                };
                label = statuses[val] || `Status ${val}`;
             } else if (column === 'StartDate' || column === 'EndDate') {
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
        projects = [...allProjects];
    } else {
        projects = allProjects.filter(proj => {
            const column = currentFilter.column;
             let val = proj[column] || proj[column.charAt(0).toLowerCase() + column.slice(1)];
             
            if (column === 'StatusInt') {
                 val = proj.status || proj.Status || proj.StatusId || 0;
            }

            if (column === 'TeamLeaderName') {
                 const names = proj.TeamLeaderNames || proj.teamLeaderNames;
                 if (names && names.length > 0) {
                     if (names.includes(currentFilter.value)) return true;
                 }
                 // Fallback to checking singular value below
            }

            // Date matching might be string-based strict
             return String(val) === String(currentFilter.value);
        });
    }
    renderProjects();
}

function populateDropdowns() {
  const clientSelect = document.getElementById("clientId");
  clientSelect.innerHTML =
    '<option value="">Select Client</option>' +
    clients
      .map((c) => `<option value="${c.ClientId}">${c.ClientName}</option>`)
      .join("");

  const teamLeaderSelect = document.getElementById("teamLeaderId");
  teamLeaderSelect.innerHTML = teamLeaders
      .map((tl) => `<option value="${tl.UserId}">${tl.UserName}</option>`)
      .join("");

  const departmentSelect = document.getElementById("departmentId");
  departmentSelect.innerHTML = departments
      .map((d) => `<option value="${d.DeptId}">${d.DeptName}</option>`)
      .join("");
}

function getStatusBadge(statusId) {
  const statuses = {
    0: { name: "Planned", class: "badge-secondary" },
    1: { name: "Active", class: "badge-success" },
    2: { name: "Completed", class: "badge-primary" },
    3: { name: "On Hold", class: "badge-warning" },
  };
  const status = statuses[statusId] || statuses[0];
  return `<span class="badge ${status.class}">${status.name}</span>`;
}

function renderProjects() {
  const tbody = document.getElementById("projectsBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No projects found</h3>
            <p>Create your first project to get started</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = projects
    .map(
      (project) => {
        const teamLeaderNames = project.TeamLeaderNames && project.TeamLeaderNames.length > 0 
          ? project.TeamLeaderNames.join(", ") 
          : (project.TeamLeaderName || "Not assigned");
        
        const departmentNames = project.Departments && project.Departments.length > 0
          ? project.Departments.map(d => d.DeptName).join(", ")
          : "None";

        return `
    <tr>
      <td><strong>${project.ProjectName || "Untitled"}</strong></td>
      <td>${utils.truncateText(
        project.Description || "No description",
        50
      )}</td>
      <td>${project.ClientName || "N/A"}</td>
      <td>${teamLeaderNames}</td>
      <td>${departmentNames}</td>
      <td><span class="badge badge-info">${
        project.TaskCount || 0
      } tasks</span></td>
      <td>${utils.formatDate(project.StartDate)}</td>
      <td>${utils.formatDate(project.EndDate)}</td>
      <td>${getStatusBadge(project.StatusId || project.Status || 0)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-primary" onclick="editProject(${
            project.ProjectId
          })">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteProject(${
            project.ProjectId
          })">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
      }
    )
    .join("");
}

function setupEventListeners() {
  document
    .getElementById("projectForm")
    .addEventListener("submit", handleSubmit);
  document
    .getElementById("searchInput")
    .addEventListener("input", handleSearch);
}

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll("#projectsBody tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
}

function showCreateModal() {
  currentEditId = null;
  document.getElementById("modalTitle").textContent = "Create Project";
  document.getElementById("projectForm").reset();
  document.getElementById("projectId").value = "";
  document.getElementById("statusGroup").style.display = "none";
  document.getElementById("projectModal").classList.remove("d-none");
}

function closeModal() {
  document.getElementById("projectModal").classList.add("d-none");
  document.getElementById("projectForm").reset();
  currentEditId = null;
}

async function editProject(id) {
  const project = projects.find((p) => p.ProjectId === id);
  if (!project) return;

  currentEditId = id;
  document.getElementById("modalTitle").textContent = "Edit Project";
  document.getElementById("projectId").value = id;
  document.getElementById("name").value = project.ProjectName || "";
  document.getElementById("description").value = project.Description || "";
  document.getElementById("clientId").value = project.ClientId || "";
  
  // Set Team Leaders
  const teamLeaderSelect = document.getElementById("teamLeaderId");
  Array.from(teamLeaderSelect.options).forEach(option => {
    option.selected = project.TeamLeaderIds && project.TeamLeaderIds.includes(parseInt(option.value));
  });
  // Fallback for single team leader if list is empty but single ID exists
  if ((!project.TeamLeaderIds || project.TeamLeaderIds.length === 0) && project.TeamLeaderId) {
     Array.from(teamLeaderSelect.options).forEach(option => {
        if (parseInt(option.value) === project.TeamLeaderId) option.selected = true;
     });
  }

  // Set Departments
  const departmentSelect = document.getElementById("departmentId");
  Array.from(departmentSelect.options).forEach(option => {
    option.selected = project.DepartmentIds && project.DepartmentIds.includes(parseInt(option.value));
  });

  if (project.StartDate) {
    const startDate = new Date(project.StartDate);
    document.getElementById("startDate").value = startDate
      .toISOString()
      .split("T")[0];
  }

  if (project.EndDate) {
    const endDate = new Date(project.EndDate);
    document.getElementById("endDate").value = endDate
      .toISOString()
      .split("T")[0];
  }

  // Set Status
  document.getElementById("statusGroup").style.display = "block";
  document.getElementById("status").value = project.StatusId || project.Status || 0;

  document.getElementById("projectModal").classList.remove("d-none");
}

async function handleSubmit(e) {
  e.preventDefault();

  // Get selected team leaders
  const teamLeaderSelect = document.getElementById("teamLeaderId");
  const selectedTeamLeaders = Array.from(teamLeaderSelect.selectedOptions).map(opt => parseInt(opt.value));

  // Get selected departments
  const departmentSelect = document.getElementById("departmentId");
  const selectedDepartments = Array.from(departmentSelect.selectedOptions).map(opt => parseInt(opt.value));

  const formData = {
    ProjectName: document.getElementById("name").value,
    Description: document.getElementById("description").value || null,
    ClientId: parseInt(document.getElementById("clientId").value),
    TeamLeaderIds: selectedTeamLeaders,
    DepartmentIds: selectedDepartments,
    StartDate: document.getElementById("startDate").value || null,
    EndDate: document.getElementById("endDate").value || null,
  };

  // Add status if editing
  if (currentEditId) {
    formData.Status = parseInt(document.getElementById("status").value);
  }

  // Legacy support for single TeamLeaderId
  if (selectedTeamLeaders.length > 0) {
    formData.TeamLeaderId = selectedTeamLeaders[0];
  }

  try {
    utils.showLoading();

    if (currentEditId) {
      await API.Projects.update(currentEditId, formData);
      utils.showSuccess("Project updated successfully");
    } else {
      await API.Projects.create(formData);
      utils.showSuccess("Project created successfully");
    }

    closeModal();
    await loadData();
  } catch (error) {
    console.error("Error saving project:", error);
    utils.showError("Failed to save project");
  } finally {
    utils.hideLoading();
  }
}

async function deleteProject(id) {
  if (!utils.confirmAction("Are you sure you want to delete this project?"))
    return;

  try {
    utils.showLoading();
    await API.Projects.delete(id);
    utils.showSuccess("Project deleted successfully");
    await loadData();
  } catch (error) {
    console.error("Error deleting project:", error);
    utils.showError("Failed to delete project");
  } finally {
    utils.hideLoading();
  }
}
