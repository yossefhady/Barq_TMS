// Assistant Manager Clients Page Script
auth.requireRole([USER_ROLES.ASSISTANT_MANAGER]);

let clients = [];
let accountManagers = [];
let currentEditId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    utils.showLoading();

    // Fetch clients from API
    clients = await API.Clients.getAll().catch(() => []);

    // Fetch accountManagers (role 3) from Users API
    const allUsers = await API.Users.getAll().catch(() => []);
    accountManagers = allUsers.filter((user) => (user.Role || user.RoleId) === USER_ROLES.ACCOUNT_MANAGER);

    renderClients();
    populateAccountManagerDropdown();
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
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No clients found</h3>
            <p>Add your first client to get started</p>
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
      <td><strong>${client.clientId || client.ClientId}</strong></td>
      <td>${client.name || client.Name || "Unknown"}</td>
      <td>${client.email || client.Email || "N/A"}</td>
      <td><span class="badge badge-info">${
        client.projectCount || client.ProjectCount || 0
      } projects</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-primary" onclick="editClient(${
            client.clientId || client.ClientId
          })">
            <i class="fa-solid fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteClient(${
            client.clientId || client.ClientId
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

function populateAccountManagerDropdown() {
  const accountManagerSelect = document.getElementById("accountManager");

  // Clear existing options except the first one
  accountManagerSelect.innerHTML = '<option value="">Select Account Manager</option>';

  // Add accountManager options
  accountManagers.forEach((acc) => {
    const option = document.createElement("option");
    option.value = acc.UserId || acc.Id;
    option.textContent = acc.Name || acc.Username || "Unknown";
    accountManagerSelect.appendChild(option);
  });
}

function setupEventListeners() {
  document
    .getElementById("clientForm")
    .addEventListener("submit", handleSubmit);
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

function showCreateModal() {
  currentEditId = null;
  document.getElementById("modalTitle").textContent = "Add New Client";
  document.getElementById("clientForm").reset();
  
  // Show username and password fields for new clients
  const usernameGroup = document.getElementById("usernameGroup");
  const passwordGroup = document.getElementById("passwordGroup");
  if (usernameGroup) usernameGroup.style.display = "block";
  if (passwordGroup) passwordGroup.style.display = "block";
  
  // Make username and password required for new clients
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  if (usernameInput) usernameInput.required = true;
  if (passwordInput) passwordInput.required = true;
  
  document.getElementById("clientModal").classList.remove("d-none");
}

function closeModal() {
  document.getElementById("clientModal").classList.add("d-none");
  document.getElementById("clientForm").reset();
  currentEditId = null;
}

async function editClient(id) {
  try {
    utils.showLoading();

    // Fetch full client details from API (list endpoint may not include optional fields)
    let client = null;
    try {
      client = await API.Clients.getById(id);
    } catch (err) {
      client = clients.find((c) => (c.clientId || c.ClientId) === id);
    }

    if (!client) {
      utils.showError("Client not found");
      return;
    }

    currentEditId = id;
    document.getElementById("modalTitle").textContent = "Edit Client";
    document.getElementById("clientId").value = id;
    document.getElementById("name").value = client.name || client.Name || "";
    document.getElementById("email").value = client.email || client.Email || "";
    document.getElementById("phoneNumber").value =
      client.phoneNumber || client.PhoneNumber || "";
    document.getElementById("company").value =
      client.company || client.Company || "";
    document.getElementById("address").value =
      client.address || client.Address || "";
    
    // Hide username and password fields when editing (can't change credentials)
    const usernameGroup = document.getElementById("usernameGroup");
    const passwordGroup = document.getElementById("passwordGroup");
    if (usernameGroup) usernameGroup.style.display = "none";
    if (passwordGroup) passwordGroup.style.display = "none";
    
    // Make username and password not required when editing
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    if (usernameInput) usernameInput.required = false;
    if (passwordInput) passwordInput.required = false;
    
    if (document.getElementById("accountManager")) {
      const acctId =
        client.accountManagerId ||
        client.AccountManagerId ||
        client.AccountManager ||
        null;
      document.getElementById("accountManager").value = acctId || "";
    }

    document.getElementById("clientModal").classList.remove("d-none");
  } catch (error) {
    console.error("Error opening edit modal:", error);
    utils.showError("Failed to load client details");
  } finally {
    utils.hideLoading();
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  const clientData = {
    Name: document.getElementById("name").value,
    Email: document.getElementById("email").value,
    PhoneNumber: document.getElementById("phoneNumber").value || null,
    Company: document.getElementById("company").value || null,
    Address: document.getElementById("address").value || null,
    AccountManagerId:
      parseInt(document.getElementById("accountManager").value) || null,
  };

  // Only include Username and Password when creating a new client
  if (!currentEditId) {
    clientData.Username = document.getElementById("username").value;
    clientData.Password = document.getElementById("password").value;
  }

  try {
    utils.showLoading();

    if (currentEditId) {
      await API.Clients.update(currentEditId, clientData);
      utils.showSuccess("Client updated successfully");
    } else {
      await API.Clients.create(clientData);
      utils.showSuccess("Client created successfully");
    }

    closeModal();
    await loadData();
  } catch (error) {
    console.error("Error saving client:", error);
    // Prefer showing the server-provided error message when available
    let msg = "Failed to save client";
    if (error && error.message) {
      const parts = error.message.split(":");
      if (parts.length > 1) {
        msg = parts.slice(1).join(":").trim();
      } else {
        msg = error.message;
      }
      msg = msg.replace(/^\s*["']|["']\s*$/g, "");
    }
    utils.showError(msg);
  } finally {
    utils.hideLoading();
  }
}

async function deleteClient(id) {
  if (
    !confirm(
      "Are you sure you want to delete this client? This will affect all associated projects."
    )
  ) {
    return;
  }

  try {
    utils.showLoading();
    await API.Clients.delete(id);
    utils.showSuccess("Client deleted successfully");
    await loadData();
  } catch (error) {
    console.error("Error deleting client:", error);
    utils.showError("Failed to delete client");
  } finally {
    utils.hideLoading();
  }
}
