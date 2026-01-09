// =======================================
// Bhumika Medical — Admin JS (CLEAN FINAL)
// Orders + Products Image Upload
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
      // DESKTOP
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
        <td class="status ${o.status}" id="status-${o.orderId}">
          ${o.status}
        </td>
        <td>
          <button onclick="updateStatus('${o.orderId}','Approved')">✓</button>
          <button onclick="updateStatus('${o.orderId}','Rejected')">✕</button>
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
   ORDER ACTIONS
======================= */
async function updateStatus(orderId, status) {
  const res = await fetch(`${BACKEND}/api/admin/orders/${orderId}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (!data.success) return alert("Update failed");

  document.getElementById("status-" + orderId).textContent = status;
  const m = document.getElementById("m-" + orderId);
  if (m) m.textContent = status;
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
  odStatus.value = order.status;
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
   PRODUCTS (IMAGE UPLOAD)
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
  alert(data.success ? "✅ Image uploaded" : "❌ Upload failed");
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
