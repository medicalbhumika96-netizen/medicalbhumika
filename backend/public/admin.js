// =======================================
// Bhumika Medical — Admin JS (ENTERPRISE FINAL)
// Orders Workflow + WhatsApp + Timeline + Audit Log
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

// 🔒 status update lock
const STATUS_LOCK = new Set();

/* =======================
   STATUS FLOW (PRO)
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
  try {
    const res = await fetch(`${BACKEND}/api/admin/orders`, {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) return alert("Failed to load orders");

    ORDERS = data.orders || [];
    updateDashboard();
    renderOrders();
  } catch (err) {
    console.error(err);
    alert("Server error while loading orders");
  }
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

  document.getElementById("todayOrders").textContent = todayOrders;
  document.getElementById("todayRevenue").textContent = "₹" + todayRevenue;
  document.getElementById("pendingOrders").textContent = pending;
  document.getElementById("uniqueCustomers").textContent = customers.size;
}

/* =======================
   WHATSAPP TEMPLATES
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
        ? `<img src="${BACKEND}${o.payment.screenshot}" class="proof" onclick="showImg('${BACKEND}${o.payment.screenshot}')">`
        : "—"}</td>
      <td class="status ${o.status}">${o.status}</td>
      <td>
        ${STATUS_FLOW[o.status]?.includes("Approved") ? `<button onclick="updateStatus('${o.orderId}','Approved')">✓</button>` : ""}
        ${STATUS_FLOW[o.status]?.includes("Rejected") ? `<button onclick="updateStatus('${o.orderId}','Rejected')">✕</button>` : ""}
      </td>
    `;
    ordersTable.appendChild(tr);

    const card = document.createElement("div");
    card.className = "wa-order";
    card.onclick = () => openOrderDetail(o);
    card.innerHTML = `
      <b>${o.name}</b>
      <div>${o.phone}</div>
      <div>${o.status}</div>
    `;
    mobileOrders.appendChild(card);
  });
}

/* =======================
   SAFE STATUS UPDATE + AUDIT
======================= */
async function updateStatus(orderId, nextStatus) {
  const order = ORDERS.find(o => o.orderId === orderId);
  if (!order) return;

  const allowed = STATUS_FLOW[order.status] || [];
  if (!allowed.includes(nextStatus)) return alert("Invalid status");

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

    order.status = nextStatus;
    order.statusLogs = order.statusLogs || [];
    order.statusLogs.push({
      from: order.status,
      to: nextStatus,
      by: "admin",
      at: new Date()
    });

    sendWhatsAppUpdate(order, nextStatus);
    renderOrders();
  } catch {
    alert("Status update failed");
  } finally {
    STATUS_LOCK.delete(orderId);
  }
}

/* =======================
   STATUS TIME HELPER
======================= */
function getStatusTime(order, status) {
  if (status === "Pending") {
    return new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const log = order.statusLogs?.find(l => l.to === status);
  return log ? new Date(log.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

/* =======================
   ORDER DETAIL MODAL
======================= */
function openOrderDetail(order) {
  CURRENT_MODAL_ORDER = order;
  odId.textContent = order.orderId;
  odCustomer.innerHTML = `${order.name}<br>${order.phone}`;

  let mrp = 0;
  odItems.innerHTML = order.items.map(i => {
    mrp += (i.price || 0) * i.qty;
    return `<div>${i.qty} × ${i.name}</div>`;
  }).join("");

  odMrp.textContent = "₹" + mrp;
  odSave.textContent = "₹" + (mrp - order.total);

  odStatus.innerHTML = "";
  [order.status, ...(STATUS_FLOW[order.status] || [])].forEach(s => {
    const opt = document.createElement("option");
    opt.textContent = s;
    opt.value = s;
    odStatus.appendChild(opt);
  });

  const timelineEl = document.getElementById("od-timeline");
  if (timelineEl) {
    const steps = ["Pending", "Approved", "Packed", "Out for Delivery", "Delivered"];
    const idx = steps.indexOf(order.status);
    timelineEl.innerHTML = `
      <div class="timeline">
        ${steps.map((s, i) => `
          <div class="timeline-step ${i <= idx ? "done" : ""}">
            <div class="timeline-dot"></div>
            <div class="timeline-label">${s}</div>
            <div class="timeline-time">${getStatusTime(order, s)}</div>
          </div>
        `).join("")}
      </div>`;
  }

  const audit = document.getElementById("od-audit");
  if (audit) {
    audit.innerHTML = order.statusLogs?.length
      ? order.statusLogs.map(l => `${l.from} → ${l.to} (${new Date(l.at).toLocaleString()})`).join("<br>")
      : "<i>No status changes yet</i>";
  }

  orderDetailModal.classList.add("show");
}

function saveOrderStatus() {
  if (!CURRENT_MODAL_ORDER) return;
  updateStatus(CURRENT_MODAL_ORDER.orderId, odStatus.value);
  closeOrderDetail();
}

function closeOrderDetail() {
  orderDetailModal.classList.remove("show");
  CURRENT_MODAL_ORDER = null;
}

/* =======================
   IMAGE MODAL
======================= */
function showImg(src) {
  document.getElementById("modalImg").src = src;
  document.getElementById("modal").classList.add("show");
}
function closeModal() {
  document.getElementById("modal").classList.remove("show");
}

/* =======================
   INIT
======================= */
document.getElementById("search").oninput = renderOrders;
document.getElementById("statusFilter").onchange = renderOrders;

loadOrders();
