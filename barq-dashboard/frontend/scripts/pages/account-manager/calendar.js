// Account Manager Calendar Page Script
auth.requireRole([USER_ROLES.ACCOUNT_MANAGER]);

// State
let currentDate = new Date();
let events = [];
let tasks = [];
let currentUser = null;
let currentEditId = null;

// Constants
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Event Types mapping
const EVENT_TYPES = {
  meeting: { id: 1, label: "Meeting", class: "meeting" },
  deadline: { id: 2, label: "Deadline", class: "deadline" },
  task: { id: 3, label: "Task", class: "task" },
  reminder: { id: 4, label: "Reminder", class: "reminder" },
  teamTask: { id: 5, label: "Team Task", class: "team-task" }, // Custom type for display
};

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
  currentUser = auth.getCurrentUser();
  setupEventListeners();
  await loadCalendarData();
});

function setupEventListeners() {
  // Modal form submit
  document
    .getElementById("eventForm")
    .addEventListener("submit", handleEventSubmit);
}

// Load Data
async function loadCalendarData() {
  try {
    utils.showLoading();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const startRange = new Date(year, month - 2, 1);
    const endRange = new Date(year, month + 2, 0);

    const [eventsResponse, tasksResponse] = await Promise.all([
      API.Calendar.getEvents({
        StartDate: startRange.toISOString(), 
        EndDate: endRange.toISOString(), 
      }).catch((err) => {
        console.error("Error fetching events:", err);
        return { Events: [] };
      }),
      API.Tasks.getAll().catch((err) => {
        console.error("Error fetching tasks:", err);
        return [];
      })
    ]);

    currentUser = auth.getCurrentUser();
    const currentUserId = currentUser?.UserId || currentUser?.userId;

    events = eventsResponse.Events || eventsResponse.events || [];

    // My Tasks only
    tasks = tasksResponse.filter((t) => t.AssignedTo == currentUserId);

    renderCalendar();
    renderUpcomingEvents();
  } catch (error) {
    console.error("Error loading calendar data:", error);
    utils.showError("Failed to load calendar data");
  } finally {
    utils.hideLoading();
  }
}

