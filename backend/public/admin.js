const BACKEND = "https://medicalbhumika-2.onrender.com";

/* ================= LOGIN ================= */
async function login() {
  const email = email.value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${BACKEND}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!data.success) return alert("Login failed");

  localStorage.setItem("adminToken", data.token);
  loadOrders();
}

/* ================= LOAD ORDERS ================= */
async function loadOrders() {
  const token = localStorage.getItem("adminToken");
  if (!token) return;

  const res = await fetch(`${BACKEND}/api/admin/orders`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();
  if (!data.success) return alert("Failed to load orders");

  const tbody = document.querySelector("#ordersTable tbody");
  tbody.innerHTML = "";

  data.orders.forEach(o => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${o.orderId}</td>
      <td>${o.name}<br><small>${o.phone}</small></td>
      <td>₹${o.total}</td>
      <td class="status ${o.status}">${o.status}</td>
      <td>
        <button class="btn view" onclick="toggle('${o._id}')">View</button>
        <button class="btn approve" onclick="update('${o.orderId}','Approved')">✔</button>
        <button class="btn reject" onclick="update('${o.orderId}','Rejected')">✖</button>
      </td>
    `;

    const details = document.createElement("tr");
    details.id = o._id;
    details.className = "details";
    details.innerHTML = `
      <td colspan="5">
        <b>Items:</b><br>
        ${o.items.map(i => `${i.qty} × ${i.name}`).join("<br>")}
        <hr>
        <b>Payment:</b><br>
        Txn: ${o.payment?.txn || "N/A"}<br>
        ${o.payment?.fileUrl ? `<img src="${o.payment.fileUrl}" class="thumb" onclick="showImg('${o.payment.fileUrl}')">` : "No screenshot"}
      </td>
    `;

    tbody.appendChild(tr);
    tbody.appendChild(details);
  });
}

/* ================= ACTIONS ================= */
function toggle(id) {
  const row = document.getElementById(id);
  row.style.display = row.style.display === "table-row" ? "none" : "table-row";
}

async function update(orderId, status) {
  const token = localStorage.getItem("adminToken");

  await fetch(`${BACKEND}/api/admin/orders/${orderId}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ status })
  });

  loadOrders();
}

function showImg(src) {
  modalImg.src = src;
  modal.style.display = "flex";
}
function logout() {
  localStorage.removeItem("adminToken");
  window.location.href = "admin-login.html";
}

/* BLOCK ACCESS IF NOT LOGGED IN */
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "admin-login.html";
  }
});

/* AUTO LOAD */
document.addEventListener("DOMContentLoaded", loadOrders);
