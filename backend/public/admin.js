// ================================
// Bhumika Medical — Admin JS
// ================================

const BACKEND = "https://medicalbhumika-2.onrender.com";
const token = localStorage.getItem("adminToken");

// 🔐 Auth guard
if (!token) {
  location.href = "admin-login.html";
}

let ORDERS = [];

/* ================================
   LOAD ORDERS
================================ */
async function loadOrders() {
  try {
    const res = await fetch(`${BACKEND}/api/admin/orders`, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await res.json();

    if (!data.success) {
      alert("Failed to load orders");
      return;
    }

    ORDERS = data.orders || [];
    updateDashboard();
    renderOrders();

  } catch (err) {
    console.error("Load orders error:", err);
    alert("Server error while loading orders");
  }
}

/* ================================
   DASHBOARD METRICS
================================ */
function updateDashboard() {
  const today = new Date().toDateString();

  let todayOrders = 0;
  let todayRevenue = 0;
  let pending = 0;
  const customers = new Set();

  ORDERS.forEach(o => {
    if (new Date(o.createdAt).toDateString() === today) {
      todayOrders++;
      todayRevenue += Number(o.total || 0);
    }
    if (o.status === "Pending") pending++;
    if (o.phone) customers.add(o.phone);
  });

  document.getElementById("todayOrders").textContent = todayOrders;
  document.getElementById("todayRevenue").textContent = "₹" + todayRevenue;
  document.getElementById("pendingOrders").textContent = pending;
  document.getElementById("uniqueCustomers").textContent = customers.size;
}

/* ================================
   RENDER ORDERS (TABLE + MOBILE)
================================ */
function renderOrders() {
  const q = document.getElementById("search").value.toLowerCase();
  const st = document.getElementById("statusFilter").value;

  const tableBody = document.getElementById("orders");
  const mobileWrap = document.getElementById("mobileOrders");

  tableBody.innerHTML = "";
  if (mobileWrap) mobileWrap.innerHTML = "";

  ORDERS.filter(o =>
    (!st || o.status === st) &&
    (o.orderId.toLowerCase().includes(q) || o.phone.includes(q))
  ).forEach(o => {

    // ===== DESKTOP ROW =====
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${o.orderId}</td>
      <td>${o.name}<br><small>${o.phone}</small></td>
     <td class="items"
    onclick='viewItemsDesktop(${JSON.stringify(o.items)})'>
  ${o.items.length}
</td>

      <td>₹${o.total}</td>
      <td>
        ${o.payment?.screenshot
          ? `<img src="${BACKEND}${o.payment.screenshot}"
                 class="proof"
                 onclick="showImg('${BACKEND}${o.payment.screenshot}')">`
          : "—"}
      </td>
      <td class="status ${o.status}" id="status-${o.orderId}">
        ${o.status}
      </td>
      <td>
        <button class="approve"
          onclick="updateStatus('${o.orderId}','Approved')">✓</button>
        <button class="reject"
          onclick="updateStatus('${o.orderId}','Rejected')">✕</button>
      </td>
    `;
    tableBody.appendChild(tr);

    // ===== MOBILE CARD =====
    if (mobileWrap) {
      const card = document.createElement("div");
      card.className = "order-card";
      card.innerHTML = `
        <div class="order-top">
          <span>${o.orderId}</span>
          <span class="status ${o.status}"
                id="m-${o.orderId}">${o.status}</span>
        </div>
        👤 ${o.name}<br>
        📞 ${o.phone}<br>
        💰 ₹${o.total}<br>
        📦 ${o.items.length} items
        <div class="order-actions">
          <button class="approve"
            onclick="updateStatus('${o.orderId}','Approved')">Approve</button>
          <button class="reject"
            onclick="updateStatus('${o.orderId}','Rejected')">Reject</button>
        </div>
      `;
      mobileWrap.appendChild(card);
    }
  });
}

/* ================================
   UPDATE STATUS
   + WHATSAPP AUTO OPEN
================================ */
async function updateStatus(orderId, status) {
  try {
    const res = await fetch(
      `${BACKEND}/api/admin/orders/${orderId}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ status })
      }
    );

    const data = await res.json();

    if (!data.success) {
      alert("Status update failed");
      return;
    }

    // 🟢 INSTANT UI UPDATE (DESKTOP)
    const badge = document.getElementById("status-" + orderId);
    if (badge) {
      badge.textContent = status;
      badge.className = "status " + status;
    }

    // 🟢 MOBILE BADGE
    const mb = document.getElementById("m-" + orderId);
    if (mb) {
      mb.textContent = status;
      mb.className = "status " + status;
    }

    // 🔔 AUTO OPEN WHATSAPP
    if (data.waLink) {
      window.open(data.waLink, "_blank");
    }

  } catch (err) {
    console.error("Update status error:", err);
    alert("Server error while updating status");
  }
}

/* ================================
   IMAGE MODAL
================================ */
function showImg(src) {
  document.getElementById("modalImg").src = src;
  document.getElementById("downloadLink").href = src;
  document.getElementById("modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

/* ================================
   EXPORT CSV
================================ */
function exportCSV() {
  let csv = "OrderID,Name,Phone,Total,Status\n";
  ORDERS.forEach(o => {
    csv += `${o.orderId},${o.name},${o.phone},${o.total},${o.status}\n`;
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "orders.csv";
  a.click();
}

/* ================================
   LOGOUT
================================ */
function logout() {
  localStorage.removeItem("adminToken");
  location.href = "admin-login.html";
}

/* ================================
   EVENTS + INIT
================================ */
document.getElementById("search").oninput = renderOrders;
document.getElementById("statusFilter").onchange = renderOrders;

loadOrders();
