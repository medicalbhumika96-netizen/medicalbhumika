const API_BASE = "https://medicalbhumika-2.onrender.com";
const token = localStorage.getItem("adminToken");

if (!token) {
  alert("Admin not logged in");
  location.href = "/admin-login.html";
}

const tbody = document.getElementById("orders-body");
const filterSelect = document.getElementById("statusFilter");

let ALL_ORDERS = [];

// ================= LOAD ORDERS =================
async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="7">Failed to load orders</td></tr>`;
      return;
    }

    ALL_ORDERS = data.orders;
    applyFilter();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7">Server error</td></tr>`;
  }
}

// ================= FILTER =================
function applyFilter() {
  const status = filterSelect.value;
  const filtered = status
    ? ALL_ORDERS.filter(o => o.status === status)
    : ALL_ORDERS;

  renderOrders(filtered);
}

filterSelect.addEventListener("change", applyFilter);

// ================= RENDER =================
function renderOrders(orders) {
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7">No orders</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  orders.forEach(order => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${order.orderId}</td>

      <td>
        <b>${order.name || "-"}</b><br>
        <span class="small">${order.phone || ""}</span><br>
        <span class="small">${order.address || ""}</span>
      </td>

      <td>
        ${order.items.map(i =>
          `<div class="small">${i.qty} × ${i.name}</div>`
        ).join("")}
      </td>

      <td>₹${order.total}</td>

      <td>
        <div><b>${order.payment?.method || "N/A"}</b></div>
        <div class="small">Txn: ${order.payment?.txn || "-"}</div>
        ${
          order.payment?.fileUrl
            ? `<img class="proof"
                   src="${order.payment.fileUrl}"
                   onclick="window.open('${order.payment.fileUrl}','_blank')">`
            : `<span class="small muted">No Screenshot</span>`
        }
      </td>

      <td class="status">${order.status}</td>

      <td>
        <button class="approve"
          onclick="updateStatus('${order.orderId}','Approved','${order.phone}','${order.total}')">
          Approve
        </button>
        <button class="reject"
          onclick="updateStatus('${order.orderId}','Rejected')">
          Reject
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ================= UPDATE STATUS =================
async function updateStatus(orderId, status, phone, total) {
  if (!confirm(`Mark order ${orderId} as ${status}?`)) return;

  try {
    const res = await fetch(
      `${API_BASE}/api/admin/orders/${orderId}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      }
    );

    const data = await res.json();
    if (data.success) {
      if (status === "Approved" && phone) {
        sendWhatsApp(phone, orderId, total);
      }
      loadOrders();
    } else {
      alert("Failed to update status");
    }
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}

// ================= WHATSAPP NOTIFY =================
function sendWhatsApp(phone, orderId, total) {
  const msg =
    `✅ Your order has been APPROVED!\n\n` +
    `Order ID: ${orderId}\n` +
    `Total: ₹${total}\n\n` +
    `Bhumika Medical\nThank you!`;

  const url = `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

// ================= CSV EXPORT =================
function exportCSV() {
  if (!ALL_ORDERS.length) {
    alert("No orders to export");
    return;
  }

  let csv = "OrderID,Name,Phone,Total,Status,PaymentMethod,TxnID\n";

  ALL_ORDERS.forEach(o => {
    csv += `"${o.orderId}","${o.name}","${o.phone}","${o.total}","${o.status}","${o.payment?.method || ""}","${o.payment?.txn || ""}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "orders.csv";
  link.click();
}

async function loadByDate() {
  const from = fromDate.value;
  const to = toDate.value;

  if (!from || !to) {
    alert("Select both dates");
    return;
  }

  const res = await fetch(
    `${BACKEND}/api/admin/orders-by-date?from=${from}&to=${to}`,
    {
      headers: {
        Authorization: "Bearer " + token
      }
    }
  );

  const data = await res.json();
  ORDERS = data.orders || [];
  updateDashboard();
  render();
}


// ================= INIT =================
loadOrders();
