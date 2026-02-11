// Team Leader - Team Members (View Only)
auth.requireRole([USER_ROLES.TEAM_LEADER]);

let employees = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadEmployees();
  setupSearch();
});

async function loadEmployees() {
  try {
    utils.showLoading();
    const currentUser = auth.getCurrentUser();
    const users = await API.Users.getAll();

    // Filter to only employees (RoleId = 5) under this team leader
    employees = users.filter((u) => {
      const roleId = u.Role || u.RoleId;
      const teamLeaderId = u.TeamLeaderId || u.teamLeaderId;
      return roleId === 5 && teamLeaderId === currentUser.UserId;
    });

    renderEmployees();
  } catch (error) {
    console.error("Error loading employees:", error);
    utils.showError("Failed to load team members");
  } finally {
    utils.hideLoading();
  }
}

function renderEmployees() {
  const tbody = document.getElementById("employeesBody");
  if (!tbody) return;

  if (employees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No team members found</h3>
            <p>You don't have any employees under your supervision</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = employees
    .map(
      (emp) => `
    <tr>
      <td><strong>${emp.Name || "N/A"}</strong></td>
      <td>${emp.Email || "N/A"}</td>
      <td>${emp.Position || "N/A"}</td>
      <td>${getRoleName(emp.Role)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewEmployee(${
          emp.UserId
        })">
          <i class="fa-solid fa-eye"></i> View
        </button>
      </td>
    </tr>
  `
    )
    .join("");
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

function viewEmployee(userId) {
  const employee = employees.find((e) => e.UserId === userId);
  if (!employee) return;

  const detailsContainer = document.getElementById("employeeDetailsContent");
  
  const departmentsHtml = (employee.Departments && employee.Departments.length > 0) 
    ? employee.Departments.map(d => `<span class="badge badge-info" style="margin-right: 5px;">${d.DeptName || d.deptName}</span>`).join("")
    : "No Departments";

  detailsContainer.innerHTML = `
    <div class="details-grid" style="margin-bottom: var(--space-4);">
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user"></i> Name</label>
        <div class="detail-value">${employee.Name || "N/A"}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-id-badge"></i> Username</label>
        <div class="detail-value">${employee.Username || "N/A"}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-envelope"></i> Email</label>
        <div class="detail-value">${employee.Email || "N/A"}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-briefcase"></i> Position</label>
        <div class="detail-value">${employee.Position || "N/A"}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user-tag"></i> Role</label>
        <div class="detail-value">${getRoleName(employee.Role)}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user-tie"></i> Team Leader</label>
        <div class="detail-value">${employee.TeamLeaderName || "N/A"}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-toggle-on"></i> Status</label>
        <div class="detail-value">${(employee.IsActive !== undefined ? employee.IsActive : (employee.isActive !== undefined ? employee.isActive : true)) ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-building"></i> Departments</label>
        <div class="detail-value">${departmentsHtml}</div>
      </div>
    </div>
  `;

  // Show modal
  document.getElementById("employeeModal").classList.remove("d-none");
}

function closeModal() {
  document.getElementById("employeeModal").classList.add("d-none");
}

function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const rows = document.querySelectorAll("#employeesBody tr");
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? "" : "none";
      });
    });
  }
}
