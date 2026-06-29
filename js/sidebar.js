/**
 * sidebar.js — Superadmin Sidebar Injection Script
 * Only activates when ADMIN_ROLE === "superadmin".
 * For all other roles, this script exits immediately with zero DOM changes.
 */
(function () {
  "use strict";

  const ADMIN_ROLE = localStorage.getItem("ADMIN_ROLE");
  if (ADMIN_ROLE !== "superadmin") return; // ← RBAC gate: zero side-effects for non-superadmins

  const BASE_URL = "https://fayzullaev-ielts-school-backend-0mjh.onrender.com/api";
  const ADMIN_USERNAME = localStorage.getItem("ADMIN_USERNAME") || "";

  // Detect current page for active highlighting
  const currentPage = window.location.pathname.split("/").pop() || "attendance.html";

  const NAV_ITEMS = [
    { href: "attendance.html",  icon: "fa-solid fa-clipboard-check", label: "Attendance" },
    { href: "payment.html",     icon: "fa-solid fa-credit-card",     label: "Payment" },
    { href: "absentUsers.html", icon: "fa-solid fa-user-xmark",      label: "Absent Students" },
    { href: "users.html",       icon: "fa-solid fa-user-check",      label: "User Auth" },
    { href: "superadmin.html",  icon: "fa-solid fa-shield-halved",   label: "Admin Panel" },
  ];

  // Mark body
  document.body.classList.add("has-sidebar");

  // Build sidebar HTML
  const sidebar = document.createElement("aside");
  sidebar.className = "superadmin-sidebar";
  sidebar.id = "superadminSidebar";

  let menuItemsHTML = NAV_ITEMS.map((item) => {
    const isActive = currentPage === item.href ? ' class="active"' : "";
    return `<li${isActive}><a href="${item.href}"><i class="${item.icon}"></i><span>${item.label}</span></a></li>`;
  }).join("");

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <img src="./images/logo.jpg" alt="Logo" class="sidebar-logo" />
      <span class="sidebar-title">School Admin</span>
    </div>
    <ul class="sidebar-menu">
      ${menuItemsHTML}
      <li class="logout-item">
        <a href="index.html" id="sidebarLogout">
          <i class="fa-solid fa-right-from-bracket"></i>
          <span>Log Out</span>
        </a>
      </li>
    </ul>
    <div class="sidebar-collapse-btn" id="sidebarCollapseBtn">
      <i class="fa-solid fa-angles-left" id="collapseIcon"></i>
    </div>
  `;

  // Create overlay for mobile
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  overlay.id = "sidebarOverlay";

  // Inject into DOM before all other content
  document.body.prepend(overlay);
  document.body.prepend(sidebar);

  // === Desktop collapse toggle ===
  const collapseBtn = document.getElementById("sidebarCollapseBtn");
  const collapseIcon = document.getElementById("collapseIcon");

  collapseBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    document.body.classList.toggle("sidebar-collapsed");
    if (sidebar.classList.contains("collapsed")) {
      collapseIcon.className = "fa-solid fa-angles-right";
    } else {
      collapseIcon.className = "fa-solid fa-angles-left";
    }
  });

  // === Mobile drawer toggle ===
  const hamburger = document.getElementById("hamburger");
  if (hamburger) {
    // Override default hamburger behavior for superadmin
    hamburger.replaceWith(hamburger.cloneNode(true)); // remove old listeners
    const newHamburger = document.getElementById("hamburger");
    newHamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      sidebar.classList.toggle("open");
      overlay.classList.toggle("show");
    });
  }

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  });

  // Clear localStorage on logout
  const logoutLink = document.getElementById("sidebarLogout");
  if (logoutLink) {
    logoutLink.addEventListener("click", () => {
      localStorage.removeItem("ADMIN_ROLE");
      localStorage.removeItem("ADMIN_USERNAME");
    });
  }

  // === Global audit action logger ===
  window.logAdminAction = function (action, details) {
    if (!ADMIN_USERNAME) return;
    try {
      fetch(`${BASE_URL}/admin/audit-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: ADMIN_USERNAME,
          action: action,
          details: details || {},
        }),
      }).catch((err) => console.warn("Audit log failed:", err));
    } catch (e) {
      console.warn("Audit log error:", e);
    }
  };
})();
