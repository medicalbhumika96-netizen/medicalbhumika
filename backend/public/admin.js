// =======================================
// Bhumika Medical — Admin JS (PRO FINAL)
// Orders Workflow + Products Image Upload
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
let REVIEWS = [];


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
  const month = new Date().getMonth();
  const year = new Date().getFullYear();

  let todayOrders = 0;
  let todayRevenue = 0;
  let monthRevenue = 0;

  let pending = 0;
  let rejected = 0;
  let cod = 0;
  let online = 0;

  let totalOrders = 0;
  let totalRevenue = 0;

  const customers = new Set();
  const productMap = {};

  ORDERS.forEach(o => {
    const d = new Date(o.createdAt);

    // ===== TODAY =====
    if (d.toDateString() === today) {
      todayOrders++;
      todayRevenue += Number(o.total || 0);
    }

    // ===== MONTH =====
    if (d.getMonth() === month && d.getFullYear() === year) {
      monthRevenue += Number(o.total || 0);
    }

    // ===== STATUS =====
    if (o.status === "Pending") pending++;
    if (o.status === "Rejected") rejected++;

    // ===== PAYMENT TYPE =====
    if (o.payment?.method?.toLowerCase().includes("cash")) cod++;
    else online++;

    // ===== GLOBAL =====
    totalOrders++;
    totalRevenue += Number(o.total || 0);

    // ===== CUSTOMERS =====
    if (o.phone) customers.add(o.phone);

    // ===== PRODUCT COUNT =====
    (o.items || []).forEach(i => {
      if (!productMap[i.name]) productMap[i.name] = 0;
      productMap[i.name] += i.qty;
    });
  });

  const avgOrder = totalOrders
    ? Math.round(totalRevenue / totalOrders)
    : 0;

  // ===== UPDATE UI =====
  document.getElementById("todayOrders").textContent = todayOrders;
  document.getElementById("todayRevenue").textContent = "₹" + todayRevenue;

  document.getElementById("pendingOrders").textContent = pending;
  document.getElementById("uniqueCustomers").textContent = customers.size;

  document.getElementById("codOrders").textContent = cod;
  document.getElementById("onlineOrders").textContent = online;
  document.getElementById("avgOrder").textContent = "₹" + avgOrder;
  document.getElementById("rejectedOrders").textContent = rejected;

  // ===== TOP PRODUCTS (console for now) =====
  const topProducts = Object.entries(productMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.table(topProducts.map(([name, qty]) => ({ Product: name, Qty: qty })));
}

const WHATSAPP_TEMPLATES = {
  Approved: order => 
    `✅ Your order ${order.orderId} has been APPROVED.\n\nWe are preparing your medicines.\n\n– Bhumika Medical`,

  Packed: order =>
    `📦 Your order ${order.orderId} is PACKED and ready for dispatch.\n\n– Bhumika Medical`,

  "Out for Delivery": order =>
    `🚚 Your order ${order.orderId} is OUT FOR DELIVERY.\n\nPlease keep your phone available.\n\n– Bhumika Medical`,

 Delivered: order =>
`🎉 Your order ${order.orderId} has been delivered.

⭐ Please rate your experience:
https://medicalbhumika-2.onrender.com/review/${order.orderId}

– Bhumika Medical`

,

  Rejected: order =>
    `❌ Your order ${order.orderId} was rejected.\n\nPlease contact us for details.\n\n– Bhumika Medical`
};
function sendWhatsAppUpdate(order, newStatus) {
  const tpl = WHATSAPP_TEMPLATES[newStatus];
  if (!tpl) return;

  const message = tpl(order);
  const phone = String(order.phone || "").replace(/\D/g, "");

  if (!phone) return;

  const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;

  // slight delay so admin sees confirmation first
  setTimeout(() => {
    window.open(url, "_blank");
  }, 300);
}

