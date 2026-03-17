// Account Manager Clients Page Script
auth.requireRole([USER_ROLES.ACCOUNT_MANAGER]);

let clients = [];
let currentEditId = null;
let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = auth.getCurrentUser();
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();

    // Load all projects to filter by account manager
    const allProjects = await API.Projects.getAll().catch(() => []);

    // Filter projects where current user is account manager
    const myProjects = allProjects.filter((project) => {
      const accountManagerId =
        project.accountManagerId || project.AccountManagerId;
      return accountManagerId === currentUser.userId;
    });

    // Get unique client IDs from my projects
    const myClientIds = new Set(
      myProjects
        .filter((p) => p.clientId || p.ClientId)
        .map((p) => p.clientId || p.ClientId)
    );

    console.log(
      "[Clients] My projects:",
      myProjects.length,
      "Unique clients:",
      myClientIds.size
    );

    // Load all clients and filter to only my clients
    const allClients = await API.Clients.getAll().catch(() => []);
    clients = allClients
      .filter((c) => myClientIds.has(c.clientId || c.ClientId))
      .map((c) => {
        const clientId = c.clientId || c.ClientId;
        const projectCount = myProjects.filter(
          (p) => (p.clientId || p.ClientId) === clientId
        ).length;

        return {
          ClientId: clientId,
          ClientName: c.name || c.Name || c.clientName || c.ClientName,
          ProjectCount: projectCount,
          Email: c.email || c.Email || "",
          PhoneNumber: c.phoneNumber || c.PhoneNumber || "",
          Company: c.company || c.Company || "",
          Address: c.address || c.Address || "",
        };
      });

    renderClients();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load clients");
  } finally {
    utils.hideLoading();
  }
}

function renderClients() {
  const tbody = document.getElementById("clientsBody");

  if (clients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-users"></i>
            <h3>No clients found</h3>
            <p>Clients from projects you manage will appear here</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clients
    .map(
      (client) => `
    <tr>
      <td><strong>#${client.ClientId}</strong></td>
      <td><strong>${utils.escapeHtml(client.ClientName || "Unknown")}</strong></td>
      <td>${utils.escapeHtml(client.Email || "-")}</td>
      <td>${utils.escapeHtml(client.PhoneNumber || "-")}</td>
      <td>${utils.escapeHtml(client.Company || "-")}</td>
      <td><span class="badge badge-info">${
        client.ProjectCount || 0
      } projects</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-primary" onclick="viewClientDetails(${
            client.ClientId
          })" title="View Details">
            <i class="fa-solid fa-eye"></i> View Details
          </button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

function viewClientDetails(clientId) {
  window.location.href = `client-details.html?id=${clientId}`;
}

function setupEventListeners() {
  document
    .getElementById("searchInput")
    .addEventListener("input", handleSearch);
}

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll("#clientsBody tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
}
