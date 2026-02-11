// Assistant Manager Projects Page Script
auth.requireRole([USER_ROLES.ASSISTANT_MANAGER]);

let projects = [];
let clients = [];
let currentEditId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();

    projects = await API.Projects.getAll().catch(() => []);

    // Load all clients so the project creation dropdown contains every client
    // instead of only clients referenced by existing projects.
    const allClients = await API.Clients.getAll().catch(() => []);
    clients = allClients.map((c) => ({
      Id: c.clientId || c.ClientId,
      Name: c.name || c.Name || c.clientName || c.ClientName,
    }));

    populateDropdowns();
    renderProjects();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load projects");
  } finally {
    utils.hideLoading();
  }
}

function populateDropdowns() {
  const clientSelect = document.getElementById("clientId");
  clientSelect.innerHTML =
    '<option value="">Select Client</option>' +
    clients.map((c) => `<option value="${c.Id}">${c.Name}</option>`).join("");
}

function renderProjects() {
  const tbody = document.getElementById("projectsBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center" style="padding: 40px;">
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
      (project) => `
    <tr>
      <td><strong>${project.ProjectName || "Untitled"}</strong></td>
      <td>${utils.truncateText(
        project.Description || "No description",
        50
      )}</td>
      <td>${project.ClientName || "N/A"}</td>
      <td><span class="badge badge-info">${
        project.TaskCount || 0
      } tasks</span></td>
      <td>${
        project.StartDate ? utils.formatDate(project.StartDate) : "N/A"
      }</td>
      <td>${project.EndDate ? utils.formatDate(project.EndDate) : "N/A"}</td>
      <td>${
        project.StartDate
          ? '<span class="badge badge-success">Active</span>'
          : '<span class="badge badge-secondary">Pending</span>'
      }</td>
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
  `
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
  // Budget and Status fields removed as they don't exist in API

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

  document.getElementById("projectModal").classList.remove("d-none");
}

async function handleSubmit(e) {
  e.preventDefault();

  const formData = {
    ProjectName: document.getElementById("name").value,
    Description: document.getElementById("description").value || null,
    ClientId: parseInt(document.getElementById("clientId").value),
    StartDate: document.getElementById("startDate").value || null,
    EndDate: document.getElementById("endDate").value || null,
  };

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
