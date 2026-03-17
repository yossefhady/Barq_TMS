// Manager Sales Targets Page Script (Optimized)
auth.requireRole([USER_ROLES.MANAGER, USER_ROLES.ASSISTANT_MANAGER]);

let currentTargets = []; // Store fetched data locally to avoid re-fetching on modal open

document.addEventListener("DOMContentLoaded", async () => {
  setupFilters();
  
  // Attach event listeners
  const monthFilter = document.getElementById("filterMonth");
  if(monthFilter) monthFilter.addEventListener("change", refreshData);
  
  const yearFilter = document.getElementById("filterYear");
  if(yearFilter) yearFilter.addEventListener("change", refreshData);
  
  // Search handler
  const searchInput = document.getElementById("searchInput");
  if(searchInput) searchInput.addEventListener("input", handleSearch);

  // Initial Load
  await loadData();
});

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  document.querySelectorAll("#targetsBody tr").forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? "" : "none";
  });
}

function setupFilters() {
    const now = new Date();
    const monthSelect = document.getElementById("filterMonth");
    const yearSelect = document.getElementById("filterYear");
    
    if (!monthSelect || !yearSelect) return;
    
    // Clear existing
    monthSelect.innerHTML = '';
    yearSelect.innerHTML = '';
    
    // Months
    for(let i=1; i<=12; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.text = new Date(0, i-1).toLocaleString('default', { month: 'long' });
        if(i === now.getMonth() + 1) opt.selected = true;
        monthSelect.appendChild(opt);
    }
    
    // Years
    const currentYear = now.getFullYear();
    for(let i=currentYear-1; i<=currentYear+1; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.text = i;
        if(i === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
}

async function refreshData() {
    await loadData();
}

async function loadData() {
    const month = parseInt(document.getElementById("filterMonth").value);
    const year = parseInt(document.getElementById("filterYear").value);
    const tbody = document.getElementById("targetsBody");
    
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="spinner"></div></td></tr>';
    
    try {
        utils.showLoading();
        
        // Use the optimized summary endpoint
        // This returns List<SalesTargetProgressDto> for All Sales TLs in one go
        currentTargets = await API.Sales.getSummary(month, year);
        
        if (!currentTargets || currentTargets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">
                        <div class="empty-state">
                            <i class="fa-solid fa-users-slash"></i>
                            <h3>No Sales Team Leaders Found</h3>
                            <p>Ensure you have Team Leaders assigned to the 'Sales' department.</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = currentTargets.map(target => renderRow(target, month, year)).join("");
        
    } catch (err) {
        console.error("Error loading targets", err);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Failed to load data: ${utils.escapeHtml(err.message)}</td></tr>`;
    } finally {
        utils.hideLoading();
    }
}

function renderRow(target, month, year) {
    const monthName = new Date(0, month-1).toLocaleString('default', { month: 'short' });
    // Support PascalCase (default) or camelCase just in case
    const name = target.TeamLeaderName || target.teamLeaderName || 'Unknown';
    
    // Check targets defensively
    const tClients = target.TargetClients || target.targetClients || 0;
    const tMeetings = target.TargetMeetings || target.targetMeetings || 0;
    const tData = target.TargetData || target.targetData || 0;
    
    // Determine if targets are set
    const hasTargets = (tClients > 0 || tMeetings > 0 || tData > 0);
    
    // Map values for renderMetricBlock calculation
    const aClients = target.ActualClients || target.actualClients || 0;
    const aMeetings = target.ActualMeetings || target.actualMeetings || 0;
    const aData = target.ActualData || target.actualData || 0;
    
    let progressHtml = '';
    if (!hasTargets) {
        progressHtml = '<span class="text-secondary font-italic">No targets set for this month</span>';
    } else {
        progressHtml = '<div class="row">';
        if (tClients > 0) 
            progressHtml += renderMetricBlock("Clients", aClients, tClients);
        if (tMeetings > 0) 
            progressHtml += renderMetricBlock("Meetings", aMeetings, tMeetings);
        if (tData > 0) 
            progressHtml += renderMetricBlock("Data/Calls", aData, tData);
        progressHtml += '</div>';
    }

    // Action Button Text
    const actionLabel = hasTargets ? 'Update Targets' : 'Set Targets';
    const actionIcon = hasTargets ? 'fa-pen' : 'fa-plus';
    // Use glowing border for existing targets to make it distinct
    const actionClass = hasTargets ? 'btn-glow' : 'btn-primary';

    // We pass ID because we can lookup the full object in currentTargets
    return `
        <tr>
            <td style="vertical-align: middle;">
                <div class="d-flex align-items-center">
                    <div class="font-weight-bold" style="font-size: 1.1em;">${utils.escapeHtml(name)}</div>
                </div>
            </td>
            <td style="vertical-align: middle;">
                <span class="badge badge-secondary">${monthName} ${year}</span>
            </td>
            <td>${progressHtml}</td>
            <td style="vertical-align: middle;">
                <button class="btn btn-sm ${actionClass}" 
                    onclick="openTargetModal(${target.TeamLeaderId})">
                    <i class="fa-solid ${actionIcon}"></i> ${actionLabel}
                </button>
            </td>
        </tr>
    `;
}

function renderMetricBlock(label, actual, target) {
    const t = target || 0;
    const a = actual || 0;
    const pct = t > 0 ? Math.min((a/t)*100, 100) : 0;
    
    // Use CSS variables for guaranteed colors
    let colorVal = 'var(--error)';
    if(pct >= 100) colorVal = 'var(--success)';
    else if(pct >= 50) colorVal = 'var(--warning)';
    
    return `
    <div class="col-md-4 mb-2">
        <div class="d-flex justify-content-between text-small mb-1">
            <strong>${label}</strong>
            <span>${a} / ${t}</span>
        </div>
        <div class="progress" style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px;">
            <div style="width:${pct}%; height:100%; border-radius:3px; background-color:${colorVal}"></div>
        </div>
    </div>
    `;
}

// --- Modal Functions ---

window.openTargetModal = function(tlId) {
    // Find the data from our local cache
    const targetData = currentTargets.find(t => t.TeamLeaderId === tlId);
    if (!targetData) {
        console.error("Target data not found for ID", tlId);
        return;
    }
    
    // Check local targets defensively for Modal pre-fill
    const tClients = targetData.TargetClients || targetData.targetClients || 0;
    const tMeetings = targetData.TargetMeetings || targetData.targetMeetings || 0;
    const tData = targetData.TargetData || targetData.targetData || 0;
    
    const month = parseInt(document.getElementById("filterMonth").value);
    const year = parseInt(document.getElementById("filterYear").value);
    const monthName = new Date(0, month-1).toLocaleString('default', { month: 'long' });

    // Set Title
    const title = document.getElementById("targetModalTitle");
    const name = targetData.TeamLeaderName || targetData.teamLeaderName || 'Unknown';
    if(title) title.innerHTML = `Set Targets for <span class="text-primary">${utils.escapeHtml(name)}</span>`;
    
    // Set Subtitle or Context info
    const info = document.getElementById("targetModalInfo");
    if(info) info.innerText = `For ${monthName} ${year}`;
    
    // Set hidden inputs
    document.getElementById("targetTeamLeaderId").value = tlId;
    document.getElementById("targetMonthInput").value = month;
    document.getElementById("targetYearInput").value = year;

    // Set Values (if 0, show empty string to be cleaner for input)
    document.getElementById("targetClients").value = tClients || '';
    document.getElementById("targetMeetings").value = tMeetings || '';
    document.getElementById("targetData").value = tData || '';
    
    // Show Modal
    const modal = document.getElementById("targetModal");
    if(modal) modal.classList.remove("d-none");
    
    // Focus first input
    setTimeout(() => document.getElementById("targetClients").focus(), 100);
}

window.closeTargetModal = function() {
    const modal = document.getElementById("targetModal");
    if(modal) modal.classList.add("d-none");
}

// Handle Form Submit
// Note: We attach this globally because the form exists in static HTML
// but we need to ensure we don't attach multiple listeners if this script re-runs.
// Best practice: Use onsubmit in HTML or a named function.
window.handleTargetSubmit = async function(event) {
    event.preventDefault();
    await saveTarget();
    return false;
}

async function saveTarget() {
    const dto = {
        TeamLeaderId: parseInt(document.getElementById("targetTeamLeaderId").value),
        TargetMonth: parseInt(document.getElementById("targetMonthInput").value),
        TargetYear: parseInt(document.getElementById("targetYearInput").value),
        TargetClients: parseInt(document.getElementById("targetClients").value) || 0,
        TargetMeetings: parseInt(document.getElementById("targetMeetings").value) || 0,
        TargetData: parseInt(document.getElementById("targetData").value) || 0
    };
    
    try {
        utils.showLoading();
        await API.Sales.assignTarget(dto);
        utils.showSuccess("Targets updated successfully!");
        closeTargetModal();
        await refreshData();
    } catch(err) {
        console.error(err);
        utils.showError("Failed to save targets.");
    } finally {
        utils.hideLoading();
    }
}