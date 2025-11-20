// ======================================================
// Bhumika Medical – Full Corrected script.js
// - ALL layout preserved
// - Mobile cart sheet working
// - updateMobileBadge fixed
// - aria-hidden warnings fixed
// - send-order button fixed
// - UPI QR fully working
// - WhatsApp checkout working
// - Backend integration fixed
// ======================================================

// ===== CONFIG =====
const MERCHANT_WHATSAPP_NUMBER = "+918003929804";
const SHOP_NAME = "Bhumika Medical";
const UPI_ID = "9892570250@okbizaxis";
const BACKEND_BASE = "https://medicalbhumika-2.onrender.com";

// ===== DOM LOOKUPS (SAFE) =====
const productList = document.getElementById("product-list");
const cartList = document.getElementById("cart-list");
const totalDisplay = document.getElementById("total");
const mobileSheet = document.getElementById("mobile-cart-sheet");
const mobileBtn = document.getElementById("mobile-cart-btn");
const mobileBadge = document.getElementById("mobile-cart-badge");
const mobileClose = document.getElementById("mobile-close-sheet");
const mobileContents = document.getElementById("mobile-cart-contents");
const mobileTotal = document.getElementById("mobile-sheet-total");
const mobileNext = document.getElementById("mobile-sheet-next");

const checkoutBtn = document.getElementById("checkout");
const clearBtn = document.getElementById("clear");

// checkout modal
const modal = document.getElementById("checkout-modal");
const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");
const toStep2Btn = document.getElementById("to-step-2");
const cancel1Btn = document.getElementById("cancel-1");
const backToStep1Btn = document.getElementById("back-to-step-1");
const sendOrderBtn =
  document.getElementById("send-order") || document.getElementById("pay-with-gpay");

// payment
const paymentMethodInput = document.getElementById("payment-method");
const qrCard = document.getElementById("qrCard");
const qrImage = document.getElementById("qrImage");
const qrLabel = document.getElementById("qrLabel");
const txnInput = document.getElementById("txnId");
const txnIdInput = document.getElementById("txnIdInput");
const amountInput = document.getElementById("amount");

// proof
const proofBtn = document.getElementById("submitProofBtn");
const screenshotUpload = document.getElementById("screenshotUpload");
const proofMsg = document.getElementById("proofMsg");

// customer details
const custNameInput = document.getElementById("cust-name");
const custAddressInput = document.getElementById("cust-address");
const custPinInput = document.getElementById("cust-pin");
const custPhoneInput = document.getElementById("cust-phone");

// result
const resultScreen = document.getElementById("result-screen");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const homeButton = document.getElementById("home-button");

// ===== STATE =====
let PRODUCTS = [];
let cart = {};
window.LAST_FINAL_TOTAL = 0;
window.LAST_ORDER_ID = null;

// ======================================================
// FIX 1: Define updateMobileBadge() so no errors occur
// ======================================================
function updateMobileBadge() {
  const badge = document.getElementById("mobile-cart-badge");
  if (!badge) return;

  const count = Object.keys(cart).reduce(
    (s, k) => s + (cart[k].qty || 0),
    0
  );

  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

// ======================================================
// LOAD PRODUCTS
// ======================================================
async function loadProducts() {
  try {
    const res = await fetch("products_with_images.json");
    const data = await res.json();

    PRODUCTS = (data.data || []).map((p, i) => ({
      id: i + 1,
      name: p.Product || `Product ${i + 1}`,
      company: p.Company || "Unknown",
      price: Number(p.MRP) || 0,
      image:
        p.Image ||
        "https://placehold.co/200x150?text=No+Image",
    }));
  } catch (err) {
    PRODUCTS = [
      {
        id: 1,
        name: "Paracetamol 500mg",
        company: "Generic",
        price: 40,
        image: "https://source.unsplash.com/400x300/?tablet",
      },
    ];
  }

  renderProducts();
}

// ======================================================
// RENDER PRODUCTS
// ======================================================
function renderProducts(query = "") {
  if (!productList) return;

  productList.innerHTML = "";
  const q = query.toLowerCase();

  const filtered = PRODUCTS.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.company.toLowerCase().includes(q)
  ).slice(0, 30);

  if (filtered.length === 0) {
    productList.innerHTML = `<div class="small muted">No products found.</div>`;
    return;
  }

  filtered.forEach((p) => {
    const div = document.createElement("div");
    div.className = "product";
    div.innerHTML = `
      <img src="${p.image}" alt="${p.name}" />
      <div style="flex:1">
        <div style="font-weight:700">${p.name}</div>
        <div class="small">${p.company}</div>
        <div class="price">₹${p.price.toFixed(2)}</div>
      </div>
      <button class="btn add-to-cart" data-id="${p.id}">Add</button>
    `;
    productList.appendChild(div);
  });

  // Attach add-to-cart
  productList.querySelectorAll(".add-to-cart").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = Number(btn.dataset.id);
      addToCart(id);

      if (isMobile()) openMobileCartSheet();
    });
  });
}

