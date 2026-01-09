// =======================================
// Bhumika Medical — Admin JS (FINAL)
// Orders + Products Add / Edit / Delete + Image Upload
// FAST LOAD + MOBILE SAFE
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

// 🔥 PERFORMANCE
let PRODUCT_PAGE = 1;
const PAGE_SIZE = 20;

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

/* =======================
   LOAD ORDERS
======================= */
async function loadOrders() {
  try {
    const res = await fetch(`${BACKEND}/api/admin/orders`, {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) return;

    ORDERS = data.orders || [];
    renderOrders();
  } catch {}
}

/* =======================
   RENDER ORDERS (DESKTOP)
======================= */
function renderOrders() {
  const q = document.getElementById("search").value.toLowerCase();
  const st = document.getElementById("statusFilter").value;

  ordersTable.innerHTML = "";

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
      <td>${o.status}</td>
      <td>
        <button onclick="updateStatus('${o.orderId}','Approved')">✓</button>
        <button onclick="updateStatus('${o.orderId}','Rejected')">✕</button>
      </td>
    `;
    ordersTable.appendChild(tr);
  });
}

/* =======================
   ORDER STATUS
======================= */
async function updateStatus(orderId, status) {
  await fetch(`${BACKEND}/api/admin/orders/${orderId}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ status })
  });
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
   LOAD PRODUCTS (FAST)
======================= */
async function loadProducts() {
  const res = await fetch(`${BACKEND}/api/admin/products`, {
    headers: { Authorization: "Bearer " + token }
  });
  const data = await res.json();
  if (!data.success) return;

  PRODUCTS = data.products;
  renderProductsPage(true);
}

/* =======================
   PAGINATED RENDER
======================= */
function renderProductsPage(reset = false) {
  if (reset) {
    PRODUCT_PAGE = 1;
    productListEl.innerHTML = "";
  }

  const start = (PRODUCT_PAGE - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const pageItems = PRODUCTS.slice(start, end);
  renderProductsAdmin(pageItems);

  if (end < PRODUCTS.length) {
    const btn = document.createElement("button");
    btn.textContent = "⬇ Load more";
    btn.style.margin = "12px auto";
    btn.style.display = "block";
    btn.onclick = () => {
      PRODUCT_PAGE++;
      btn.remove();
      renderProductsPage(false);
    };
    productListEl.appendChild(btn);
  }
}

/* =======================
   RENDER PRODUCTS (LIGHT)
======================= */
function renderProductsAdmin(list) {
  list.forEach(p => {
    const row = document.createElement("div");
    row.className = "product-row";
    row.dataset.id = p._id;

    row.innerHTML = `
      <img class="thumb" loading="lazy"
        src="${BACKEND}${p.image || '/img/placeholders/medicine.png'}">

      <input class="edit-name" value="${p.name}">
      <input class="edit-company" value="${p.company || ""}">
      <input class="edit-mrp" type="number" value="${p.mrp || 0}">

      <input type="file" class="img-input" accept="image/*">

      <button class="upload-btn">📸</button>
      <button class="save-btn">💾</button>
      <button class="del-btn">🗑️</button>
    `;

    // 🔍 Preview
    const imgInput = row.querySelector(".img-input");
    const imgEl = row.querySelector(".thumb");
    imgInput.addEventListener("change", e => {
      const f = e.target.files[0];
      if (f) imgEl.src = URL.createObjectURL(f);
    });

    productListEl.appendChild(row);
  });
}

/* =======================
   PRODUCT SEARCH (FAST)
======================= */
productSearchInput?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  const filtered = PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q)
  );
  PRODUCT_PAGE = 1;
  productListEl.innerHTML = "";
  PRODUCTS = filtered;
  renderProductsPage(true);
});

/* =======================
   PRODUCT ACTIONS
======================= */
productListEl.addEventListener("click", async e => {
  const row = e.target.closest(".product-row");
  if (!row) return;
  const id = row.dataset.id;

  // 📸 UPLOAD
  if (e.target.classList.contains("upload-btn")) {
    const file = row.querySelector(".img-input").files[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("image", file);

    await fetch(`${BACKEND}/api/admin/products/${id}/image`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: fd
    });
  }

  // 💾 SAVE
  if (e.target.classList.contains("save-btn")) {
    const body = {
      name: row.querySelector(".edit-name").value,
      company: row.querySelector(".edit-company").value,
      mrp: row.querySelector(".edit-mrp").value
    };

    await fetch(`${BACKEND}/api/admin/products/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(body)
    });
  }

  // 🗑️ DELETE
  if (e.target.classList.contains("del-btn")) {
    if (!confirm("Delete product?")) return;

    await fetch(`${BACKEND}/api/admin/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    });
    row.remove();
  }
});

/* =======================
   ADD PRODUCT
======================= */
async function addProduct() {
  if (!newName.value.trim()) return alert("Product name required");

  await fetch(`${BACKEND}/api/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      name: newName.value,
      company: newCompany.value,
      mrp: newMrp.value
    })
  });

  newName.value = "";
  newCompany.value = "";
  newMrp.value = "";

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
