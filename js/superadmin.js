/**
 * superadmin.js — Superadmin Dashboard Controller
 * Manages admin CRUD, session telemetry display, and paginated audit logs.
 * All rendering is wrapped in error boundaries to protect the layout.
 */
(function () {
  "use strict";

  const BASE_URL = "https://fayzullaev-ielts-school-backend-0mjh.onrender.com/api";
  const ADMIN_ROLE = localStorage.getItem("ADMIN_ROLE");

  // RBAC Guard
  if (ADMIN_ROLE !== "superadmin") {
    window.location.href = "attendance.html";
    return;
  }

  // ── Error Boundary Utility ────────────────────────
  const ErrorBoundary = {
    wrap: function (containerId, fn) {
      const container = document.getElementById(containerId);
      if (!container) return;
      try {
        fn(container);
      } catch (err) {
        console.error(`[ErrorBoundary] ${containerId}:`, err);
        container.innerHTML = `
          <div class="error-boundary-alert">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <div>
              <h4>Component failed to load</h4>
              <p>An error occurred while rendering this section. The rest of the dashboard remains functional.</p>
              <small>${err.message || "Unknown error"}</small>
            </div>
          </div>`;
      }
    },
  };

  // ── State ─────────────────────────────────────────
  let admins = [];
  let sessions = [];
  let auditLogs = [];
  let auditPage = 1;
  const AUDIT_PER_PAGE = 15;
  let auditSearchQuery = "";

  // ── Init ──────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    loadAdmins();
    loadSessions();
    loadAuditLogs();
    bindEvents();
  });

  function bindEvents() {
    // Add admin button
    const addBtn = document.getElementById("addAdminBtn");
    if (addBtn) addBtn.addEventListener("click", openAddModal);

    // Modal close
    const closeBtn = document.getElementById("closeModalBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    const cancelBtn = document.getElementById("cancelModalBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    // Modal save
    const saveBtn = document.getElementById("saveAdminBtn");
    if (saveBtn) saveBtn.addEventListener("click", handleSaveAdmin);

    // Search
    const searchInput = document.getElementById("auditSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        auditSearchQuery = e.target.value.toLowerCase().trim();
        auditPage = 1;
        renderAuditLogs();
      });
    }
  }

  // ── Skeleton Loaders ──────────────────────────────
  function showSkeleton(containerId, rows) {
    const el = document.getElementById(containerId);
    if (!el) return;
    let html = "";
    for (let i = 0; i < (rows || 4); i++) {
      html += '<div class="skeleton skeleton-row"></div>';
    }
    el.innerHTML = html;
  }

  // ── Admin Credentials CRUD ────────────────────────
  async function loadAdmins() {
    showSkeleton("adminsTableBody", 3);
    try {
      const res = await fetch(`${BASE_URL}/admin`);
      if (!res.ok) throw new Error("Failed to fetch admins");
      admins = await res.json();
      ErrorBoundary.wrap("adminsTableBody", renderAdmins);
    } catch (err) {
      ErrorBoundary.wrap("adminsTableBody", () => { throw err; });
    }
  }

  function renderAdmins(container) {
    if (!admins.length) {
      container.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">No admins found</td></tr>';
      return;
    }
    container.innerHTML = admins.map((a) => {
      const roleBadge = a.role === "superadmin" ? "badge-superadmin"
        : a.role === "admin" ? "badge-admin" : "badge-moderator";
      return `
        <tr>
          <td><strong>${escapeHtml(a.username)}</strong></td>
          <td>
            <div class="password-display">
              <span class="password-masked" id="pw-${a.id}">••••••••</span>
              <button class="icon-btn" onclick="window._togglePw('${a.id}','${escapeHtml(a.password || "")}')">
                <i class="fa-solid fa-eye" id="pw-icon-${a.id}"></i>
              </button>
            </div>
          </td>
          <td><span class="badge ${roleBadge}">${escapeHtml(a.role || "admin")}</span></td>
          <td>
            <button class="icon-btn" onclick="window._editAdmin('${a.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn delete" onclick="window._deleteAdmin('${a.id}','${escapeHtml(a.username)}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
    }).join("");
  }

  // Toggle password visibility
  window._togglePw = function (id, pw) {
    const span = document.getElementById(`pw-${id}`);
    const icon = document.getElementById(`pw-icon-${id}`);
    if (!span || !icon) return;
    if (span.textContent === "••••••••") {
      span.textContent = pw;
      span.style.letterSpacing = "normal";
      icon.className = "fa-solid fa-eye-slash";
    } else {
      span.textContent = "••••••••";
      span.style.letterSpacing = "3px";
      icon.className = "fa-solid fa-eye";
    }
  };

  // Delete admin
  window._deleteAdmin = async function (id, username) {
    if (!confirm(`Delete admin "${username}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${BASE_URL}/admin/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      admins = admins.filter((a) => a.id !== id);
      ErrorBoundary.wrap("adminsTableBody", renderAdmins);
      if (typeof window.logAdminAction === "function") {
        window.logAdminAction("delete_admin", { deletedUsername: username });
      }
    } catch (err) {
      alert("Failed to delete admin: " + err.message);
    }
  };

  // Edit admin (open modal with pre-filled data)
  window._editAdmin = function (id) {
    const admin = admins.find((a) => a.id === id);
    if (!admin) return;
    openModal("Edit Admin", admin);
  };

  // ── Modal Logic ───────────────────────────────────
  let editingAdminId = null;

  function openAddModal() {
    openModal("Add New Admin", null);
  }

  function openModal(title, adminData) {
    editingAdminId = adminData ? adminData.id : null;
    const overlay = document.getElementById("adminModalOverlay");
    const titleEl = document.getElementById("modalTitle");
    const usernameInput = document.getElementById("modalUsername");
    const passwordInput = document.getElementById("modalPassword");
    const roleSelect = document.getElementById("modalRole");

    titleEl.textContent = title;
    usernameInput.value = adminData ? adminData.username : "";
    usernameInput.disabled = !!adminData; // can't change username on edit
    passwordInput.value = "";
    passwordInput.placeholder = adminData ? "Leave blank to keep current" : "Enter password";
    roleSelect.value = adminData ? (adminData.role || "admin") : "admin";

    overlay.style.display = "flex";
  }

  function closeModal() {
    document.getElementById("adminModalOverlay").style.display = "none";
    editingAdminId = null;
  }

  async function handleSaveAdmin() {
    const username = document.getElementById("modalUsername").value.trim();
    const password = document.getElementById("modalPassword").value;
    const role = document.getElementById("modalRole").value;

    if (!editingAdminId) {
      // Creating new admin
      if (!username || !password || !role) return alert("All fields are required");
      try {
        const res = await fetch(`${BASE_URL}/admin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Create failed");
        closeModal();
        loadAdmins();
        if (typeof window.logAdminAction === "function") {
          window.logAdminAction("create_admin", { newUsername: username, role });
        }
      } catch (err) {
        alert("Error: " + err.message);
      }
    } else {
      // Editing existing admin
      try {
        const body = { role };
        if (password) body.password = password;
        const res = await fetch(`${BASE_URL}/admin/${editingAdminId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Update failed");
        closeModal();
        loadAdmins();
        if (typeof window.logAdminAction === "function") {
          window.logAdminAction("edit_admin", { editedAdminId: editingAdminId });
        }
      } catch (err) {
        alert("Error: " + err.message);
      }
    }
  }

  // ── Sessions / Telemetry ──────────────────────────
  async function loadSessions() {
    showSkeleton("sessionsTableBody", 4);
    try {
      const res = await fetch(`${BASE_URL}/admin/sessions`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      sessions = await res.json();
      ErrorBoundary.wrap("sessionsTableBody", renderSessions);
    } catch (err) {
      ErrorBoundary.wrap("sessionsTableBody", () => { throw err; });
    }
  }

  function renderSessions(container) {
    if (!sessions.length) {
      container.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No sessions recorded</td></tr>';
      return;
    }
    container.innerHTML = sessions.map((s) => {
      const t = s.telemetry || {};
      const formFactor = t.formFactor || "Unknown";
      const ffClass = formFactor.toLowerCase().includes("phone") ? "status-phone"
        : formFactor.toLowerCase().includes("tablet") ? "status-tablet" : "status-desktop";
      const loginTime = s.loginAt ? new Date(s.loginAt).toLocaleString() : "—";
      const storage = t.storageEstimate || "N/A";

      return `
        <tr>
          <td><strong>${escapeHtml(s.username || "—")}</strong></td>
          <td class="time-col">${loginTime}</td>
          <td class="time-col">${escapeHtml(s.ip || "—")}</td>
          <td><span class="badge ${ffClass}">${escapeHtml(formFactor)}</span></td>
          <td>${escapeHtml(t.os || "—")} / ${escapeHtml(t.deviceName || "—")}</td>
          <td>${escapeHtml(String(storage))}</td>
        </tr>`;
    }).join("");
  }

  // ── Audit Logs (Paginated + Filtered) ─────────────
  async function loadAuditLogs() {
    showSkeleton("auditTimeline", 6);
    try {
      const res = await fetch(`${BASE_URL}/admin/audit-logs`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      auditLogs = await res.json();
      renderAuditLogs();
    } catch (err) {
      ErrorBoundary.wrap("auditTimeline", () => { throw err; });
    }
  }

  function renderAuditLogs() {
    ErrorBoundary.wrap("auditTimeline", _renderAuditTimeline);
    renderPagination();
  }

  function _renderAuditTimeline(container) {
    let filtered = auditLogs;
    if (auditSearchQuery) {
      filtered = auditLogs.filter((l) =>
        (l.username || "").toLowerCase().includes(auditSearchQuery) ||
        (l.action || "").toLowerCase().includes(auditSearchQuery) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(auditSearchQuery)
      );
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / AUDIT_PER_PAGE));
    if (auditPage > totalPages) auditPage = totalPages;
    const start = (auditPage - 1) * AUDIT_PER_PAGE;
    const pageItems = filtered.slice(start, start + AUDIT_PER_PAGE);

    if (!pageItems.length) {
      container.innerHTML = '<p style="text-align:center;color:#94a3b8;">No audit log entries found.</p>';
      return;
    }

    container.innerHTML = '<div class="timeline">' + pageItems.map((l) => {
      const badgeClass = getBadgeClass(l.action);
      const time = l.timestamp ? new Date(l.timestamp).toLocaleString() : "—";
      const detailStr = l.details && Object.keys(l.details).length
        ? Object.entries(l.details).map(([k, v]) => `${k}: ${v}`).join(" · ")
        : "";
      return `
        <div class="timeline-item">
          <div class="timeline-badge ${badgeClass}"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-user">${escapeHtml(l.username || "System")}</span>
              <span class="timeline-time">${time}</span>
            </div>
            <div class="timeline-body">${formatAction(l.action)}</div>
            ${detailStr ? `<div class="timeline-details">${escapeHtml(detailStr)}</div>` : ""}
          </div>
        </div>`;
    }).join("") + "</div>";
  }

  function renderPagination() {
    const container = document.getElementById("auditPagination");
    if (!container) return;
    let filtered = auditLogs;
    if (auditSearchQuery) {
      filtered = auditLogs.filter((l) =>
        (l.username || "").toLowerCase().includes(auditSearchQuery) ||
        (l.action || "").toLowerCase().includes(auditSearchQuery) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(auditSearchQuery)
      );
    }
    const totalPages = Math.max(1, Math.ceil(filtered.length / AUDIT_PER_PAGE));
    let html = `<button class="page-btn" ${auditPage <= 1 ? "disabled" : ""} onclick="window._auditPage(${auditPage - 1})">‹</button>`;
    for (let p = 1; p <= totalPages; p++) {
      html += `<button class="page-btn ${p === auditPage ? "active" : ""}" onclick="window._auditPage(${p})">${p}</button>`;
    }
    html += `<button class="page-btn" ${auditPage >= totalPages ? "disabled" : ""} onclick="window._auditPage(${auditPage + 1})">›</button>`;
    container.innerHTML = html;
  }

  window._auditPage = function (p) {
    auditPage = p;
    renderAuditLogs();
  };

  // ── Helpers ───────────────────────────────────────
  function getBadgeClass(action) {
    if (!action) return "";
    if (action.includes("login")) return "login";
    if (action.includes("create") || action.includes("approve")) return "create";
    if (action.includes("edit") || action.includes("update") || action.includes("change")) return "edit";
    if (action.includes("delete") || action.includes("reject")) return "delete";
    if (action.includes("mark") || action.includes("paid") || action.includes("attendance")) return "mark";
    return "";
  }

  function formatAction(action) {
    if (!action) return "Unknown action";
    return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();