// ======================================================
// ADD TO CART
// ======================================================
function addToCart(id) {
  const item = PRODUCTS.find((x) => x.id === id);
  if (!item) return;

  if (!cart[id]) cart[id] = { ...item, qty: 0 };
  cart[id].qty++;

  renderCart();
}

// ======================================================
// CHANGE QTY
// ======================================================
function changeQty(id, delta) {
  if (!cart[id]) return;

  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];

  renderCart();
}
window.changeQty = changeQty;

// ======================================================
// RENDER CART (DESKTOP + MOBILE)
// ======================================================
function renderCart() {
  if (!cartList) return;

  cartList.innerHTML = "";
  const keys = Object.keys(cart);

  if (keys.length === 0) {
    cartList.innerHTML = `<div class="small">Cart is empty</div>`;

    if (totalDisplay) totalDisplay.textContent = "₹0.00";

    updateMobileBadge();
    renderMobileCart(0, 0, "");

    window.LAST_FINAL_TOTAL = 0;
    updateAmountInput(0);
    return;
  }

  let subtotal = 0;

  keys.forEach((id) => {
    const it = cart[id];

    subtotal += it.price * it.qty;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <div style="font-weight:700">${it.name}</div>
        <div class="small">₹${it.price} × ${it.qty} = ₹${(
      it.price * it.qty
    ).toFixed(2)}</div>
      </div>
      <div class="qty">
        <button onclick="changeQty(${id}, -1)">−</button>
        <div>${it.qty}</div>
        <button onclick="changeQty(${id}, 1)">+</button>
      </div>
    `;
    cartList.appendChild(row);
  });

  // discount rules
  let discount = 0;
  if (subtotal > 1500) discount = subtotal * 0.12;
  else if (subtotal > 550) discount = subtotal * 0.1;

  const finalTotal = subtotal - discount;

  if (totalDisplay)
    totalDisplay.textContent = "₹" + finalTotal.toFixed(2);

  window.LAST_FINAL_TOTAL = finalTotal;
  updateAmountInput(finalTotal);

  updateMobileBadge();
  renderMobileCart(subtotal, discount, discount > 0 ? "Offer applied" : "");
}
// ======================================================
// UPDATE AMOUNT INPUT (used for QR / payment)
// ======================================================
function updateAmountInput(amount) {
  if (!amountInput) return;
  amountInput.value = Number(amount).toFixed(2);
}

// ======================================================
// RENDER MOBILE CART
// ======================================================
function renderMobileCart(subtotal = 0, discount = 0, offerMsg = "") {
  if (!mobileContents || !mobileTotal) return;

  mobileContents.innerHTML = "";
  const keys = Object.keys(cart);

  if (keys.length === 0) {
    mobileContents.innerHTML = `<div class="mobile-empty small">Your cart is empty</div>`;
    mobileTotal.textContent = "₹0.00";
    return;
  }

  keys.forEach((k) => {
    const it = cart[k];

    const row = document.createElement("div");
    row.className = "mobile-cart-item";
    row.innerHTML = `
      <img src="${it.image}" alt="${it.name}">
      <div class="mobile-cart-info">
        <div class="title">${it.name}</div>
        <div class="meta">₹${it.price} × ${it.qty}</div>
        <div class="mobile-cart-line">₹${(
          it.price * it.qty
        ).toFixed(2)}</div>
        <div class="mobile-qty">
          <button onclick="changeQty(${it.id}, -1)">−</button>
          <div class="q">${it.qty}</div>
          <button onclick="changeQty(${it.id}, 1)">+</button>
        </div>
      </div>
    `;

    mobileContents.appendChild(row);
  });

  const total = Math.round(subtotal - discount);
  mobileTotal.textContent = "₹" + total.toFixed(2);
}

// ======================================================
// MOBILE CART SHEET CONTROLS — FIXED aria-hidden ERROR
// ======================================================
function openMobileCartSheet() {
  if (!mobileSheet) return;

  mobileSheet.style.display = "block";
  mobileSheet.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    mobileSheet.classList.add("show");
  }, 10);

  document.documentElement.style.overflow = "hidden";
}

function closeMobileCartSheet() {
  if (!mobileSheet) return;

  mobileSheet.classList.remove("show");
  mobileSheet.setAttribute("aria-hidden", "true");

  setTimeout(() => {
    mobileSheet.style.display = "";
    document.documentElement.style.overflow = "";
  }, 350);
}

// open/close handlers
if (mobileBtn) {
  mobileBtn.addEventListener("click", () => {
    if (mobileSheet.classList.contains("show")) {
      closeMobileCartSheet();
    } else {
      openMobileCartSheet();
    }
  });
}

if (mobileClose) mobileClose.addEventListener("click", closeMobileCartSheet);

if (mobileNext)
  mobileNext.addEventListener("click", () => {
    closeMobileCartSheet();
    checkoutBtn && checkoutBtn.click();
  });

// ======================================================
// CHECKOUT FLOW — STEP 1 → STEP 2
// ======================================================
if (checkoutBtn) {
  checkoutBtn.addEventListener("click", () => {
    if (Object.keys(cart).length === 0)
      return alert("Your cart is empty");
    openModalStep(1);
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    cart = {};
    renderCart();
  });
}

function openModalStep(stepNumber) {
  if (!modal) return;

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");

  if (stepNumber === 1) {
    step1.classList.remove("hidden");
    step2.classList.add("hidden");
  } else {
    step1.classList.add("hidden");
    step2.classList.remove("hidden");
  }
}

function closeModal() {
  if (!modal) return;

  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
}

// cancel
if (cancel1Btn) cancel1Btn.addEventListener("click", closeModal);

// back
if (backToStep1Btn)
  backToStep1Btn.addEventListener("click", () => openModalStep(1));

// next → payment
if (toStep2Btn) {
  toStep2Btn.addEventListener("click", () => {
    const name = custNameInput.value.trim();
    const address = custAddressInput.value.trim();
    const pin = custPinInput.value.trim();
    const phone = custPhoneInput.value.trim();

    if (!name) return alert("Enter full name");
    if (!address) return alert("Enter delivery address");
    if (!/^[0-9]{4,6}$/.test(pin)) return alert("Enter valid PIN");
    if (!/^[0-9]{6,15}$/.test(phone))
      return alert("Enter valid phone");

    openModalStep(2);
  });
}

// ======================================================
// PAYMENT LOGIC — UPI QR (FULLY FIXED)
// ======================================================
function updateQR() {
  const method = (paymentMethodInput.value || "").toLowerCase();
  const isCOD = method.includes("cash");
  const isOnline =
    method.includes("upi") ||
    method.includes("gpay") ||
    method.includes("paytm") ||
    method.includes("bank");

  if (isCOD) {
    qrCard?.classList.add("hidden");
    txnIdInput?.classList.add("hidden");
    amountInput?.classList.add("hidden");
    txnInput?.classList.add("hidden");
    return;
  }

  const total = window.LAST_FINAL_TOTAL || 0;
  if (!isOnline || total <= 0) {
    qrCard?.classList.add("hidden");
    return;
  }

  const amt = Number(total).toFixed(2);
  const upiURL =
    "upi://pay?pa=" +
    encodeURIComponent(UPI_ID) +
    "&pn=" +
    encodeURIComponent(SHOP_NAME) +
    "&am=" +
    encodeURIComponent(amt) +
    "&cu=INR";

  const qrSrc =
    "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" +
    encodeURIComponent(upiURL);

  if (qrImage) qrImage.src = qrSrc;

  if (qrLabel) {
    qrLabel.innerHTML = `
      <h3>Scan & Pay ₹${amt}</h3>
      <p>UPI ID: <b>${UPI_ID}</b></p>
      <small>Use GPay, PhonePe, Paytm or any UPI app</small>
    `;
  }

  qrCard?.classList.remove("hidden");
  txnIdInput?.classList.remove("hidden");
  txnInput?.classList.remove("hidden");
  amountInput?.classList.remove("hidden");
}

if (paymentMethodInput) {
  paymentMethodInput.addEventListener("change", updateQR);
}

// ======================================================
// SEND ORDER (WhatsApp + save to server + save local)
// ======================================================
if (sendOrderBtn) {
  sendOrderBtn.addEventListener("click", () => {
    const items = Object.values(cart);
    if (items.length === 0) return alert("Cart empty");

    const subtotal = items.reduce(
      (s, i) => s + i.price * i.qty,
      0
    );

    let discount = 0;
    if (subtotal > 1500) discount = subtotal * 0.12;
    else if (subtotal > 550) discount = subtotal * 0.1;

    const total = subtotal - discount;
    const name = custNameInput.value.trim();
    const address = custAddressInput.value.trim();
    const pin = custPinInput.value.trim();
    const phone = custPhoneInput.value.trim();

    const method = paymentMethodInput.value;
    const txnId =
      txnIdInput.value.trim() || txnInput.value.trim() || "";

    const timestamp = Date.now();
    const EID = `EID-${phone}-${timestamp}`;

    // save locally
    const orderData = {
      EID,
      phone,
      name,
      address,
      pin,
      items,
      total,
      discount,
      status: "Placed",
      date: new Date().toISOString(),
      payment: { method, txn: txnId },
    };

    const local = JSON.parse(localStorage.getItem("orders") || "[]");
    local.push(orderData);
    localStorage.setItem("orders", JSON.stringify(local));

    // save to server
    fetch(`${BACKEND_BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) window.LAST_ORDER_ID = res.orderId;
      })
      .catch(() => {});

    // WhatsApp Message
    const lines = [];
    lines.push(`🛒 *${SHOP_NAME}*`);
    lines.push(`🧾 *Order ID:* ${EID}`);
    lines.push("");
    lines.push("*Items:*");
    items.forEach((it) =>
      lines.push(`${it.qty}× ${it.name} — ₹${(it.price * it.qty).toFixed(2)}`)
    );
    lines.push("");
    lines.push(`*Total:* ₹${total.toFixed(2)}`);
    if (discount > 0)
      lines.push(`*You saved:* ₹${discount.toFixed(2)}`);
    lines.push("");
    lines.push("*Customer:*");
    lines.push(name);
    lines.push(address);
    lines.push("PIN: " + pin);
    lines.push("Phone: " + phone);
    lines.push("");
    lines.push("*Payment:* " + method);
    if (txnId) lines.push("Txn: " + txnId);

    const url =
      "https://wa.me/" +
      MERCHANT_WHATSAPP_NUMBER.replace(/\D/g, "") +
      "?text=" +
      encodeURIComponent(lines.join("\n"));

    window.open(url, "_blank");

    closeModal();
    showResult(true, `Order placed! Your Order ID: ${EID}`);

    cart = {};
    renderCart();
  });
}

