// HIGH-01 / CRIT-02: One shared review-completion modal used by every reviewer page.
//
// Usage in a page:
//   1. include this script after api.js / utils.js / auth.js
//   2. call ReviewModal.mount() once on DOMContentLoaded
//   3. call ReviewModal.open(taskId, { onSubmitted }) from your row action
//
// Element IDs are stable across roles, so test selectors are the same everywhere.

(function (global) {
  const MODAL_HTML = `
  <div id="reviewModal" class="modal-backdrop d-none" data-testid="review-modal">
    <div class="modal-dialog" style="max-width: 700px">
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fa-solid fa-clipboard-check"></i> Review Task</h3>
          <button class="btn-icon" type="button" data-review-close>
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label><strong>Task:</strong></label>
            <p id="reviewTaskTitle" class="form-static"></p>
          </div>
          <div class="form-group">
            <label><strong>Description:</strong></label>
            <p id="reviewDescription" class="form-static"></p>
          </div>
          <div class="form-group">
            <label><strong>Assignee:</strong></label>
            <p id="reviewAssignee" class="form-static"></p>
          </div>
          <div class="form-group">
            <label><strong>Submitted:</strong></label>
            <p id="reviewCompletedDate" class="form-static"></p>
          </div>

          <div id="reviewUploadLinkGroup" class="form-group" style="display: none">
            <label><strong>Uploaded work:</strong></label>
            <a id="reviewUploadLink" target="_blank" rel="noopener noreferrer">Open folder</a>
          </div>

          <div id="reviewSalesKpiGroup" class="form-group" style="display: none">
            <label for="reviewSalesKpi"><strong>Final KPI value *</strong></label>
            <input type="number" id="reviewSalesKpi" class="form-control" step="0.01" />
            <p class="text-muted small">Confirm or edit the numeric result submitted by the assignee.</p>
          </div>

          <div class="form-group">
            <label for="reviewAction"><strong>Decision:</strong></label>
            <select id="reviewAction" class="form-control">
              <option value="approve">Approve</option>
              <option value="revise">Send back for revision</option>
            </select>
          </div>

          <div id="reviewNotesGroup" class="form-group" style="display: none">
            <label for="reviewNotes">Revision notes *</label>
            <textarea id="reviewNotes" class="form-control" rows="3"></textarea>
          </div>

          <div id="reviewNewDueDateGroup" class="form-group" style="display: none">
            <label for="reviewNewDueDate">New due date</label>
            <input type="date" id="reviewNewDueDate" class="form-control" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-review-close>Cancel</button>
          <button type="button" class="btn btn-primary" id="reviewSubmitBtn">Submit review</button>
        </div>
      </div>
    </div>
  </div>`;

  let currentTaskId = null;
  let currentTask = null;
  let onSubmittedCb = null;

  function $(id) {
    return document.getElementById(id);
  }

  function isSalesTask(task) {
    const dept = task.DeptName || task.deptName;
    return dept === "Sales" || task.SalesActivityType !== undefined && task.SalesActivityType !== null;
  }

  function toggleFields() {
    const action = $("reviewAction").value;
    $("reviewNotesGroup").style.display = action === "revise" ? "block" : "none";
    $("reviewNewDueDateGroup").style.display = action === "revise" ? "block" : "none";
  }

  async function open(taskId, opts = {}) {
    currentTaskId = taskId;
    onSubmittedCb = opts.onSubmitted || null;

    try {
      utils.showLoading();
      currentTask = await API.Tasks.getById(taskId);
      if (!currentTask) {
        utils.showError("Task not found");
        return;
      }

      $("reviewTaskTitle").textContent = currentTask.title || currentTask.Title || "Untitled";
      $("reviewDescription").textContent = currentTask.description || currentTask.Description || "No description";
      $("reviewAssignee").textContent = currentTask.assignedToName || currentTask.AssignedToName || "Unknown";
      $("reviewCompletedDate").textContent = utils.formatDate(
        currentTask.completedAt || currentTask.CompletedAt || currentTask.updatedAt || currentTask.UpdatedAt || new Date()
      );

      const salesGroup = $("reviewSalesKpiGroup");
      const uploadGroup = $("reviewUploadLinkGroup");
      if (isSalesTask(currentTask)) {
        salesGroup.style.display = "block";
        const kpi = currentTask.FinalKpiValue ?? currentTask.finalKpiValue ?? "";
        $("reviewSalesKpi").value = kpi;
        uploadGroup.style.display = "none";
      } else {
        salesGroup.style.display = "none";
        const link = currentTask.driveFolderLink || currentTask.DriveFolderLink;
        if (link) {
          uploadGroup.style.display = "block";
          $("reviewUploadLink").href = utils.sanitizeUrl(link);
        } else {
          uploadGroup.style.display = "none";
        }
      }

      $("reviewAction").value = "approve";
      $("reviewNotes").value = "";
      $("reviewNewDueDate").value = "";
      toggleFields();

      $("reviewModal").classList.remove("d-none");
    } catch (err) {
      console.error("[ReviewModal] open failed", err);
      utils.showError("Failed to open review modal");
    } finally {
      utils.hideLoading();
    }
  }

  function close() {
    $("reviewModal").classList.add("d-none");
    currentTaskId = null;
    currentTask = null;
    onSubmittedCb = null;
  }

  async function submit() {
    if (!currentTaskId) return;
    const action = $("reviewAction").value;
    const notes = $("reviewNotes").value.trim();
    if (action === "revise" && !notes) {
      utils.showError("Please provide revision notes");
      return;
    }

    let finalKpi = null;
    if (isSalesTask(currentTask) && action === "approve") {
      const raw = $("reviewSalesKpi").value;
      if (raw === "" || raw === null) {
        utils.showError("Final KPI value is required to approve a Sales task");
        return;
      }
      finalKpi = Number(raw);
      if (Number.isNaN(finalKpi)) {
        utils.showError("KPI value must be numeric");
        return;
      }
    }

    const payload = {
      approve: action === "approve",
      notes: notes || null,
      newDueDate: $("reviewNewDueDate").value || null,
      finalKpiValue: finalKpi,
    };

    try {
      utils.showLoading();
      await API.Tasks.reviewCompletion(currentTaskId, payload);
      utils.showSuccess(action === "approve" ? "Task approved" : "Revision request sent");
      const cb = onSubmittedCb;
      close();
      if (cb) await cb();
    } catch (err) {
      console.error("[ReviewModal] submit failed", err);
      const msg = (err && err.message) || "Failed to submit review";
      utils.showError(msg);
    } finally {
      utils.hideLoading();
    }
  }

  function mount() {
    if (document.getElementById("reviewModal")) return; // already mounted
    const container = document.createElement("div");
    container.innerHTML = MODAL_HTML;
    document.body.appendChild(container.firstElementChild);

    document.querySelectorAll("#reviewModal [data-review-close]").forEach((btn) => {
      btn.addEventListener("click", close);
    });
    $("reviewAction").addEventListener("change", toggleFields);
    $("reviewSubmitBtn").addEventListener("click", submit);
  }

  global.ReviewModal = { mount, open, close };
})(window);
