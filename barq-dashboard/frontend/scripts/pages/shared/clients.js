// Shared Clients Page Script — used by both Manager and Assistant Manager
// The calling page must set window.CLIENTS_PAGE_ROLES before loading this script.
// e.g. window.CLIENTS_PAGE_ROLES = [USER_ROLES.MANAGER];
auth.requireRole(window.CLIENTS_PAGE_ROLES);

let allClients = [];
let clients = [];
let accountManagers = [];
let clientUsers = [];
let currentEditId = null;
let currentFilter = { column: "", value: "" };

// Filter event listeners - track to avoid duplicates
let filterListenersAttached = false;

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini (fmr. 'Swaziland')", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Holy See", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan",
  "Vanuatu", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
];

document.addEventListener("DOMContentLoaded", async () => {
  populateCountryDropdown();
  setupEventListeners();
  await loadData();
});

function populateCountryDropdown() {
  const countrySelect = document.getElementById("country");
  if (!countrySelect) return;
  countrySelect.innerHTML = '<option value="">Select Country</option>';
  COUNTRIES.forEach(country => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    countrySelect.appendChild(option);
  });
}

async function loadData() {
  try {
    utils.showLoading();

    // Fetch clients and users in parallel
    // Try role-filtered endpoint first, fall back to fetching all users
    const [clientsData, amUsers, clUsers] = await Promise.all([
      API.Clients.getAll().catch(() => []),
      API.Users.getByRole(USER_ROLES.ACCOUNT_MANAGER).catch(() => null),
      API.Users.getByRole(USER_ROLES.CLIENT).catch(() => null)
    ]);

    allClients = clientsData;
    clients = [...allClients];

    // If role-filtered endpoints failed, fall back to getAll and filter client-side
    if (amUsers === null || clUsers === null) {
      const allUsers = await API.Users.getAll().catch(() => []);
      accountManagers = amUsers ?? allUsers.filter(u => (u.RoleId ?? u.Role) === USER_ROLES.ACCOUNT_MANAGER);
      clientUsers = clUsers ?? allUsers.filter(u => (u.RoleId ?? u.Role) === USER_ROLES.CLIENT);
    } else {
      accountManagers = amUsers;
      clientUsers = clUsers;
    }

    populateAccountManagerDropdown();
    populateOwnerDropdown();
    populateFilterDropdowns();
    renderClients();
  } catch (error) {
    console.error("Error loading data:", error);
    utils.showError("Failed to load clients");
  } finally {
    utils.hideLoading();
  }
}

function populateFilterDropdowns() {
  const filterColumn = document.getElementById("filterColumn");
  const filterValue = document.getElementById("filterValue");

  // Only attach listeners once to prevent memory leak
  if (filterListenersAttached) return;
  filterListenersAttached = true;

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
    allClients.forEach(cli => {
      const val = cli[column];
      if (val !== undefined && val !== null && val !== "") {
        uniqueValues.add(val);
      }
    });

    const sortedValues = Array.from(uniqueValues).sort();
    let optionsHtml = '<option value="">All</option>';
    sortedValues.forEach(val => {
      optionsHtml += `<option value="${utils.escapeHtml(val)}">${utils.escapeHtml(val)}</option>`;
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
    clients = [...allClients];
  } else {
    clients = allClients.filter(cli => {
      const val = cli[currentFilter.column];
      return String(val ?? "") === String(currentFilter.value);
    });
  }
  renderClients();
}

function populateAccountManagerDropdown() {
  const accountManagerSelect = document.getElementById("accountManager");
  if (!accountManagerSelect) return;
  accountManagerSelect.innerHTML = '<option value="">Select Account Manager</option>';
  accountManagers.forEach((acc) => {
    const option = document.createElement("option");
    option.value = acc.UserId;
    option.textContent = acc.Name || "Unknown";
    accountManagerSelect.appendChild(option);
  });
}

function populateOwnerDropdown() {
  const ownerSelect = document.getElementById("existingOwner");
  if (!ownerSelect) return;
  ownerSelect.innerHTML = '<option value="">Select an existing client user...</option>';
  clientUsers.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.UserId;
    option.textContent = `${user.Name || "Unknown"} (${user.Username || ""})`;
    ownerSelect.appendChild(option);
  });
}