// ======================================================
// SHOW RESULT MESSAGE
// ======================================================
function showResult(success, msg) {
  if (!resultScreen) return;

  resultTitle.textContent = success
    ? "✅ Order Placed Successfully"
    : "❌ Failed";

  resultMessage.textContent =
    msg || "We will deliver soon.";

  resultScreen.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (homeButton)
  homeButton.addEventListener("click", () => {
    resultScreen.classList.remove("active");
  });
// ======================================================
// PART 3/4
// - Order check feature
// - Prescription upload handler
// - Payment proof upload
// - Fly-to-cart animation
// - Slider controls + search suggestions
// ======================================================

// ===== ORDER CHECK (by EID or phone) =====
const checkOrderBtn = document.getElementById("check-order-btn");
const orderPhoneInput = document.getElementById("order-phone");
const orderResult = document.getElementById("order-status-result");

if (checkOrderBtn) {
  checkOrderBtn.addEventListener("click", () => {
    const q = (orderPhoneInput.value || "").trim();
    if (!q) {
      orderResult.textContent = "⚠️ Enter your Order ID (EID) or phone number.";
      return;
    }
    const all = JSON.parse(localStorage.getItem("orders") || "[]");
    if (!all.length) {
      orderResult.textContent = "❌ No orders found.";
      return;
    }
    const found = all.find(
      (o) => (o.EID && o.EID === q) || (o.phone && o.phone === q)
    );
    if (!found) {
      orderResult.textContent = "❌ No order found for that EID or phone number.";
      return;
    }

    let html = `<div style="margin-bottom:8px;font-weight:700;color:green">✅ Order found!</div>`;
    html += `<strong>Order ID:</strong> ${found.EID}<br>`;
    html += `<strong>Date:</strong> ${found.date}<br>`;
    html += `<strong>Name:</strong> ${escapeHtml(found.name)}<br>`;
    html += `<strong>Phone:</strong> ${escapeHtml(found.phone)}<br>`;
    html += `<strong>Address:</strong> ${escapeHtml(found.address)}<br>`;
    html += `<strong>PIN:</strong> ${escapeHtml(found.pin)}<br>`;
    html += `<strong>Status:</strong> ${escapeHtml(found.status)}<br>`;
    html += `<strong>Total:</strong> ₹${found.total}<br>`;
    if (found.discount) html += `<strong>Saved:</strong> ₹${Number(found.discount).toFixed(2)}<br>`;
    html += `<br><strong>Items:</strong><br>`;
    found.items.forEach((it) => {
      html += `${it.qty} × ${escapeHtml(it.name)} — ₹${(it.price * it.qty).toFixed(2)}<br>`;
    });

    orderResult.innerHTML = html;
  });
}

// ===== PRESCRIPTION UPLOAD HANDLER =====
const prescInput = document.getElementById("prescription-input");
if (prescInput) {
  prescInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return alert("Select a file first.");

    const form = new FormData();
    form.append("prescription", file);
    form.append("name", document.getElementById("presc-name")?.value || "");
    form.append("phone", document.getElementById("presc-phone")?.value || "");
    form.append("address", document.getElementById("presc-address")?.value || "");

    try {
      const res = await fetch(`${BACKEND_BASE}/upload-prescription`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data && data.fileUrl) {
        alert("✅ Prescription uploaded.");
        document.getElementById("uploaded-url").value = data.fileUrl;
        document.getElementById("send-prescription-btn").style.display = "block";
        // store reference
        prescriptionData = { name: file.name, url: data.fileUrl };
      } else {
        alert("❌ Upload failed.");
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("⚠️ Upload error.");
    }
  });
}

