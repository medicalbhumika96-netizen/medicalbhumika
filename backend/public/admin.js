// =======================================
// Bhumika Medical — Admin JS (FINAL)
// Orders + Products Add / Edit / Delete + Image Upload + UI Polish
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

const newName = document.getElementById("new-name");
const newCompany = document.getElementById("new-company");
const newMrp = document.getElementById("new-mrp");

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
  } catch {
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
      <td>
        ${o.payment?.screenshot
          ? `<img src="${BACKEND}${o.payment.screenshot}" class="proof"
               onclick="showImg('${BACKEND}${o.payment.screenshot}')">`
          : "—"}
      </td>
      <td class="status ${o.status}">
        ${o.status}
      </td>
      <td>
        <button onclick="updateStatus('${o.orderId}','Approved')">✓</button>
        <button onclick="updateStatus('${o.orderId}','Rejected')">✕</button>
      </td>
    `;
    ordersTable.appendChild(tr);
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
  if (!data.success) alert("Update failed");
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
   PRODUCTS — LOAD
======================= */
async function loadProducts() {
  const res = await fetch(`${BACKEND}/api/admin/products`, {
    headers: { Authorization: "Bearer " + token }
  });
  const data = await res.json();
  if (!data.success) return alert("Products load failed");

  PRODUCTS = data.products;
  renderProductsAdmin(PRODUCTS);
}

/* =======================
   PRODUCTS — RENDER (UI POLISHED)
======================= */
function renderProductsAdmin(list) {
  productListEl.innerHTML = "";

  list.forEach(p => {
    const row = document.createElement("div");
    row.className = "product-row";
    row.dataset.id = p._id;

    row.innerHTML = `
      <img class="thumb" src="${BACKEND}${p.image || '/img/placeholders/medicine.png'}">

      <input class="edit-name" value="${p.name}">
      <input class="edit-company" value="${p.company || ""}">
      <input class="edit-mrp" type="number" value="${p.mrp || 0}">

      <input type="file" class="img-input" accept="image/*">

      <button class="upload-btn">📸</button>
      <button class="save-btn">💾</button>
      <button class="del-btn">🗑️</button>
    `;

    // 🔍 Live preview before upload
    const imgInput = row.querySelector(".img-input");
    const imgEl = row.querySelector(".thumb");
    imgInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (file) imgEl.src = URL.createObjectURL(file);
    });

    productListEl.appendChild(row);
  });
}

/* =======================
   PRODUCT SEARCH
======================= */
productSearchInput?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  renderProductsAdmin(PRODUCTS.filter(p => p.name.toLowerCase().includes(q)));
});

/* =======================
   PRODUCT ACTIONS
======================= */
productListEl.addEventListener("click", async e => {
  const row = e.target.closest(".product-row");
  if (!row) return;
  const id = row.dataset.id;

  // 📸 IMAGE UPLOAD
  if (e.target.classList.contains("upload-btn")) {
    const file = row.querySelector(".img-input").files[0];
    if (!file) return alert("Select image");

    const fd = new FormData();
    fd.append("image", file);

    const res = await fetch(`${BACKEND}/api/admin/products/${id}/image`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: fd
    });
    const data = await res.json();
    alert(data.success ? "✅ Image uploaded" : "❌ Upload failed");
  }

  // 💾 SAVE
  if (e.target.classList.contains("save-btn")) {
    const name = row.querySelector(".edit-name").value;
    const company = row.querySelector(".edit-company").value;
    const mrp = row.querySelector(".edit-mrp").value;

    const res = await fetch(`${BACKEND}/api/admin/products/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ name, company, mrp })
    });
    const data = await res.json();
    alert(data.success ? "✅ Updated" : "❌ Update failed");
  }

  // 🗑️ DELETE
  if (e.target.classList.contains("del-btn")) {
    if (!confirm("Delete this product?")) return;

    const res = await fetch(`${BACKEND}/api/admin/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (data.success) {
      row.remove();
      alert("🗑️ Deleted");
    }
  }
});

/* =======================
   ADD PRODUCT
======================= */
async function addProduct() {
  const name = newName.value.trim();
  const company = newCompany.value.trim();
  const mrp = newMrp.value;

  if (!name) return alert("Product name required");

  const res = await fetch(`${BACKEND}/api/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ name, company, mrp })
  });

  const data = await res.json();
  if (!data.success) return alert(data.message || "Add failed");

  newName.value = "";
  newCompany.value = "";
  newMrp.value = "";

  alert("✅ Product added");
  loadProducts();
}

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
