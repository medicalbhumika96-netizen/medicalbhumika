// =======================================
// Bhumika Medical — Admin JS (ENTERPRISE FINAL)
// Orders + WhatsApp + Timeline + Audit + Stock
// =======================================

const BACKEND = "https://medicalbhumika-2.onrender.com";
const token = localStorage.getItem("adminToken");

// 🔐 Auth guard
if (!token) location.href = "admin-login.html";

/* =======================
   GLOBAL STATE
======================= */
let ORDERS = [];
let PRODUCTS = [];
let CURRENT_MODAL_ORDER = null;
let touchStartX = 0;
let touchMoved = false;
const STATUS_LOCK = new Set();

/* =======================
   STATUS FLOW
======================= */
const STATUS_FLOW = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Packed", "Rejected"],
  Packed: ["Out for Delivery"],
  "Out for Delivery": ["Delivered"],
  Delivered: [],
  Rejected: []
};

/* =======================
   DOM REFERENCES
======================= */
const ordersTable = document.getElementById("orders");
const mobileOrders = document.getElementById("mobileOrders");

const productListEl = document.getElementById("productList");
const productSearchInput = document.getElementById("productSearch");

const odId = document.getElementById("od-id");
const odCustomer = document.getElementById("od-customer");
const odItems = document.getElementById("od-items");
const odMrp = document.getElementById("od-mrp");
const odSave = document.getElementById("od-save");
const odStatus = document.getElementById("od-status");
const orderDetailModal = document.getElementById("orderDetailModal");

/* =======================
   LOAD ORDERS
======================= */
async function loadOrders() {
  const res = await fetch(`${BACKEND}/api/admin/orders`, {
    headers: { Authorization: "Bearer " + token }
  });
  const data = await res.json();
  if (!data.success) return alert("Failed to load orders");
  ORDERS = data.orders || [];
  updateDashboard();
  renderOrders();
}

/* =======================
   DASHBOARD
======================= */
function updateDashboard() {
  const today = new Date().toDateString();
  let todayOrders = 0, todayRevenue = 0, pending = 0;
  const customers = new Set();

  ORDERS.forEach(o => {
    if (new Date(o.createdAt).toDateString() === today) {
      todayOrders++;
      todayRevenue += Number(o.total || 0);
    }
    if (o.status === "Pending") pending++;
    if (o.phone) customers.add(o.phone);
  });

  todayOrdersEl.textContent = todayOrders;
  todayRevenueEl.textContent = "₹" + todayRevenue;
  pendingOrdersEl.textContent = pending;
  uniqueCustomersEl.textContent = customers.size;
}

/* =======================
   WHATSAPP
======================= */
const WHATSAPP_TEMPLATES = {
  Approved: o => `✅ Your order ${o.orderId} has been APPROVED.\n\n– Bhumika Medical`,
  Packed: o => `📦 Your order ${o.orderId} is PACKED.\n\n– Bhumika Medical`,
  "Out for Delivery": o => `🚚 Your order ${o.orderId} is OUT FOR DELIVERY.\n\n– Bhumika Medical`,
  Delivered: o => `🎉 Your order ${o.orderId} has been DELIVERED.\n\nThank you!\n– Bhumika Medical`,
  Rejected: o => `❌ Your order ${o.orderId} was rejected.\n\nPlease contact us.\n– Bhumika Medical`
};

function sendWhatsAppUpdate(order, status) {
  const tpl = WHATSAPP_TEMPLATES[status];
  if (!tpl || !order.phone) return;
  const phone = String(order.phone).replace(/\D/g, "");
  const msg = encodeURIComponent(tpl(order));
  window.open(`https://wa.me/91${phone}?text=${msg}`, "_blank");
}