// send prescription via whatsapp
const sendPrescBtn = document.getElementById("send-prescription-btn");
if (sendPrescBtn) {
  sendPrescBtn.addEventListener("click", () => {
    const url = document.getElementById("uploaded-url").value || "";
    const name = document.getElementById("presc-name").value || "";
    const phone = document.getElementById("presc-phone").value || "";
    const address = document.getElementById("presc-address").value || "";

    const lines = [];
    lines.push(`Hello ${SHOP_NAME},`);
    lines.push("");
    lines.push(`Customer Name: ${name}`);
    lines.push(`Phone: ${phone}`);
    lines.push(`Address: ${address}`);
    lines.push(`Prescription: ${url}`);

    const waUrl = `https://wa.me/${MERCHANT_WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(waUrl, "_blank");
  });
}

// ===== PAYMENT PROOF SUBMIT (uploads to backend) =====
async function submitPaymentProof(txnId, file) {
  const fd = new FormData();
  fd.append("txnId", txnId || "");
  fd.append("orderId", window.LAST_ORDER_ID || "");
  if (file) fd.append("screenshot", file);

  try {
    const r = await fetch(`${BACKEND_BASE}/api/payment-proof`, {
      method: "POST",
      body: fd,
    });
    return await r.json();
  } catch (e) {
    console.warn("Payment proof upload failed", e);
    return null;
  }
}

if (proofBtn) {
  proofBtn.addEventListener("click", async () => {
    const txnVal = (txnInput && txnInput.value.trim()) || (txnIdInput && txnIdInput.value.trim()) || "";
    const file = screenshotUpload && screenshotUpload.files && screenshotUpload.files[0] ? screenshotUpload.files[0] : null;

    if (!txnVal && !file) {
      if (proofMsg) {
        proofMsg.textContent = "⚠️ Enter UPI transaction ID or upload screenshot.";
        proofMsg.style.color = "red";
      } else alert("Enter Txn ID or upload screenshot.");
      return;
    }

    if (proofMsg) {
      proofMsg.textContent = "Uploading proof...";
      proofMsg.style.color = "black";
    }

    const res = await submitPaymentProof(txnVal, file);
    if (res && res.success) {
      if (proofMsg) { proofMsg.textContent = "✅ Proof submitted. We'll verify."; proofMsg.style.color = "green"; }
      else alert("Proof submitted");
    } else {
      if (proofMsg) { proofMsg.textContent = "❌ Upload failed."; proofMsg.style.color = "red"; }
      else alert("Upload failed");
    }

    if (txnInput) txnInput.value = "";
    if (txnIdInput) txnIdInput.value = "";
    if (screenshotUpload) screenshotUpload.value = "";
  });
}

// ===== FLY-TO-CART ANIMATION (GRACEFUL) =====
function animateAddToCart(e, imgEl) {
  try {
    if (!imgEl) return;
    const imgRect = imgEl.getBoundingClientRect();
    const cartSideEl = document.getElementById("cart-side") || document.querySelector(".cart-side");
    const cartRect = cartSideEl ? cartSideEl.getBoundingClientRect() : { left: window.innerWidth - 80, top: 80 };

    const fly = imgEl.cloneNode(true);
    fly.className = "flying";
    fly.style.position = "fixed";
    fly.style.left = imgRect.left + "px";
    fly.style.top = imgRect.top + "px";
    fly.style.width = imgRect.width + "px";
    fly.style.height = imgRect.height + "px";
    fly.style.zIndex = 9999;
    document.body.appendChild(fly);

    const tx = (cartRect.left + 20) - imgRect.left;
    const ty = (cartRect.top + 20) - imgRect.top;

    requestAnimationFrame(() => {
      fly.style.transition = "transform 700ms cubic-bezier(.2,.8,.2,1), opacity 600ms";
      fly.style.transform = `translate(${tx}px, ${ty}px) scale(.2)`;
      fly.style.opacity = "0.05";
    });

    setTimeout(() => fly.remove(), 800);
  } catch (e) {
    console.warn("animation failed", e);
  }
}

// ===== SLIDER CONTROLS (unchanged semantics) =====
const slider = document.getElementById("hero-slider");
const slides = slider ? Array.from(slider.querySelectorAll(".slide")) : [];
let slideIndex = 0;
let sliderTimer = null;

function showSlide(idx) {
  if (!slides.length) return;
  slides.forEach((s, i) => {
    s.classList.toggle("active", i === idx);
    const visual = s.querySelector(".slide-visual");
    const url = s.dataset.img;
    if (visual && url) {
      if (!visual.querySelector(".bg-img")) {
        const el = document.createElement("div");
        el.className = "bg-img";
        el.style.backgroundImage = `url('${url}')`;
        visual.appendChild(el);
      } else {
        visual.querySelector(".bg-img").style.backgroundImage = `url('${url}')`;
      }
    }
  });

  // dots
  const dots = document.getElementById("slider-dots");
  if (dots) {
    dots.innerHTML = "";
    slides.forEach((s, i) => {
      const btn = document.createElement("button");
      btn.className = i === idx ? "dot active" : "dot";
      btn.addEventListener("click", () => {
        slideIndex = i;
        restartSlider();
        showSlide(i);
      });
      dots.appendChild(btn);
    });
  }
}
function nextSlide() { if (slides.length) { slideIndex = (slideIndex + 1) % slides.length; showSlide(slideIndex); } }
function prevSlide() { if (slides.length) { slideIndex = (slideIndex - 1 + slides.length) % slides.length; showSlide(slideIndex); } }
function restartSlider() { clearInterval(sliderTimer); sliderTimer = setInterval(nextSlide, 4800); }
document.getElementById("next-slide")?.addEventListener("click", () => { nextSlide(); restartSlider(); });
document.getElementById("prev-slide")?.addEventListener("click", () => { prevSlide(); restartSlider(); });
if (slides.length) { showSlide(0); restartSlider(); }

// ===== NAV SEARCH SUGGESTIONS (light) =====
const suggestionsBox = document.getElementById("search-suggestions");
const navSearch = document.getElementById("nav-search");

if (navSearch && suggestionsBox) {
  navSearch.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      suggestionsBox.classList.remove("active");
      suggestionsBox.innerHTML = "";
      return;
    }
    const matches = PRODUCTS.filter((p) => p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q)).slice(0, 5);
    if (!matches.length) {
      suggestionsBox.classList.remove("active");
      suggestionsBox.innerHTML = "";
      return;
    }
    suggestionsBox.innerHTML = matches.map(p => `<div class="suggestion-item" data-id="${p.id}">${p.name} — <span style="color:var(--muted)">${p.company}</span></div>`).join("");
    suggestionsBox.classList.add("active");
  });

  suggestionsBox.addEventListener("click", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (!item) return;
    const id = Number(item.dataset.id);
    const product = PRODUCTS.find(p => p.id === id);
    if (product) {
      navSearch.value = product.name;
      renderProducts(product.name);
      document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
    }
    suggestionsBox.classList.remove("active");
  });

  document.addEventListener("click", (e) => {
    if (!suggestionsBox.contains(e.target) && e.target !== navSearch) {
      suggestionsBox.classList.remove("active");
    }
  });
}
// ======================================================
// PART 4/4 — FINAL INITIALIZATION
// ======================================================

// Escape HTML utility (used in order status)
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// utility — detect mobile
function isMobile() {
  return window.innerWidth < 768;
}

// ======================================================
// INITIALIZE EVERYTHING
// ======================================================
loadProducts();     // Load all products from JSON
renderCart();       // Render empty cart UI initially
updateMobileBadge(); // Initialize badge to 0

// Recalculate QR whenever cart values change
setInterval(() => {
  updateQR();
}, 1000);

// Prevent background scroll when modal is open (optional)
document.addEventListener("click", (e) => {
  if (modal && modal.style.display === "flex") {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
});

// Prevent scroll leak when mobile sheet is open
document.addEventListener("touchmove", (e) => {
  if (mobileSheet && mobileSheet.classList.contains("show")) {
    e.preventDefault();
  }
}, { passive: false });

console.log("%cBhumika Medical script loaded successfully 🟢",
  "color:#0a0;font-weight:700;font-size:14px");
