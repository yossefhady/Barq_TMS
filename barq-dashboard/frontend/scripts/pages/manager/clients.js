// Manager Clients Page Script
auth.requireRole([USER_ROLES.MANAGER]);

let allClients = [];
let clients = [];
let accountManagers = [];
let clientUsers = []; // Users with Role 6 (Client)
let currentEditId = null;
let currentFilter = { column: "", value: "" };

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
  await loadData();
  setupEventListeners();
});

function populateCountryDropdown() {
  const countrySelect = document.getElementById("country");
  if (!countrySelect) return;

  // Keep the first option
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

    // Fetch clients (Companies) from API
    allClients = await API.Clients.getAll().catch(() => []);
    clients = [...allClients];

    // Fetch all users to separate AccountManagers and Client Owners
    const allUsers = await API.Users.getAll().catch(() => []);
    
    // Filter AccountManagers (Role 3)
    accountManagers = allUsers.filter((user) => (user.RoleId || user.Role) === USER_ROLES.ACCOUNT_MANAGER);
    
    // Filter Client Users (Role 6) - Potential Owners
    clientUsers = allUsers.filter((user) => (user.RoleId || user.Role) === 6);

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
            let val = cli[column] || cli[column.charAt(0).toLowerCase() + column.slice(1)];
            if (val !== undefined && val !== null && val !== "") {
                 uniqueValues.add(val);
            }
        });

        const sortedValues = Array.from(uniqueValues).sort();
        let optionsHtml = '<option value="">All</option>';
        sortedValues.forEach(val => {
             optionsHtml += `<option value="${val}">${val}</option>`;
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
            const column = currentFilter.column;
            let val = cli[column] || cli[column.charAt(0).toLowerCase() + column.slice(1)];
            return String(val) === String(currentFilter.value);
        });
    }
    renderClients();
}

function populateAccountManagerDropdown() {
  const accountManagerSelect = document.getElementById("accountManager");
  if (!accountManagerSelect) return;

  // Clear existing options except the first one
  accountManagerSelect.innerHTML =
    '<option value="">Select Account Manager</option>';

  // Add account manager options
  accountManagers.forEach((acc) => {
    const option = document.createElement("option");
    option.value = acc.UserId || acc.userId;
    option.textContent = acc.Name || acc.name || "Unknown";
    accountManagerSelect.appendChild(option);
  });
}

function populateOwnerDropdown() {
  const ownerSelect = document.getElementById("existingOwner");
  if (!ownerSelect) return;

  ownerSelect.innerHTML = '<option value="">Select an existing client user...</option>';

  clientUsers.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.UserId || user.userId;
    option.textContent = `${user.Name || user.name} (${user.Username || user.username})`;
    ownerSelect.appendChild(option);
  });
}

function renderClients() {
  const tbody = document.getElementById("clientsBody");

  if (clients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding: 40px;">
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
        <div style="font-weight: 600; color: var(--text-main);">${client.name || client.Name || "Unknown"}</div>
        <div style="font-size: 0.8em; color: var(--text-secondary);">${client.address || client.Address || ""}</div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="user-avatar small" style="width: 24px; height: 24px; font-size: 10px;">
            ${(client.ownerName || client.OwnerName || "U").charAt(0)}
          </div>
          <span>${client.ownerName || client.OwnerName || "N/A"}</span>
        </div>
      </td>
      <td>
        <div>${client.email || client.Email || "N/A"}</div>
        <div style="font-size: 0.8em; color: var(--text-secondary);">${client.phoneNumber || client.PhoneNumber || ""}</div>
      </td>
      <td>
        ${client.country || client.Country || '<span class="text-muted">-</span>'}
      </td>
      <td>
        ${client.accountManagerName || client.AccountManagerName || '<span class="text-muted">-</span>'}
      </td>
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

function setupEventListeners() {
  document
    .getElementById("clientForm")
    .addEventListener("submit", handleSubmit);
  document
    .getElementById("searchInput")
    .addEventListener("input", handleSearch);
}

// Exposed globally for the HTML onchange attribute
window.toggleOwnerFields = function() {
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
    
    // Update required attributes
    usernameInput.required = false;
    passwordInput.required = false;
    if (ownerNameInput) ownerNameInput.required = false;
    existingOwnerSelect.required = true;
  } else {
    existingOwnerGroup.classList.add("d-none");
    newOwnerCredentials.classList.remove("d-none");
    
    // Update required attributes
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
  
  // Show owner type selection
  const ownerTypeGroup = document.getElementById("ownerTypeGroup");
  if (ownerTypeGroup) ownerTypeGroup.style.display = "block";
  
  // Reset to "New User" by default
  const newOwnerRadio = document.querySelector('input[name="ownerType"][value="new"]');
  if (newOwnerRadio) {
    newOwnerRadio.checked = true;
    toggleOwnerFields();
  }
  
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

    // Fetch full client details from API
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

    // Populate fields
    document.getElementById("name").value = client.name || client.Name || "";
    document.getElementById("email").value = client.email || client.Email || "";
    document.getElementById("phoneNumber").value = client.phoneNumber || client.PhoneNumber || "";
    document.getElementById("address").value = client.address || client.Address || "";
    document.getElementById("country").value = client.country || client.Country || "";

    // Set accountManager
    if (document.getElementById("accountManager")) {
      const acctId = client.accountManagerId || client.AccountManagerId || "";
      document.getElementById("accountManager").value = acctId;
    }

    // Hide owner selection logic when editing (assuming we don't change owner here for now)
    const ownerTypeGroup = document.getElementById("ownerTypeGroup");
    const existingOwnerGroup = document.getElementById("existingOwnerGroup");
    const newOwnerCredentials = document.getElementById("newOwnerCredentials");
    
    if (ownerTypeGroup) ownerTypeGroup.style.display = "none";
    if (existingOwnerGroup) existingOwnerGroup.classList.add("d-none");
    if (newOwnerCredentials) newOwnerCredentials.classList.add("d-none");
    
    // Remove required attributes
    document.getElementById("username").required = false;
    document.getElementById("password").required = false;
    document.getElementById("existingOwner").required = false;
    if (document.getElementById("ownerName")) document.getElementById("ownerName").required = false;

    // Set accountManager
    if (document.getElementById("accountManager")) {
      const acctId = client.accountManagerId || client.AccountManagerId || client.AccountManager || null;
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
    Address: document.getElementById("address").value || null,
    Country: document.getElementById("country").value || null,
    AccountManagerId: parseInt(document.getElementById("accountManager").value) || null,
  };

  // Handle Owner Logic for Create
  if (!currentEditId) {
    const ownerType = document.querySelector('input[name="ownerType"]:checked').value;
    
    if (ownerType === "new") {
      clientData.Username = document.getElementById("username").value;
      clientData.Password = document.getElementById("password").value;
      clientData.OwnerName = document.getElementById("ownerName").value;
    } else {
      // Existing owner
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
