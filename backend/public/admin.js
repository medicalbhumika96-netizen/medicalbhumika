// =======================================
// Bhumika Medical — Admin JS (FINAL)
// =======================================

const BACKEND = "https://medicalbhumika-2.onrender.com";
const token = localStorage.getItem("adminToken");
const odId = document.getElementById("od-id");
const odCustomer = document.getElementById("od-customer");
const odItems = document.getElementById("od-items");
const odMrp = document.getElementById("od-mrp");
const odSave = document.getElementById("od-save");
const orderDetailModal = document.getElementById("orderDetailModal");
const odStatus = document.getElementById("od-status");
let CURRENT_MODAL_ORDER = null;



let touchStartX = 0;
let touchMoved = false;

// 🔐 Auth guard
if (!token) {
  location.href = "admin-login.html";
}

let ORDERS = [];

/* =======================================
   LOAD ORDERS
======================================= */
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

/* =======================================
   DASHBOARD METRICS
======================================= */
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

/* =======================================
   RENDER ORDERS (DESKTOP + MOBILE)
======================================= */
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

    /* ---------- DESKTOP ROW ---------- */
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

    
    /* =======================================
       ITEMS VIEW
    ======================================= */
    function viewItemsDesktop(items) {
      if (!items || !items.length) return alert("No items");
      alert(items.map(i => `${i.qty} × ${i.name}`).join("\n"));
    }

    /* =======================================
       STATUS UPDATE
    ======================================= */
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
    }

    /* =======================================
       IMAGE MODAL
    ======================================= */
    function showImg(src) {
      document.getElementById("modalImg").src = src;
      document.getElementById("modal").classList.add("show");
    }
    function closeModal() {
      document.getElementById("modal").classList.remove("show");
    }



    /* ---------- MOBILE CARD ---------- */
    if (mobileWrap) {
      const card = document.createElement("div");
      card.className = "wa-order";

      // ✅ SAFE SWIPE EVENTS
      card.ontouchstart = onTouchStart;
      card.ontouchmove = onTouchMove;
      card.ontouchend = (e) => onTouchEnd(e, o.orderId);

      // ✅ TAP = ORDER DETAIL (optional)
      card.onclick = () => {
        if (!touchMoved) {
          openOrderDetail(o);
        }
      };


      card.innerHTML = `
    <div class="wa-left">
      <div class="wa-name">${o.name}</div>

      <div class="wa-phone"
           onclick="event.stopPropagation(); callNow('${o.phone}')">
        📞 ${o.phone}
      </div>

      <div class="wa-items"
           onclick='event.stopPropagation(); viewItemsMobile(${JSON.stringify(o.items)})'>
        📦 Items: ${o.items.length}
      </div>
    </div>

    <div class="wa-right">
      <div class="wa-total">₹${o.total}</div>
      <div class="wa-status status ${o.status}"
           id="m-${o.orderId}">
        ${o.status}
      </div>
      <div style="margin-top:6px;cursor:pointer"
           onclick="event.stopPropagation(); openOrderWA('${o.phone}','${o.orderId}')">
        💬
      </div>
    </div>
  `;
      mobileWrap.appendChild(card);
    }
  }); // 👈 closes forEach
}   // 👈 closes renderOrders


/* =======================================
   ITEMS VIEW (DESKTOP + MOBILE)
======================================= */
function viewItemsDesktop(items) {
  if (!items || !items.length) {
    alert("No items found");
    return;
  }

  alert(
    "📦 ORDER ITEMS\n\n" +
    items.map(i => `${i.qty} × ${i.name}`).join("\n")
  );
}

function viewItemsMobile(items) {
  viewItemsDesktop(items);
}


/* =======================================
   STATUS UPDATE + WHATSAPP AUTO OPEN
======================================= */
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

    // 🟢 Desktop badge
    const badge = document.getElementById("status-" + orderId);
    if (badge) {
      badge.textContent = status;
      badge.className = "status " + status;
    }

    // 🟢 Mobile badge
    const mb = document.getElementById("m-" + orderId);
    if (mb) {
      mb.textContent = status;
      mb.className = "status " + status;
    }

    // 🔔 WhatsApp auto open
    if (data.waLink) {
      window.open(data.waLink, "_blank");
    }

  } catch (err) {
    console.error("Update status error:", err);
    alert("Server error while updating status");
  }
}

