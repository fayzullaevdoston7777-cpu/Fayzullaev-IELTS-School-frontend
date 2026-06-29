const form = document.getElementById("loginForm");
const button = document.getElementById("loginBtn");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", () => {
  const type = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = type;

  togglePassword.classList.toggle("fa-eye");
  togglePassword.classList.toggle("fa-eye-slash");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (!username || !password) {
    return alert("Username va password kiriting");
  }

  button.textContent = "Loading...";
  button.disabled = true;

  try {
    // Collect device telemetry (safe fallbacks for all fields)
    const telemetry = {};
    try {
      const ua = navigator.userAgent || "";
      const width = screen.width || window.innerWidth;
      // Form factor detection
      if (width <= 480 || /Mobi|Android.*Mobile|iPhone/i.test(ua)) {
        telemetry.formFactor = "Phone";
      } else if (width <= 1024 || /iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) {
        telemetry.formFactor = "Tablet";
      } else {
        telemetry.formFactor = "Laptop/Desktop";
      }
      // OS detection
      if (/Windows/i.test(ua)) telemetry.os = "Windows";
      else if (/Mac OS|Macintosh/i.test(ua)) telemetry.os = "macOS";
      else if (/Android/i.test(ua)) telemetry.os = "Android";
      else if (/iPhone|iPad|iOS/i.test(ua)) telemetry.os = "iOS";
      else if (/Linux/i.test(ua)) telemetry.os = "Linux";
      else telemetry.os = "Unknown OS";
      // Browser / device name
      if (/Edg\//i.test(ua)) telemetry.deviceName = "Edge";
      else if (/Chrome/i.test(ua)) telemetry.deviceName = "Chrome";
      else if (/Firefox/i.test(ua)) telemetry.deviceName = "Firefox";
      else if (/Safari/i.test(ua)) telemetry.deviceName = "Safari";
      else telemetry.deviceName = "Unknown Browser";
      // Storage estimate
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        telemetry.storageEstimate = `${(est.usage / 1048576).toFixed(1)} MB / ${(est.quota / 1073741824).toFixed(1)} GB`;
      } else {
        telemetry.storageEstimate = "N/A";
      }
    } catch (_) {
      telemetry.formFactor = telemetry.formFactor || "Laptop/Desktop";
      telemetry.os = telemetry.os || "Unknown OS";
      telemetry.deviceName = telemetry.deviceName || "Unknown Browser";
      telemetry.storageEstimate = telemetry.storageEstimate || "N/A";
    }

    const res = await fetch(
      "https://fayzullaev-ielts-school-backend-0mjh.onrender.com/api/admin/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, telemetry }),
      },
    );

    const data = await res.json();
    console.log("Login response:", data);

    if (res.ok) {
      localStorage.setItem("ADMIN_ROLE", data.role);
      localStorage.setItem("ADMIN_USERNAME", data.username);
      window.location.href = "attendance.html";
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    console.error(err);
    alert("Server bilan ulanishda xatolik");
  } finally {
    button.textContent = "Login";
    button.disabled = false;
  }
});