function renderClients() {
  const tbody = document.getElementById("clientsBody");

  if (clients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 40px;">
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
      <td>
        <div style="font-weight: 600; color: var(--text-main);">${utils.escapeHtml(client.Name || "Unknown")}</div>
        <div style="font-size: 0.8em; color: var(--text-secondary);">${utils.escapeHtml(client.Address || "")}</div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="user-avatar small" style="width: 24px; height: 24px; font-size: 10px;">
            ${utils.escapeHtml((client.OwnerName || "U").charAt(0))}
          </div>
          <span>${utils.escapeHtml(client.OwnerName || "N/A")}</span>
        </div>
      </td>
      <td>
        <div>${utils.escapeHtml(client.Email || "N/A")}</div>
        <div style="font-size: 0.8em; color: var(--text-secondary);">${utils.escapeHtml(client.PhoneNumber || "")}</div>
      </td>
      <td>
        ${client.Country ? utils.escapeHtml(client.Country) : '<span class="text-muted">-</span>'}
      </td>
      <td>
        ${client.AccountManagerName ? utils.escapeHtml(client.AccountManagerName) : '<span class="text-muted">-</span>'}
      </td>
      <td><span class="badge badge-info">${utils.escapeHtml(String(client.ProjectCount ?? 0))} projects</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-primary" onclick="editClient(${Number(client.ClientId)})" aria-label="Edit ${utils.escapeHtml(client.Name || "")}">
            <i class="fa-solid fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteClient(${Number(client.ClientId)})" aria-label="Delete ${utils.escapeHtml(client.Name || "")}">
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
  document.getElementById("clientForm").addEventListener("submit", handleSubmit);
  document.getElementById("searchInput").addEventListener("input", utils.debounce(handleSearch, 300));

  // Modal accessibility: close on Escape key and backdrop click
  const modal = document.getElementById("clientModal");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("d-none")) {
      closeModal();
    }
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

window.toggleOwnerFields = function () {
  const ownerType = document.querySelector('input[name="ownerType"]:checked').value;
  const existingOwnerGroup = document.getElementById("existingOwnerGroup");
  const newOwnerCredentials = document.getElementById("newOwnerCredentials");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const ownerNameInput = document.getElementById("ownerName");
  const existingOwnerSelect = document.getElementById("existingOwner");

  if (ownerType === "existing") {
    existingOwnerGroup.classList.remove("d-none");
    newOwnerCredentials.classList.add("d-none");
    usernameInput.required = false;
    passwordInput.required = false;
    if (ownerNameInput) ownerNameInput.required = false;
    existingOwnerSelect.required = true;
  } else {
    existingOwnerGroup.classList.add("d-none");
    newOwnerCredentials.classList.remove("d-none");
    usernameInput.required = true;
    passwordInput.required = true;
    if (ownerNameInput) ownerNameInput.required = true;
    existingOwnerSelect.required = false;
  }
};

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
  document.getElementById("accountManager").value = "";
  document.getElementById("country").value = "";

  const ownerTypeGroup = document.getElementById("ownerTypeGroup");
  if (ownerTypeGroup) ownerTypeGroup.style.display = "block";

  const newOwnerRadio = document.querySelector('input[name="ownerType"][value="new"]');
  if (newOwnerRadio) {
    newOwnerRadio.checked = true;
    toggleOwnerFields();
  }

  openModal();
}

function openModal() {
  const modal = document.getElementById("clientModal");
  modal.classList.remove("d-none");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  // Focus the first input in the modal
  const firstInput = modal.querySelector("input:not([type=hidden]):not([type=radio]), select");
  if (firstInput) firstInput.focus();
}

function closeModal() {
  const modal = document.getElementById("clientModal");
  modal.classList.add("d-none");
  document.getElementById("clientForm").reset();
  currentEditId = null;
}

