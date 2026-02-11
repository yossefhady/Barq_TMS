// Reusable UI Components

// Modal Management
class ModalManager {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    this.form = this.modal?.querySelector("form");
  }

  show() {
    if (this.modal) {
      this.modal.classList.remove("d-none");
    }
  }

  hide() {
    if (this.modal) {
      this.modal.classList.add("d-none");
      if (this.form) {
        this.form.reset();
      }
    }
  }

  setTitle(title) {
    const titleElement = this.modal?.querySelector(".modal-header h3");
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  getFormData() {
    if (!this.form) return null;
    const formData = new FormData(this.form);
    const data = {};
    for (let [key, value] of formData.entries()) {
      data[key] = value;
    }
    return data;
  }

  setFormData(data) {
    if (!this.form) return;
    Object.keys(data).forEach((key) => {
      const input = this.form.querySelector(`[name="${key}"]`);
      if (input) {
        input.value = data[key] || "";
      }
    });
  }
}

// Table Component
class DataTable {
  constructor(tableId, columns) {
    this.tableBody = document.querySelector(`#${tableId} tbody`);
    this.columns = columns;
    this.data = [];
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  render() {
    if (!this.tableBody) return;

    if (this.data.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="${this.columns.length}" class="text-center" style="padding: 40px;">
            <div class="empty-state">
              <i class="fa-solid fa-inbox"></i>
              <h3>No data available</h3>
              <p>There are no records to display</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.tableBody.innerHTML = this.data
      .map((row) => {
        const cells = this.columns
          .map((col) => {
            const value = col.render ? col.render(row) : row[col.key];
            return `<td>${value}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
  }

  addRow(rowData) {
    this.data.push(rowData);
    this.render();
  }

  updateRow(index, rowData) {
    this.data[index] = rowData;
    this.render();
  }

  deleteRow(index) {
    this.data.splice(index, 1);
    this.render();
  }

  clear() {
    this.data = [];
    this.render();
  }
}

// Stats Card Component
function createStatCard(icon, label, value, color = "primary") {
  return `
    <div class="stat-card">
      <div class="stat-icon">
        <i class="${icon}"></i>
      </div>
      <div class="stat-info">
        <span class="stat-label">${label}</span>
        <span class="stat-value">${value}</span>
      </div>
    </div>
  `;
}

// Action Buttons Component
function createActionButtons(id, options = {}) {
  const buttons = [];

  if (options.edit !== false) {
    buttons.push(`
      <button class="btn btn-sm btn-primary" onclick="editItem(${id})">
        <i class="fa-solid fa-pen"></i> Edit
      </button>
    `);
  }

  if (options.delete !== false) {
    buttons.push(`
      <button class="btn btn-sm btn-danger" onclick="deleteItem(${id})">
        <i class="fa-solid fa-trash"></i> Delete
      </button>
    `);
  }

  if (options.view) {
    buttons.push(`
      <button class="btn btn-sm btn-secondary" onclick="viewItem(${id})">
        <i class="fa-solid fa-eye"></i> View
      </button>
    `);
  }

  return `<div class="table-actions">${buttons.join("")}</div>`;
}

// Search Filter Component
function initSearchFilter(inputId, tableId, searchColumns) {
  const searchInput = document.getElementById(inputId);
  if (!searchInput) return;

  searchInput.addEventListener(
    "input",
    utils.debounce((e) => {
      const searchTerm = e.target.value.toLowerCase();
      const table = document.getElementById(tableId);
      if (!table) return;

      const rows = table.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const text = Array.from(row.cells)
          .map((cell) => cell.textContent.toLowerCase())
          .join(" ");
        row.style.display = text.includes(searchTerm) ? "" : "none";
      });
    }, 300)
  );
}

// Dropdown Component
function createDropdown(options, selectedValue = "") {
  return options
    .map((opt) => {
      const value = opt.value || opt.id || opt;
      const label = opt.label || opt.name || opt;
      const selected = value == selectedValue ? "selected" : "";
      return `<option value="${value}" ${selected}>${label}</option>`;
    })
    .join("");
}

// Pagination Component
class Pagination {
  constructor(containerId, itemsPerPage = 10) {
    this.container = document.getElementById(containerId);
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    this.totalPages = 1;
    this.onPageChange = null;
  }

  setTotalItems(total) {
    this.totalPages = Math.ceil(total / this.itemsPerPage);
    this.render();
  }

  render() {
    if (!this.container) return;

    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      const active = i === this.currentPage ? "active" : "";
      pages.push(`
        <button class="btn btn-sm ${active}" onclick="pagination.goToPage(${i})">
          ${i}
        </button>
      `);
    }

    this.container.innerHTML = `
      <div class="pagination">
        <button class="btn btn-sm" onclick="pagination.prev()" ${
          this.currentPage === 1 ? "disabled" : ""
        }>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        ${pages.join("")}
        <button class="btn btn-sm" onclick="pagination.next()" ${
          this.currentPage === this.totalPages ? "disabled" : ""
        }>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    `;
  }

  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.render();
    if (this.onPageChange) {
      this.onPageChange(page);
    }
  }

  next() {
    this.goToPage(this.currentPage + 1);
  }

  prev() {
    this.goToPage(this.currentPage - 1);
  }
}

// Export components
window.components = {
  ModalManager,
  DataTable,
  createStatCard,
  createActionButtons,
  initSearchFilter,
  createDropdown,
  Pagination,
};