/* =======================
   RENDER ORDERS
======================= */
function renderOrders() {
  const q = document.getElementById("search").value.toLowerCase();
  const st = document.getElementById("statusFilter").value;

  ordersTable.innerHTML = "";
  mobileOrders.innerHTML = "";

  ORDERS.filter(o =>
    (!st || o.status === st) &&
    (o.orderId.toLowerCase().includes(q) || o.phone.includes(q))
  ).forEach(o => {

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${o.orderId}</td>
      <td>${o.name}<br><small>${o.phone}</small></td>
      <td>${o.items.length}</td>
      <td>₹${o.total}</td>
      <td>${o.payment?.screenshot
        ? `<img src="${BACKEND}${o.payment.screenshot}" class="proof"
           onclick="showImg('${BACKEND}${o.payment.screenshot}')">`
        : "—"}</td>
      <td class="status ${o.status}">${o.status}</td>
      <td>
        ${STATUS_FLOW[o.status]?.includes("Approved") ? `<button onclick="updateStatus('${o.orderId}','Approved')">✓</button>` : ""}
        ${STATUS_FLOW[o.status]?.includes("Rejected") ? `<button onclick="updateStatus('${o.orderId}','Rejected')">✕</button>` : ""}
      </td>
    `;
    ordersTable.appendChild(tr);
  });
}

/* =======================
   STATUS UPDATE
======================= */
async function updateStatus(orderId, nextStatus) {
  const order = ORDERS.find(o => o.orderId === orderId);
  if (!order) return;

  if (!STATUS_FLOW[order.status]?.includes(nextStatus))
    return alert("Invalid status");

  if (STATUS_LOCK.has(orderId)) return;
  STATUS_LOCK.add(orderId);

  if (!confirm(`Change ${order.status} → ${nextStatus}?`)) {
    STATUS_LOCK.delete(orderId);
    return;
  }

  try {
    const res = await fetch(`${BACKEND}/api/admin/orders/${orderId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ status: nextStatus })
    });
    const data = await res.json();
    if (!data.success) throw new Error();

    order.statusLogs = order.statusLogs || [];
    order.statusLogs.push({
      from: order.status,
      to: nextStatus,
      by: "admin",
      at: new Date()
    });

    order.status = nextStatus;
    sendWhatsAppUpdate(order, nextStatus);
    renderOrders();
  } catch {
    alert("Status update failed");
  } finally {
    STATUS_LOCK.delete(orderId);
  }
}

/* =======================
   TIMELINE TIME
======================= */
function getStatusTime(order, status) {
  if (status === "Pending") {
    return new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const log = order.statusLogs?.find(l => l.to === status);
  return log ? new Date(log.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

/* =======================
   PRODUCT STOCK (PHASE 4)
======================= */
async function loadProducts() {
  const res = await fetch(`${BACKEND}/api/admin/products`, {
    headers: { Authorization: "Bearer " + token }
  });
  const data = await res.json();
  if (!data.success) return;
  PRODUCTS = data.products;
  renderProductsAdmin(PRODUCTS);
}

function renderProductsAdmin(list) {
  productListEl.innerHTML = "";

  list.forEach(p => {
    const row = document.createElement("div");
    row.className = "product-row";
    row.dataset.id = p._id;

    row.innerHTML = `
      <span class="p-name">${p.name}</span>
      <input type="number" class="stock-input" min="0" value="${p.stock || 0}" style="width:70px">
      <span class="stock-badge ${p.stock > 0 ? "in" : "out"}">
        ${p.stock > 0 ? "In Stock" : "Out"}
      </span>
      <button class="upload-btn">Save</button>
    `;
    productListEl.appendChild(row);
  });
}

productSearchInput?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  renderProductsAdmin(PRODUCTS.filter(p => p.name.toLowerCase().includes(q)));
});

productListEl?.addEventListener("click", async e => {
  const btn = e.target.closest(".upload-btn");
  if (!btn) return;

  const row = btn.closest(".product-row");
  const stock = row.querySelector(".stock-input").value;

  const res = await fetch(
    `${BACKEND}/api/admin/products/${row.dataset.id}/stock`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ stock })
    }
  );

  const data = await res.json();
  alert(data.success ? "Stock updated" : "Update failed");
});

/* =======================
   LOGOUT
======================= */
function logout() {
  localStorage.removeItem("adminToken");
  location.href = "admin-login.html";
}

/* =======================
   INIT
======================= */
document.getElementById("search").oninput = renderOrders;
document.getElementById("statusFilter").onchange = renderOrders;

loadOrders();
loadProducts();
/* =======================
   LOGOUT
======================= */
function logout() {
  localStorage.removeItem("adminToken");
  location.href = "admin-login.html";
}