async function editClient(id) {
  try {
    utils.showLoading();

    let client = null;
    try {
      client = await API.Clients.getById(id);
    } catch (err) {
      client = clients.find((c) => c.ClientId === id);
    }

    if (!client) {
      utils.showError("Client not found");
      return;
    }

    currentEditId = id;
    document.getElementById("modalTitle").textContent = "Edit Client";
    document.getElementById("clientId").value = id;

    document.getElementById("name").value = client.Name || "";
    document.getElementById("email").value = client.Email || "";
    document.getElementById("phoneNumber").value = client.PhoneNumber || "";
    document.getElementById("address").value = client.Address || "";
    document.getElementById("country").value = client.Country || "";

    if (document.getElementById("accountManager")) {
      document.getElementById("accountManager").value = client.AccountManagerId || "";
    }

    // Hide owner selection logic when editing
    const ownerTypeGroup = document.getElementById("ownerTypeGroup");
    const existingOwnerGroup = document.getElementById("existingOwnerGroup");
    const newOwnerCredentials = document.getElementById("newOwnerCredentials");

    if (ownerTypeGroup) ownerTypeGroup.style.display = "none";
    if (existingOwnerGroup) existingOwnerGroup.classList.add("d-none");
    if (newOwnerCredentials) newOwnerCredentials.classList.add("d-none");

    document.getElementById("username").required = false;
    document.getElementById("password").required = false;
    document.getElementById("existingOwner").required = false;
    const ownerNameInput = document.getElementById("ownerName");
    if (ownerNameInput) ownerNameInput.required = false;

    openModal();
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
    Name: document.getElementById("name").value.trim(),
    Email: document.getElementById("email").value.trim(),
    PhoneNumber: document.getElementById("phoneNumber").value.trim() || null,
    Address: document.getElementById("address").value.trim() || null,
    Country: document.getElementById("country").value || null,
    AccountManagerId: parseInt(document.getElementById("accountManager").value) || null,
  };

  // Client-side length validation matching backend DTO limits
  if (clientData.Name.length > 100) {
    utils.showError("Company name must be 100 characters or less");
    return;
  }
  if (clientData.Email.length > 100) {
    utils.showError("Email must be 100 characters or less");
    return;
  }
  if (clientData.PhoneNumber && clientData.PhoneNumber.length > 20) {
    utils.showError("Phone number must be 20 characters or less");
    return;
  }
  if (clientData.Address && clientData.Address.length > 200) {
    utils.showError("Address must be 200 characters or less");
    return;
  }

  if (!currentEditId) {
    const ownerType = document.querySelector('input[name="ownerType"]:checked').value;

    if (ownerType === "new") {
      clientData.Username = document.getElementById("username").value.trim();
      clientData.Password = document.getElementById("password").value;
      clientData.OwnerName = document.getElementById("ownerName").value.trim();

      if (!clientData.Username || !clientData.Password || !clientData.OwnerName) {
        utils.showError("Owner name, username, and password are required for new users");
        return;
      }
      if (clientData.Password.length < 6) {
        utils.showError("Password must be at least 6 characters");
        return;
      }
    } else {
      const ownerId = document.getElementById("existingOwner").value;
      if (!ownerId) {
        utils.showError("Please select an existing owner");
        return;
      }
      clientData.OwnerUserId = parseInt(ownerId);
    }
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
    let msg = "Failed to save client";
    if (error && error.message) {
      const parts = error.message.split(":");
      msg = parts.length > 1 ? parts.slice(1).join(":").trim() : error.message;
      msg = msg.replace(/^\s*["']|["']\s*$/g, "");
    }
    utils.showError(msg);
  } finally {
    utils.hideLoading();
  }
}

async function deleteClient(id) {
  if (!utils.confirmAction("Are you sure you want to delete this client? This will affect all associated projects."))
    return;

  try {
    utils.showLoading();
    await API.Clients.delete(id);
    utils.showSuccess("Client deleted successfully");
    await loadData();
  } catch (error) {
    console.error("Error deleting client:", error);
    let msg = "Failed to delete client";
    if (error && error.message) {
      msg = error.message;
    }
    utils.showError(msg);
  } finally {
    utils.hideLoading();
  }
}
