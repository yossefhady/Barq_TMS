// Assistant Manager Projects Page Script
auth.requireRole([USER_ROLES.ASSISTANT_MANAGER]);

let allProjects = [];
let projects = [];
let clients = [];
let teamLeaders = []; // Only TLs supervised by this assistant manager
let currentEditId = null;
let currentFilter = { column: "", value: "" };

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();
    const currentUser = auth.getCurrentUser();
    const myId = currentUser.UserId || currentUser.userId;

    allProjects = await API.Projects.getAll().catch(() => []);
    projects = [...allProjects];

    const allClients = await API.Clients.getAll().catch(() => []);
    clients = allClients.map((c) => ({
      ClientId: c.clientId || c.ClientId,
      ClientName: c.name || c.Name || c.clientName || c.ClientName,
    }));

    // Load all users to find supervised team leaders
    const allUsers = await API.Users.getAll().catch(() => []);

    // Build supervised list: direct reports of this assistant manager
    const directSubordinates = allUsers.filter(u => (u.TeamLeaderId || u.teamLeaderId) == myId);
    const directIds = directSubordinates.map(u => Number(u.UserId || u.userId || u.Id));

    // Team Leaders are role 4, filter to only those supervised by this assistant manager
    teamLeaders = allUsers
      .filter((u) => {
        const role = u.roleId || u.RoleId;
        const uid = Number(u.UserId || u.userId || u.Id);
        return role === 4 && (directIds.includes(uid) || uid == myId);
      })
      .map((u) => ({
        UserId: u.userId || u.UserId || u.Id,
        UserName:
          u.name ||
          u.Name ||
          `${u.firstName || u.FirstName || ""} ${u.lastName || u.LastName || ""}`.trim(),
      }));

    populateDropdowns();
    populateFilterDropdowns();
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
      let val = proj[column] || proj[column.charAt(0).toLowerCase() + column.slice(1)];

      if (column === 'StatusInt') {
        val = proj.status || proj.Status || proj.StatusId || 0;
      }

      if (column === 'TeamLeaderName') {
        const names = proj.TeamLeaderNames || proj.teamLeaderNames;
        if (names && names.length > 0) {
          names.forEach(n => uniqueValues.add(n));
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
        const statuses = { 0: "Planned", 1: "Active", 2: "Completed", 3: "On Hold" };
        label = statuses[val] || `Status ${val}`;
      } else if (column === 'StartDate' || column === 'EndDate') {
        label = utils.formatDate(val);
      }
      optionsHtml += `<option value="${utils.escapeHtml(val)}">${utils.escapeHtml(label)}</option>`;
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
      }

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
      .map((c) => `<option value="${c.ClientId}">${utils.escapeHtml(c.ClientName)}</option>`)
      .join("");

  const teamLeaderSelect = document.getElementById("teamLeaderId");
  teamLeaderSelect.innerHTML = teamLeaders
    .map((tl) => `<option value="${tl.UserId}">${utils.escapeHtml(tl.UserName)}</option>`)
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

        return `
    <tr>
      <td><strong>${utils.escapeHtml(project.ProjectName || "Untitled")}</strong></td>
      <td>${utils.escapeHtml(utils.truncateText(
        project.Description || "No description",
        50
      ))}</td>
      <td>${utils.escapeHtml(project.ClientName || "N/A")}</td>
      <td>${utils.escapeHtml(teamLeaderNames)}</td>
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
  if ((!project.TeamLeaderIds || project.TeamLeaderIds.length === 0) && project.TeamLeaderId) {
    Array.from(teamLeaderSelect.options).forEach(option => {
      if (parseInt(option.value) === project.TeamLeaderId) option.selected = true;
    });
  }

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

  const formData = {
    ProjectName: document.getElementById("name").value,
    Description: document.getElementById("description").value || null,
    ClientId: parseInt(document.getElementById("clientId").value),
    TeamLeaderIds: selectedTeamLeaders,
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

  // Date validation
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (formData.StartDate) {
    if (new Date(formData.StartDate) < today) {
      utils.showError("Start date cannot be in the past");
      return;
    }
  }
  if (formData.EndDate) {
    if (new Date(formData.EndDate) < today) {
      utils.showError("End date cannot be in the past");
      return;
    }
  }
  if (formData.StartDate && formData.EndDate) {
    if (new Date(formData.EndDate) < new Date(formData.StartDate)) {
      utils.showError("End date cannot be before the start date");
      return;
    }
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
