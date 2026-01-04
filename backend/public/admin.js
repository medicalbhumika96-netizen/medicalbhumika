const BACKEND_BASE = "https://medicalbhumika-2.onrender.com";

/* =========================
   ADMIN LOGIN
========================= */
async function loginAdmin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Enter email and password");
    return;
  }

  try {
    const res = await fetch(`${BACKEND_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!data.success) {
      alert("Invalid admin credentials");
      return;
    }

    // ✅ Save JWT token
    localStorage.setItem("adminToken", data.token);

    // redirect to admin dashboard
    window.location.href = "admin.html";

  } catch (err) {
    console.error(err);
    alert("Login error");
  }
}

/* =========================
   LOAD ORDERS
========================= */
async function loadOrders() {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    alert("Admin not logged in");
    window.location.href = "admin-login.html";
    return;
  }

  try {
    const res = await fetch(`${BACKEND_BASE}/api/admin/orders`, {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const data = await res.json();

    if (!data.success) {
      alert("Failed to load orders");
      return;
    }

    const tbody = document.querySelector("#ordersTable tbody");
    tbody.innerHTML = "";

    data.orders.forEach(o => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${o.orderId}</td>
        <td>${o.name}</td>
        <td>${o.phone}</td>
        <td>₹${o.total}</td>
        <td>${o.status}</td>
        <td>${new Date(o.createdAt).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    alert("Server error while loading orders");
  }
}

/* =========================
   AUTO LOAD ON ADMIN PAGE
========================= */
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("ordersTable")) {
    loadOrders();
  }
});

/* =========================
   LOGOUT
========================= */
function logoutAdmin() {
  localStorage.removeItem("adminToken");
  window.location.href = "admin-login.html";
}
