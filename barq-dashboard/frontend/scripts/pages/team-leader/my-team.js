// Team Leader My Team Page Script
auth.requireRole([USER_ROLES.TEAM_LEADER]);

let myTeam = [];
let currentEditId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();
    const allUsers = await API.Users.getAll().catch(() => []);
    const currentUser = auth.getCurrentUser();
    myTeam = allUsers.filter(u => u.ManagerId === currentUser.UserId);
    renderMyTeam();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load team");
  } finally {
    utils.hideLoading();
  }
}

function getRoleName(roleId) {
  const roles = {
    1: "Manager",
    2: "Assistant Manager",
    3: "Account Manager",
    4: "Team Leader",
    5: "Employee",
    6: "Client",
  };
  return roles[roleId] || "Unknown";
}

function renderMyTeam() {
  const tbody = document.getElementById("myTeamBody");

  if (myTeam.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No direct reports found</h3>
            <p>Assign employees to yourself as manager to see them here.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = myTeam
    .map(
      (emp) => `
    <tr>
      <td><strong>${emp.Name || "Unknown"}</strong></td>
      <td>${emp.Username || "N/A"}</td>
      <td>${emp.Email || "N/A"}</td>
      <td><span class="badge badge-info">${emp.Role || "N/A"}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-primary" onclick="editEmployee(${
            emp.UserId
          })">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${
            emp.UserId
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
    .getElementById("employeeForm")
    .addEventListener("submit", handleSubmit);
  document
    .getElementById("searchInput")
    .addEventListener("input", handleSearch);
}

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll("#myTeamBody tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
}

function showCreateModal() {
  currentEditId = null;
  document.getElementById("modalTitle").textContent = "Add Employee";
  document.getElementById("employeeForm").reset();
  document.getElementById("employeeId").value = "";
  document.getElementById("employeeModal").classList.remove("d-none");
}

function closeModal() {
  document.getElementById("employeeModal").classList.add("d-none");
  document.getElementById("employeeForm").reset();
  currentEditId = null;
}

async function editEmployee(id) {
  const employee = myTeam.find((e) => e.UserId === id);
  if (!employee) return;

  currentEditId = id;
  document.getElementById("modalTitle").textContent = "Edit Employee";
  document.getElementById("employeeId").value = id;
  document.getElementById("name").value = employee.Name || "";
  document.getElementById("email").value = employee.Email || "";
  document.getElementById("username").value = employee.Username || "";
  // `my-team.js` removed — functionality consolidated into `team-members.js`.
  // Keeping an empty placeholder file to avoid missing-script errors in older pages.
  document.getElementById("role").value = employee.Role || employee.RoleId || 5;