/* =======================================
   COMMUNICATION HELPERS
======================================= */
function openOrderWA(phone, orderId) {
  if (!phone) return;
  const msg = `Hello from Bhumika Medical\nOrder ID: ${orderId}`;
  window.open(
    `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
}

function callNow(phone) {
  if (phone) location.href = `tel:${phone}`;
}

/* =======================================
   IMAGE MODAL
======================================= */
function showImg(src) {
  document.getElementById("modalImg").src = src;
  document.getElementById("modal").classList.add("show");
}

function closeModal() {
  document.getElementById("modal").classList.remove("show");
}

/* =======================================
   EXPORT CSV
======================================= */
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

/* =======================================
   LOGOUT
======================================= */
function logout() {
  localStorage.removeItem("adminToken");
  location.href = "admin-login.html";
}

/* =======================================
   EVENTS + INIT
======================================= */
document.getElementById("search").oninput = renderOrders;
document.getElementById("statusFilter").onchange = renderOrders;

loadOrders();

function onTouchStart(e) {
  touchStartX = e.changedTouches[0].clientX;
  touchMoved = false;
}

function onTouchMove(e) {
  const diff = Math.abs(e.changedTouches[0].clientX - touchStartX);
  if (diff > 10) touchMoved = true;
}

function onTouchEnd(e, orderId) {
  const diff = e.changedTouches[0].clientX - touchStartX;

  // 👉 TAP (not swipe)
  if (!touchMoved || Math.abs(diff) < 60) {
    return; // tap behaviour handled separately
  }

  const card = e.currentTarget;

  // 👉 SWIPE RIGHT = APPROVE
  if (diff > 60) {
    card.classList.add("swipe-approve");
    navigator.vibrate?.([40, 30, 40]);
    updateStatus(orderId, "Approved");
  }

  // 👉 SWIPE LEFT = REJECT
  else if (diff < -60) {
    card.classList.add("swipe-reject");
    navigator.vibrate?.([100, 40, 100]);
    updateStatus(orderId, "Rejected");
  }

  // 🔄 RESET visual state
  setTimeout(() => {
    card.classList.remove("swipe-approve", "swipe-reject");
  }, 400);
}
function openOrderDetail(order) {
  if (!order) return;

  CURRENT_MODAL_ORDER = order;

  odId.textContent = "Order " + order.orderId;
  odCustomer.innerHTML = `👤 ${order.name}<br>📞 ${order.phone}`;

  let mrp = 0;
  let html = "";

  order.items.forEach(i => {
    const price = i.mrp || i.price || 0;
    const qty = i.qty || 1;
    const line = price * qty;
    mrp += line;

    html += `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <div>
          ${i.name}<br>
          <small>${qty} × ₹${price}</small>
        </div>
        <div>₹${line}</div>
      </div>
    `;
  });

  odItems.innerHTML = html;
  odMrp.textContent = "₹" + mrp;
  odSave.textContent = "₹" + (mrp - order.total);

  // 🔽 SET CURRENT STATUS
  odStatus.value = order.status;

  orderDetailModal.classList.add("show");
}
async function saveOrderStatus() {
  if (!CURRENT_MODAL_ORDER) return;

  await updateStatus(
    CURRENT_MODAL_ORDER.orderId,
    odStatus.value
  );

  closeOrderDetail();
}

function closeOrderDetail() {
  orderDetailModal.classList.remove("show");
  CURRENT_MODAL_ORDER = null;
}

const productListEl = document.getElementById("productList");
const productSearchInput = document.getElementById("productSearch");
let PRODUCTS = [];

// LOAD PRODUCTS
async function loadProducts() {
  try {
    const res = await fetch(`${BACKEND}/api/admin/products`, {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) return;

    PRODUCTS = data.products;
    renderProductsAdmin(PRODUCTS);
  } catch (e) {
    console.error("Product load error", e);
  }
}

// RENDER PRODUCTS
function renderProductsAdmin(list) {
  productListEl.innerHTML = "";

  list.forEach(p => {
    const row = document.createElement("div");
    row.className = "product-row";
    row.dataset.id = p._id;

    row.innerHTML = `
      <span class="p-name">${p.name}</span>

      <input type="file" class="img-input" accept="image/*">

      <button class="upload-btn">Upload Image</button>
    `;

    productListEl.appendChild(row);
  });
}

// SEARCH
productSearchInput?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  renderProductsAdmin(
    PRODUCTS.filter(p => p.name.toLowerCase().includes(q))
  );
});

// UPLOAD HANDLER (EVENT DELEGATION)
productListEl?.addEventListener("click", async e => {
  const btn = e.target.closest(".upload-btn");
  if (!btn) return;

  const row = btn.closest(".product-row");
  const fileInput = row.querySelector(".img-input");
  const productId = row.dataset.id;

  if (!fileInput.files[0]) {
    alert("Select image first");
    return;
  }

  const fd = new FormData();
  fd.append("image", fileInput.files[0]);

  const res = await fetch(
    `${BACKEND}/api/admin/products/${productId}/image`,
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: fd
    }
  );

  const data = await res.json();
  if (data.success) {
    alert("✅ Image uploaded");
  } else {
    alert("❌ Upload failed");
  }
});

// INIT
loadProducts();
