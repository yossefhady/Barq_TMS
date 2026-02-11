// Market Map Script (Clean List View)
auth.requireRole([USER_ROLES.TEAM_LEADER, USER_ROLES.MANAGER]);

document.addEventListener("DOMContentLoaded", async () => {
    const user = auth.getCurrentUser();
    if(user) {
        const nameEl = document.querySelector('.sidebar-user-name');
        if(nameEl) nameEl.textContent = user.Name || user.name || 'User';
    }
    await loadZones();
});

let allZones = [];
let currentFilter = 'all';

async function loadZones() {
    try {
        utils.showLoading();
        // Use API.Sales
        const zones = await API.Sales.getMarketSegments();
        allZones = zones || [];
        renderMap(allZones);
        updateCategoryOptions(allZones);
    } catch(e) {
        console.error(e);
        utils.showError("Failed to load map data");
    } finally {
        utils.hideLoading();
    }
}

function renderMap(zones) {
    const listOpen = document.getElementById("list-open");
    const listTargeted = document.getElementById("list-targeted");
    const listCompleted = document.getElementById("list-completed");
    
    if(!listOpen) return;

    listOpen.innerHTML = '';
    listTargeted.innerHTML = '';
    listCompleted.innerHTML = '';

    // Filter Logic
    let filtered = zones;
    if (currentFilter !== 'all') {
        filtered = zones.filter(z => (z.Category || z.category) === currentFilter);
    }

    let cOpen = 0, cTarget = 0, cComplete = 0;

    filtered.forEach(zone => {
        const id = zone.Id || zone.id;
        // DTO uses Place, fallback to ZoneName for legacy
        const name = zone.Place || zone.place || zone.ZoneName || zone.zoneName;
        const cat = zone.Category || zone.category;
        const rawStatus = (zone.Status || zone.status || 'Open').toLowerCase();

        let statusClass = 'card-open';
        let targetContainer = listOpen;
        
        // Checkboxes / Action Buttons will change based on state
        let actionsHtml = '';

        if(rawStatus === 'completed') {
            statusClass = 'card-completed';
            targetContainer = listCompleted;
            cComplete++;
            actionsHtml = `
                <button class="btn-mini" onclick="updateZoneStatus(${id}, 'Open')">Re-Open</button>
            `;
        } 
        else if(rawStatus === 'targeted') {
            statusClass = 'card-targeted';
            targetContainer = listTargeted;
            cTarget++;
            actionsHtml = `
                <button class="btn-mini" onclick="updateZoneStatus(${id}, 'Open')">Un-Target</button>
                <button class="btn-mini btn-complete" onclick="updateZoneStatus(${id}, 'Completed')"><i class="fa-solid fa-check"></i> Done</button>
            `;
        } 
        else {
            cOpen++;
            actionsHtml = `
                <button class="btn-mini btn-target" onclick="updateZoneStatus(${id}, 'Targeted')"><i class="fa-solid fa-crosshairs"></i> Target</button>
            `;
        }

        const card = document.createElement('div');
        card.className = `zone-card ${statusClass}`;
        card.innerHTML = `
            <div class="card-top">
                <span class="card-cat">${cat}</span>
                <i class="fa-solid fa-trash btn-delete" style="cursor:pointer;" onclick="deleteZone(${id})"></i>
            </div>
            <div class="card-title">${name}</div>
            <div class="card-actions">
                ${actionsHtml}
            </div>
        `;
        
        targetContainer.appendChild(card);
    });

    // Update Counts
    document.getElementById('count-open').textContent = cOpen;
    document.getElementById('count-targeted').textContent = cTarget;
    document.getElementById('count-completed').textContent = cComplete;
}

// Replaces toggleZoneStatus with generic update
async function updateZoneStatus(id, newStatus) {
    try {
        await API.Sales.updateMarketSegmentStatus(id, newStatus);
        
        const zone = allZones.find(z => (z.Id || z.id) == id);
        if(zone) zone.Status = newStatus;
        
        renderMap(allZones);
        
    } catch(e) {
        console.error(e);
        utils.showError("Update failed");
    }
}

function filterMap(category) {
    currentFilter = category;
    
    document.querySelectorAll('.btn-outline').forEach(btn => {
        if(btn.textContent.includes(category === 'all' ? 'All' : category)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderMap(allZones);
}

// -- Actions --

async function toggleZoneStatus(id, newStatusBool) {
    const newStatus = newStatusBool ? 'Completed' : 'Open';
    try {
        // Optimistic update
        const zone = allZones.find(z => (z.Id || z.id) == id);
        if (zone) zone.Status = newStatus;
        renderMap(allZones); // Re-render to see effect immediately

        await API.Sales.updateMarketSegmentStatus(id, newStatus);
        
        if(newStatusBool) utils.showSuccess(`Marked as Completed`);
    } catch (e) {
        console.error(e);
        utils.showError('Status update failed');
        await loadZones(); // Revert on failure
    }
}

async function deleteZone(id) {
    if(!confirm("Are you sure you want to delete this zone?")) return;
    try {
        utils.showLoading();
        await API.Sales.deleteMarketSegment(id);
        
        allZones = allZones.filter(z => (z.Id || z.id) != id);
        renderMap(allZones);
        utils.showSuccess("Zone deleted");
    } catch(e) {
        console.error(e);
        utils.showError("Failed to delete zone");
    } finally {
        utils.hideLoading();
    }
}

// -- Modal Logic --

function openAddZoneModal() {
    const modal = document.getElementById("addZoneModal");
    if(modal) modal.classList.remove("d-none");
}

function closeAddZoneModal() {
    const modal = document.getElementById("addZoneModal");
    if(modal) modal.classList.add("d-none");
    document.getElementById("zoneName").value = '';
}

async function saveZone() {
    const name = document.getElementById("zoneName").value;
    const cat = document.getElementById("zoneCategory").value || 'Other';
    
    if(!name) {
        alert("Please enter a zone name");
        return;
    }

    try {
        utils.showLoading();
        // Correct API call via api.js
        await API.Sales.addMarketSegment({ Place: name, Category: cat, Status: 'Open' });
        
        closeAddZoneModal();
        await loadZones(); 
        utils.showSuccess("Zone added successfully");
    } catch(e) {
        console.error(e);
        utils.showError("Failed to save zone");
    } finally {
        utils.hideLoading();
    }
}

function updateCategoryOptions(zones) {
    const defaultCategories = ['Retail', 'Corporate', 'Gov', 'Health', 'GYM', 'Other'];
    const usedCategories = zones.map(z => z.Category || z.category).filter(c => c);
    const unique = [...new Set([...defaultCategories, ...usedCategories])].sort();
    
    const datalist = document.getElementById('categoryList');
    if(!datalist) return;
    
    datalist.innerHTML = '';
    unique.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        datalist.appendChild(opt);
    });
}