/* =======================
   RENDER ORDERS
======================= */
function renderOrders() {
  const q = document.getElementById("search").value.toLowerCase();
  const st = document.getElementById("statusFilter").value;

  ordersTable.innerHTML = "";
  mobileOrders.innerHTML = "";

  ORDERS
    .filter(o =>
      (!st || o.status === st) &&
      (o.orderId.toLowerCase().includes(q) || o.phone.includes(q))
    )
    .forEach(o => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${o.orderId}</td>
        <td>${o.name}<br><small>${o.phone}</small></td>
        <td>${o.items.length}</td>
        <td>₹${o.total}</td>
        <td>
          ${o.payment?.screenshot
          ? `<img src="${BACKEND}${o.payment.screenshot}" class="proof"
                 onclick="showImg('${BACKEND}${o.payment.screenshot}')">`
          : "—"}
        </td>
     <td>
  ${STATUS_FLOW[o.status]
    .map(next =>
      `<button
        style="margin:2px;padding:4px 6px;font-size:12px"
        onclick="updateStatus('${o.orderId}','${next}')">
        ${next}
      </button>`
    ).join("")}
</td>


      `;
      ordersTable.appendChild(tr);

      // MOBILE
      const card = document.createElement("div");
      card.className = "wa-order";
      card.ontouchstart = e => { touchStartX = e.changedTouches[0].clientX; touchMoved = false; };
      card.ontouchmove = e => { if (Math.abs(e.changedTouches[0].clientX - touchStartX) > 10) touchMoved = true; };
      card.ontouchend = e => handleSwipe(e, o.orderId);
      card.onclick = () => { if (!touchMoved) openOrderDetail(o); };

      card.innerHTML = `
        <div class="wa-left">
          <b>${o.name}</b>
          <div>${o.phone}</div>
          <div>Items: ${o.items.length}</div>
        </div>
        <div class="wa-right">
          ₹${o.total}
          <div class="status ${o.status}" id="m-${o.orderId}">
            ${o.status}
          </div>
        </div>
      `;
      mobileOrders.appendChild(card);
    });
}

/* =======================
   SAFE ORDER STATUS UPDATE
======================= */
async function updateStatus(orderId, nextStatus) {
  const order = ORDERS.find(o => o.orderId === orderId);
  if (!order) return;

  const allowed = STATUS_FLOW[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    alert(`Invalid status change: ${order.status} → ${nextStatus}`);
    return;
  }

  if (STATUS_LOCK.has(orderId)) return;
  STATUS_LOCK.add(orderId);

  const ok = confirm(
    `Confirm status change?\n\nOrder: ${order.orderId}\nFrom: ${order.status}\nTo: ${nextStatus}`
  );
  if (!ok) {
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
renderOrders();

// 🔔 Auto WhatsApp notification
sendWhatsAppUpdate(order, nextStatus);

  } catch {
    alert("Server error while updating status");
  } finally {
    STATUS_LOCK.delete(orderId);
  }
}

function handleSwipe(e, orderId) {
  const diff = e.changedTouches[0].clientX - touchStartX;
  if (!touchMoved || Math.abs(diff) < 60) return;
  if (diff > 0) updateStatus(orderId, "Approved");
  else updateStatus(orderId, "Rejected");
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
    const price = i.price || 0;
    mrp += price * i.qty;
    return `<div>${i.qty} × ${i.name} — ₹${price * i.qty}</div>`;
  }).join("");

  odMrp.textContent = "₹" + mrp;
  odSave.textContent = "₹" + (mrp - order.total);

  // 🔒 Allowed status only
  odStatus.innerHTML = "";
  [order.status, ...(STATUS_FLOW[order.status] || [])].forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    if (s === order.status) opt.selected = true;
    odStatus.appendChild(opt);
  });
  // ===== ORDER STATUS TIMELINE =====
    // ===== HORIZONTAL ORDER TIMELINE =====
  const timelineEl = document.getElementById("od-timeline");
  if (timelineEl) {
    const steps = ["Pending","Approved","Packed","Out for Delivery","Delivered"];
    const currentIndex = steps.indexOf(order.status);

    timelineEl.innerHTML = `
      <div class="timeline">
        ${steps.map((step, i) => `
          <div class="timeline-step
            ${i < currentIndex ? "done" : ""}
            ${i === currentIndex ? "active" : ""}
          ">
            <div class="timeline-dot"></div>
            <div class="timeline-label">${step}</div>
            <div class="timeline-time">${getStatusTime(order, step)}</div>
          </div>
          ${i < steps.length - 1
            ? `<div class="timeline-line ${i < currentIndex ? "done" : ""}"></div>`
            : ""}
        `).join("")}
      </div>
    `;
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
function getStatusTime(order, status) {
  // If backend doesn't store timestamps yet,
  // fallback to createdAt for first step only
  if (status === "Pending") {
    return new Date(order.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  return ""; // will be filled in Phase 3 (audit log)
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
   PRODUCTS IMAGE UPLOAD
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
      <input type="file" class="img-input" accept="image/*">
      <button class="upload-btn">Upload</button>
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
  const file = row.querySelector(".img-input").files[0];
  if (!file) return alert("Select image first");

  const fd = new FormData();
  fd.append("image", file);

  const res = await fetch(
    `${BACKEND}/api/admin/products/${row.dataset.id}/image`,
    { method: "POST", headers: { Authorization: "Bearer " + token }, body: fd }
  );
  const data = await res.json();
  alert(data.success ? "Image uploaded" : "Upload failed");
});

/* =======================
   TAB CONTROLLER
======================= */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "reviews") {
  loadReviews();
}

  });
});

async function loadReviews() {
  try {
    const res = await fetch(`${BACKEND}/api/reviews/admin/all`, {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) return;

    REVIEWS = data.reviews || [];
    renderReviews();
  } catch {
    console.error("Failed to load reviews");
  }
}


function renderReviews() {
  const tbody = document.getElementById("reviewTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  REVIEWS.forEach(r => {
    const tr = document.createElement("tr");

  tr.innerHTML = `
  <td data-label="Order ID">${r.orderId}</td>
  <td data-label="Rating">${"⭐".repeat(r.rating)}</td>
  <td data-label="Comment">${r.comment || "—"}</td>
  <td data-label="Status">${r.approved ? "Approved" : "Pending"}</td>
  <td data-label="Action">
    ${!r.approved
      ? `<button onclick="approveReview('${r._id}')">Approve</button>`
      : "—"}
  </td>
`;

    tbody.appendChild(tr);
  });
}
async function approveReview(id) {
  const ok = confirm("Approve this review?");
  if (!ok) return;

  try {
    const res = await fetch(`${BACKEND}/api/reviews/admin/${id}/approve`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json();
    if (!data.success) throw new Error();

    loadReviews();
  } catch {
    alert("Failed to approve review");
  }
}
const toggleBtn = document.getElementById("toggleViewBtn");

toggleBtn?.addEventListener("click", () => {
  document.body.classList.toggle("desktop-card-view");

  toggleBtn.textContent =
    document.body.classList.contains("desktop-card-view")
      ? "Table View"
      : "Card View";
});


/* =======================
   LOGOUT + INIT
======================= */
function logout() {
  localStorage.removeItem("adminToken");
  location.href = "admin-login.html";
}

document.getElementById("search").oninput = renderOrders;
document.getElementById("statusFilter").onchange = renderOrders;

loadOrders();
loadProducts();