// Render Calendar
function renderCalendar() {
  console.log("Rendering Calendar. Total Events:", events.length, "Total Tasks:", tasks.length);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Update Header
  document.getElementById("currentMonthYear").textContent = `${
    MONTH_NAMES[month]
  } ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = firstDay.getDay(); // 0 = Sunday
  const totalDays = lastDay.getDate();

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  // Add Day Headers
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  days.forEach((day) => {
    const header = document.createElement("div");
    header.className = "calendar-day-header";
    header.textContent = day;
    grid.appendChild(header);
  });

  // Previous Month Days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingDay - 1; i >= 0; i--) {
    const dayDiv = createDayElement(prevMonthLastDay - i, true);
    grid.appendChild(dayDiv);
  }

  // Current Month Days
  for (let i = 1; i <= totalDays; i++) {
    const dayDiv = createDayElement(i, false);
    grid.appendChild(dayDiv);
  }

  // Next Month Days
  const remainingCells = 42 - (startingDay + totalDays);
  for (let i = 1; i <= remainingCells; i++) {
    const dayDiv = createDayElement(i, true);
    grid.appendChild(dayDiv);
  }
}

function isSameDate(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function createDayElement(day, isOtherMonth) {
  const div = document.createElement("div");
  div.className = `calendar-day ${isOtherMonth ? "other-month" : ""}`;

  // Calculate the specific date for this cell
  // Handle month/year rollover via Date constructor
  const currentMonth = isOtherMonth
    ? day > 15
      ? currentDate.getMonth() - 1 // Previous month
      : currentDate.getMonth() + 1 // Next month
    : currentDate.getMonth();

  const baseYear = currentDate.getFullYear();
  const cellDate = new Date(baseYear, currentMonth, day);

  // DEBUG: Specific check for Jan 15 to see why it fails
  if (day === 15 && !isOtherMonth) {
      console.log(`Checking Cell: ${cellDate.toString()}`);
      console.log(`Comparison Target - Year: ${cellDate.getFullYear()}, Month: ${cellDate.getMonth()}, Date: ${cellDate.getDate()}`);
      
      // Check first few tasks
      tasks.forEach((t, idx) => {
         if (idx < 3) {
             const d = new Date(t.DueDate || t.dueDate);
             const match = isSameDate(d, cellDate);
             console.log(`Task ${t.Title}: Due ${d.toString()} -> Match? ${match}`);
         }
      });
  }

  // Check if today
  const today = new Date();
  if (isSameDate(cellDate, today)) {
    div.classList.add("today");
  }

  // Day Number
  const number = document.createElement("div");
  number.className = "calendar-day-number";
  number.textContent = day;
  div.appendChild(number);

  // Create date object for this cell
  // We already calculated cellDate above using baseYear, currentMonth, day

  // Events Container
  const eventsContainer = document.createElement("div");
  eventsContainer.className = "calendar-day-events";

  // Add Calendar Events
  const dayEvents = events.filter((e) => {
    // Correct property is StartTime (from C# DTO), not StartDate
    const sTime = e.StartTime || e.startTime || e.StartDate || e.startDate;
    const eDate = new Date(sTime);

    // Filter out auto-generated "Task Due:" events to avoid duplication with actual Tasks
    if (e.Title && (e.Title.startsWith("Task Due:") || e.Title.startsWith("Task Due :"))) {
        return false;
    }

    return isSameDate(eDate, cellDate);
  });

  // Add Tasks (Deadlines)
  const dayTasks = tasks.filter((t) => {
    // DueDate is required
    const dVal = t.DueDate || t.dueDate; 
    if (!dVal) return false;
    const tDate = new Date(dVal);
    return isSameDate(tDate, cellDate);
  });

  // Render Events
  dayEvents.forEach((e) => {
    const el = document.createElement("div");
    // Map TypeId to class
    let typeClass = "meeting";
    if (e.EventType === 2) typeClass = "deadline";
    if (e.EventType === 3) typeClass = "task";
    if (e.EventType === 4) typeClass = "reminder";
    if (e.EventType === 5) typeClass = "team-task";

    el.className = `calendar-event ${typeClass}`;
    el.textContent = e.Title;
    el.onclick = (evt) => {
      evt.stopPropagation();
      openEventDetails(e);
    };
    eventsContainer.appendChild(el);
  });

  // Render Tasks
  dayTasks.forEach((t) => {
    const el = document.createElement("div");
    // Use 'team-task' class if it's a team task, otherwise 'task'
    let typeClass = t.isTeamTask ? "team-task" : "task";
    
    // Check for Sales Meetings (treated as meetings visually)
    // Safe access to departments
    const userDepts = currentUser?.Departments || currentUser?.departments || [];
    const isSales = Array.isArray(userDepts) && userDepts.some(d => (d.DeptName || d.Name || '').toLowerCase() === "sales");
    
    // Task Activity 1 = Meeting
    const saleActivity = t.SalesActivityType || t.salesActivityType;
    if (isSales && saleActivity == 1) {
        typeClass = "meeting";
    }

    el.className = `calendar-event ${typeClass}`;
    el.textContent = t.Title;
    el.title = `Task: ${t.Title} (Due Today)`;
    
    // Add Click Handler
    el.onclick = (evt) => {
        evt.stopPropagation();
        openTaskDetails(t);
    };

    eventsContainer.appendChild(el);
  });

  div.appendChild(eventsContainer);

  // Click to add event (only on current month days)
  if (!isOtherMonth) {
    div.onclick = () => {
      const selectedDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      );
      // Adjust for timezone offset to ensure the date input gets the correct YYYY-MM-DD
      const offset = selectedDate.getTimezoneOffset();
      const adjustedDate = new Date(selectedDate.getTime() - (offset*60*1000));
      
      openEventModal(null, adjustedDate.toISOString().split("T")[0]);
    };
  }

  return div;
}

// Render Upcoming Events (Sidebar)
function renderUpcomingEvents() {
  const container = document.getElementById("upcomingEvents");
  container.innerHTML = "";

  // Combine and sort all items by date
  const allItems = [
    ...events
      .filter(e => !(e.Title && (e.Title.startsWith("Task Due:") || e.Title.startsWith("Task Due :"))))
      .map((e) => ({
      ...e,
      date: new Date(e.StartTime || e.startTime || e.StartDate || e.startDate),
      type: "event",
    })),
    ...tasks.map((t) => ({
      ...t,
      date: new Date(t.DueDate || t.dueDate),
      type: "task",
    })),
  ];

  // Filter for future items only
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const futureItems = allItems
    .filter((item) => item.date >= now)
    .sort((a, b) => a.date - b.date)
    .slice(0, 5); // Show top 5

  if (futureItems.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center">No upcoming events</p>';
    return;
  }

  futureItems.forEach((item) => {
    const div = document.createElement("div");
    
    let typeClass = "meeting";
    if (item.type === "event") {
        if (item.EventType === 2) typeClass = "deadline";
        if (item.EventType === 3) typeClass = "task";
        if (item.EventType === 4) typeClass = "reminder";
        if (item.EventType === 5) typeClass = "team-task";
    } else {
        // Standard task coloring logic
        // If it's explicitly marked as a team task, use purple.
        // Otherwise (it's my task), use task (green).
        typeClass = item.isTeamTask ? "team-task" : "task";
        
        // Sales override logic for "Tasks" in the upcoming list too?
        // Safe access to departments
        const userDepts = currentUser?.Departments || currentUser?.departments || [];
        const isSales = Array.isArray(userDepts) && userDepts.some(d => (d.DeptName || d.Name || '').toLowerCase() === "sales");
        
        const saleActivity = item.SalesActivityType || item.salesActivityType;
        if (isSales && (saleActivity == 1)) {
            typeClass = "meeting";
        }
    }

    div.className = `upcoming-event-item ${typeClass}`;
    
    // Format date: "Nov 24"
    const dateStr = item.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
    });

    div.innerHTML = `
      <div class="upcoming-event-date">${dateStr}</div>
      <div class="upcoming-event-details">
        <div class="upcoming-event-title">${item.Title}</div>
        <div class="upcoming-event-time">${
          item.type === "event" ? "Event" : "Task Due"
        }</div>
      </div>
    `;
    
    if (item.type === "event") {
        div.onclick = () => openEventDetails(item);
    } else {
        // Make tasks clickable in sidebar too
        div.onclick = () => openTaskDetails(item);
    }
    
    container.appendChild(div);
  });
}

// Open Task Details Modal (Full View)
async function openTaskDetails(taskItem) {
    try {
        utils.showLoading();
        // Fetch fresh details
        const taskId = taskItem.TaskId || taskItem.taskId;
        const task = await API.Tasks.getById(taskId);
        
        if (!task) {
          utils.showError("Task not found");
          return;
        }

        renderTaskDetails(task);

        // Inject actions dynamically
        const footerActions = document.getElementById("taskDetailsActions");
        if (footerActions) {
           footerActions.innerHTML = "";
           
           // Allow delete if self task (created by me or assigned to me initially?) 
            // Matching my-tasks.js logic:
           const isSelf = (task.OriginalAssignerId === currentUser.UserId || task.CreatedBy === currentUser.UserId);
           
           if (isSelf) {
              // Edit button omitted as taskModal is not present in calendar.html
              
              const deleteBtn = document.createElement("button");
              deleteBtn.className = "btn btn-danger";
              deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
              deleteBtn.onclick = () => deleteTask(task.TaskId);
               footerActions.appendChild(deleteBtn);
           }
        }

        document.getElementById("taskDetailsModal").classList.remove("d-none");
    } catch (error) {
        console.error("Failed to load task details:", error);
        utils.showError("Failed to load task details");
    } finally {
        utils.hideLoading();
    }
}

async function deleteTask(taskId) {
  if (!confirm("Are you sure you want to delete this task?")) return;

  try {
    utils.showLoading();
    await API.Tasks.delete(taskId);
    utils.showSuccess("Task deleted successfully");
    closeTaskDetailsModal();
    // Reload calendar to refresh views
    await loadCalendarData();
  } catch (error) {
    console.error("Error deleting task:", error);
    utils.showError(error.message || "Failed to delete task");
  } finally {
    utils.hideLoading();
  }
}

function renderTaskDetails(task) {
  const detailsContainer = document.getElementById("taskDetailsContent");
  
  // Safe access to departments
  const userDepts = currentUser?.Departments || currentUser?.departments || [];
  const isSalesTeamLeader = userDepts.some(d => (d.DeptName || d.Name || '').toLowerCase() === "sales");

  const dueDate = task.DueDate
    ? new Date(task.DueDate).toLocaleDateString()
    : "Not set";

  detailsContainer.innerHTML = `
    <div class="details-grid" style="margin-bottom: var(--space-4);">
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-heading"></i> Task Title</label>
        <div class="detail-value">${task.Title || "Untitled Task"}</div>
      </div>
      
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-align-left"></i> Description</label>
        <div class="detail-value">${task.Description || "No description"}</div>
      </div>

      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user"></i> Assigned To</label>
        <div class="detail-value">${task.AssignedToName || "Unassigned"}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-flag"></i> Priority</label>
        <div class="detail-value">${utils.getPriorityBadge(task.PriorityId)}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-info-circle"></i> Status</label>
        <div class="detail-value">${utils.getStatusBadge(task.StatusId)}</div>
      </div>
      ${!isSalesTeamLeader ? `
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-folder"></i> Project</label>
        <div class="detail-value">${task.ProjectName || "N/A"}</div>
      </div>` : `
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user-tie"></i> Client Info</label>
        <div class="detail-value">${task.SalesClientInfo || "-"}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-location-dot"></i> Location</label>
        <div class="detail-value">${task.SalesMarketSegmentPlace || task.salesMarketSegmentPlace || "-"}</div>
      </div>
      <div class="detail-item">
          <label class="detail-label"><i class="fa-solid  fa-list-check"></i> Activity Type</label>
           <div class="detail-value">${
              task.SalesActivityType == 1 ? "Meeting" :
              task.SalesActivityType == 2 ? "Cold Call" :
              task.SalesActivityType == 3 ? "Data Collection" :
              task.SalesActivityType == 4 ? "Closing / Client Signing" : "-"
           }</div>
      </div>
      `}
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-user-pen"></i> Created By</label>
        <div class="detail-value">${task.CreatedByName || "Unknown"}</div>
      </div>
      <div class="detail-item">
        <label class="detail-label"><i class="fa-solid fa-calendar"></i> Due Date</label>
        <div class="detail-value">${dueDate}</div>
      </div>
    </div>
    
    ${ task.Comments && task.Comments.length > 0 ? `
      <div class="detail-item" style="margin-bottom: var(--space-4);">
        <label class="detail-label"><i class="fa-solid fa-comments"></i> Notes / History</label>
        <div class="detail-value" style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); ">
          ${task.Comments.map(c => `
             <div style="margin-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 12px;">
                <div style="display:flex; justify-content:space-between; font-size: 0.8em; color: var(--text-secondary); margin-bottom: 4px;">
                    <span>${c.CreatedBy || "System"}</span>
                    <span>${new Date(c.CreatedAt).toLocaleString()}</span>
                </div>
                 <div>${c.Content}</div>
             </div>
          `).join('')}
        </div>
      </div>
    ` : '' }
  `;
}

function closeTaskDetailsModal() {
    document.getElementById("taskDetailsModal").classList.add("d-none");
}
  
 // Navigation
function previousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  loadCalendarData(); // Reload to get new month's data
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  loadCalendarData();
}

// Modal Functions
function showCreateEventModal() {
  openEventModal();
}

function openEventModal(event = null, dateStr = null) {
  console.log("Opening event modal for:", event);

  const modal = document.getElementById("eventModal");
  const form = document.getElementById("eventForm");
  // Close details modal if open
  closeEventDetailsModal();

  // Populate Attendees List (Checkboxes inside Dropdown)
  const attendeesList = document.getElementById("attendeesList");
  if (attendeesList) {
      if (teamMembers.length === 0) {
          attendeesList.innerHTML = '<div class="text-muted small p-2">No supervised team members found.</div>';
      } else {
          attendeesList.innerHTML = teamMembers.map(u => `
              <div class="custom-checkbox-item" onclick="document.getElementById('att_${u.UserId || u.userId}').click()">
                  <input class="styled-checkbox" type="checkbox" name="attendeeIds" value="${u.UserId || u.userId}" id="att_${u.UserId || u.userId}" onclick="event.stopPropagation()" onchange="updateAttendeesButton()">
                  <label class="checkbox-label" for="att_${u.UserId || u.userId}">
                      ${u.Name || u.Username}
                  </label>
              </div>
          `).join('');
      }
      // Initial button update
      updateAttendeesButton();
  }

  if (event) {
    // Edit Mode
    currentEditId = event.EventId || event.eventId || event.Id || event.id;
    console.log("Editing Event with ID:", currentEditId);

    document.getElementById("eventId").value = currentEditId;
    document.getElementById("eventTitle").value = event.Title;
    document.getElementById("eventDescription").value = event.Description || "";
    
    // Fix TimeZone Issue
    const dVal = event.StartTime || event.startTime || event.StartDate || event.startDate;
    const d = new Date(dVal);
    
    // Get Local Date "YYYY-MM-DD"
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    document.getElementById("eventDate").value = `${year}-${month}-${day}`;
    
    // Get Local Time "HH:MM"
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    document.getElementById("eventTime").value = `${hours}:${mins}`;

    // Set Type
    const typeSelect = document.getElementById("eventType");
    let typeVal = "meeting";
    if (event.EventType === 2) typeVal = "deadline";
    if (event.EventType === 3) typeVal = "task";
    if (event.EventType === 4) typeVal = "reminder";
    if (event.EventType === 5) typeVal = "team-task";
    typeSelect.value = typeVal;

    // check Attendees
    if (event.Attendees && Array.isArray(event.Attendees)) {
         event.Attendees.forEach(att => {
              const uid = att.UserId || att.userId;
             const chk =  document.getElementById(`att_${uid}`);
             if(chk) chk.checked = true;
        });
        updateAttendeesButton();
    } else if (event.AttendeeIds && Array.isArray(event.AttendeeIds)) {
        event.AttendeeIds.forEach(id => {
            const chk = document.getElementById(`att_${id}`);
            if(chk) chk.checked = true;
        });
        updateAttendeesButton();
    }
  } else {
    // Create Mode
    currentEditId = null;
    form.reset();
    if (dateStr) {
      document.getElementById("eventDate").value = dateStr;
    } else {
      document.getElementById("eventDate").value = new Date().toISOString().split("T")[0];
    }
    document.getElementById("eventTime").value = "09:00";
    document.getElementById("eventType").value = "meeting";
    
    // clear attendees (form.reset handles unchecking)
    updateAttendeesButton();
  }

  modal.classList.remove("d-none");
}

function closeEventModal() {
  document.getElementById("eventModal").classList.add("d-none");
  currentEditId = null;
  const dropdown = document.getElementById("attendeesDropdown");
  if(dropdown) dropdown.classList.add("d-none");
}

// === Event Details Modal (Read Only) ===
function openEventDetails(event) {
    const modal = document.getElementById("eventDetailsModal");
    const content = document.getElementById("eventDetailsContent");
    const actions = document.getElementById("eventDetailsActions");
    
    // Date Formatting
    const dVal = event.StartTime || event.startTime || event.StartDate || event.startDate;
    const d = new Date(dVal);
    const dateOnly = d.toLocaleDateString();
    const timeOnly = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Type Label
    let typeLabel = "Meeting";
    if (event.EventType === 2) typeLabel = "Deadline";
    if (event.EventType === 3) typeLabel = "Task (Self)";
    if (event.EventType === 4) typeLabel = "Reminder";
    if (event.EventType === 5) typeLabel = "Team Task";
    
    // Attendees
    let attendeesHtml = '<div class="text-muted">No attendees</div>';
    
    // Try to get attendees from object list first, then fallback to mapping IDs
    let attendeesList = [];
    if (event.Attendees && Array.isArray(event.Attendees) && event.Attendees.length > 0) {
        attendeesList = event.Attendees;
    } else if (event.AttendeeIds && Array.isArray(event.AttendeeIds) && event.AttendeeIds.length > 0) {
        // Map IDs to Names using global teamMembers
        attendeesList = event.AttendeeIds.map(id => {
            const member = teamMembers.find(m => (m.UserId || m.userId) == id);
            return member ? { Name: member.Name || member.Username } : { Name: "Unknown" };
        });
    }

    if (attendeesList.length > 0) {
        attendeesHtml = attendeesList.map(a => `<span class="badge badge-secondary" style="margin-right: 5px;">${a.Name || a.Username || a.name || a.username}</span>`).join('');
    }

    content.innerHTML = `
        <div class="details-grid">
            <div class="detail-item">
                <label class="detail-label">Title</label>
                <div class="detail-value" style="font-size: 1.1em; font-weight: bold;">${event.Title}</div>
            </div>
            <div class="detail-item">
                <label class="detail-label">Description</label>
                <div class="detail-value">${event.Description || "No description"}</div>
            </div>
            <div class="detail-item">
                <label class="detail-label">Type</label>
                <div class="detail-value">${typeLabel}</div>
            </div>
            <div class="detail-item">
                <label class="detail-label">Date</label>
                <div class="detail-value">${dateOnly}</div>
            </div>
            <div class="detail-item">
                <label class="detail-label">Time</label>
                <div class="detail-value">${timeOnly}</div>
            </div>
            <div class="detail-item">
                <label class="detail-label">Attendees</label>
                <div class="detail-value">${attendeesHtml}</div>
            </div>
        </div>
    `;
    
    actions.innerHTML = "";
    
    // Only show actions if it's not a generic task (tasks from tasks table usually have negative IDs or special flags if we want to separate them, 
    // but here we just check if we can actually edit it. 
    // Assuming positive IDs are calendar events.)
    
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-info";
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';
    editBtn.onclick = () => openEventModal(event);
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
    deleteBtn.style.marginLeft = "10px";
    deleteBtn.onclick = () => deleteEvent(event.EventId || event.eventId || event.Id || event.id);
    actions.appendChild(deleteBtn);

    modal.classList.remove("d-none");
}

function closeEventDetailsModal() {
    document.getElementById("eventDetailsModal").classList.add("d-none");
}

// === Attendees UI Helpers ===
function toggleAttendeesDropdown() {
    const dd = document.getElementById("attendeesDropdown");
    dd.classList.toggle("d-none");
}

function updateAttendeesButton() {
    const checkboxes = document.querySelectorAll('input[name="attendeeIds"]:checked');
    const count = checkboxes.length;
    const btnText = document.getElementById("attendeesButtonText");
    if (!btnText) return;
    
    if (count === 0) {
        btnText.textContent = "Select Team Members";
    } else {
        btnText.textContent = `${count} Team Member${count > 1 ? 's' : ''} Selected`;
    }
}

async function handleEventSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("eventTitle").value;
  const description = document.getElementById("eventDescription").value;
  const dateVal = document.getElementById("eventDate").value;
  const timeVal = document.getElementById("eventTime").value || "09:00";
  const typeVal = document.getElementById("eventType").value;

  // Combine date and time
  const startDateTime = `${dateVal}T${timeVal}:00`;
  const startDate = new Date(startDateTime);
  const endDate = new Date(startDate);
  
  // Set duration based on type
  if (typeVal === "deadline" || typeVal === "reminder") {
      endDate.setHours(23, 59, 59, 999);
  } else {
      endDate.setHours(endDate.getHours() + 1);
  }

  // Get formatted string for EndTime (we only care about time for meetings mostly)
  // We need to send "YYYY-MM-DDTHH:mm:ss" without 'Z' to preserve local wall-clock time
  const formatLocalISO = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      const secs = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${mins}:${secs}`;
  };

  // Map type value to ID
  let typeId = 1;
  if (typeVal === "deadline") typeId = 2;
  if (typeVal === "task") typeId = 3;
  if (typeVal === "reminder") typeId = 4;
  if (typeVal === "team-task") typeId = 5;

  // Get Attendees
  const selectedAttendees = [];
  const checkboxes = document.querySelectorAll('input[name="attendeeIds"]:checked');
  checkboxes.forEach((checkbox) => {
      selectedAttendees.push(parseInt(checkbox.value));
  });

  // Use the raw input values for StartTime to ensure exact match with what user typed
  // For EndTime, use the calculated date but format strictly as local
  const payload = {
    Title: title,
    Description: description,
    StartTime: startDateTime, // Use the string directly from inputs: "YYYY-MM-DDTHH:mm:00"
    EndTime: formatLocalISO(endDate),
    EventType: typeId,
    AttendeeIds: selectedAttendees
  };

  // Fallback: Get ID from hidden field if global var is missing
  if (!currentEditId) {
      const hiddenId = document.getElementById("eventId").value;
      if (hiddenId) currentEditId = parseInt(hiddenId);
  }

  console.log("Submitting Event Payload:", payload, "CurrentEditId:", currentEditId);

  try {
    utils.showLoading();
    
    if (currentEditId) {
        // Only allow update if we have a  valid ID
       if (currentEditId > 0) {
           await API.Calendar.updateEvent(currentEditId, payload);
       } else {
           // Negative ID implies a simulated Task event which cannot be edited via Calendar API
           // Ideally we should disable the edit button for these, but as a fallback:
           // throw new Error("Cannot edit a Work Task from the calendar view.");
           utils.showError("Cannot edit a Work Task from the calendar view.");
           return; 
       }
    } else {
      await API.Calendar.createEvent(payload);
    }
    
    utils.showToast("Event saved successfully", "success");
    closeEventModal();
    // Force a small delay or ensure await finishes before reload
    setTimeout(async () => {
        await loadCalendarData();
    }, 500);
  } catch (error) {
    console.error("Error saving event:", error);
    utils.showError("Failed to save event");
  } finally {
    utils.hideLoading();
  }
}

async function deleteEvent() {
  // Fallback: Get ID from hidden field if global var is missing
  if (!currentEditId) {
      const hiddenId = document.getElementById("eventId").value;
      if (hiddenId) currentEditId = parseInt(hiddenId);
  }

  if (!currentEditId) return;
  
  if (currentEditId < 0) {
      utils.showError("Cannot delete a Work Task from the calendar view.");
      return;
  }

  if (!utils.confirmAction("Are you sure you want to delete this event?")) return;

  try {
    utils.showLoading();
    // Use correct API method (deleteEvent)
    await API.Calendar.deleteEvent(currentEditId);
    utils.showToast("Event deleted", "success");
    closeEventModal();
    await loadCalendarData();
  } catch (error) {
    console.error("Error deleting event:", error);
    utils.showError("Failed to delete event");
  } finally {
    utils.hideLoading();
  }
}