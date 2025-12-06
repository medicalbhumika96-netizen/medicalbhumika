// -----------------------------
// script.js (complete version)
// - Preserves your UI, IDs, and behavior
// - Adds backend integration for manual verification
// - Backend host: https://medicalbhumika-2.onrender.com
// -----------------------------

// ===== CONFIG =====
const MERCHANT_WHATSAPP_NUMBER = '+918003929804';
const SHOP_NAME = 'Bhumika Medical';
const UPI_ID = '9892570250@okbizaxis'; // dynamic QR UPI id

// backend base (Render host you already use for prescription upload)
const BACKEND_BASE = "https://medicalbhumika-2.onrender.com";


// ===== DOM refs / safe guards =====
const productList = document.getElementById('product-list');
const cartList = document.getElementById('cart-list');
const totalDisplay = document.getElementById('total');
const searchInput = document.getElementById('search');
const navSearchInput = document.getElementById('nav-search');
const navSearchForm = document.getElementById('nav-search-form');

const modal = document.getElementById('checkout-modal');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const stepIndicators = document.querySelectorAll('.step');

const toStep2Btn = document.getElementById('to-step-2');
const cancel1Btn = document.getElementById('cancel-1');
const backToStep1Btn = document.getElementById('back-to-step-1');
const sendOrderBtn = document.getElementById('send-order');

const qrCard = document.getElementById('qrCard');
const qrImage = document.getElementById('qrImage');

const resultScreen = document.getElementById('result-screen');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const resultAnimation = document.getElementById('result-animation');
const homeButton = document.getElementById('home-button');
const retryButton = document.getElementById('retry-button');

const cartCountEl = document.getElementById('cart-count');

// customer fields
const custNameInput = document.getElementById('cust-name'); 
const custAddressInput = document.getElementById('cust-address');
const custPinInput = document.getElementById('cust-pin');
const custPhoneInput = document.getElementById('cust-phone');

// payment fields
const paymentMethodInput = document.getElementById('payment-method');
const txnInput = document.getElementById('txnId');            // used in UI
const txnIdInput = document.getElementById('txnIdInput');    // alternate id (some templates)
const amountInput = document.getElementById('amount');

// manual proof fields (IDs from your code)
const proofBtn = document.getElementById('submitProofBtn');
const screenshotUpload = document.getElementById('screenshotUpload');
const proofMsg = document.getElementById('proofMsg');

// nav toggler & slider
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.querySelector('.nav-links');
const slider = document.getElementById('hero-slider');
const slides = slider ? Array.from(slider.querySelectorAll('.slide')) : [];
let slideIndex = 0;
let sliderTimer = null;

// ===== STATE =====
let PRODUCTS = [];
let cart = {};
let prescriptionData = null;
window.LAST_FINAL_TOTAL = 0; // accessible globally for QR updates
window.LAST_ORDER_ID = null; // set after server save

// set shop name & phone
document.querySelectorAll('.brand-name').forEach(el => el.textContent = SHOP_NAME);
document.getElementById('cfg-phone') && (document.getElementById('cfg-phone').textContent = MERCHANT_WHATSAPP_NUMBER);

// ===== HELPERS =====
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }
function isMobileViewport() { return window.innerWidth < 768; }

// ===== LOAD PRODUCTS (from JSON or fallback) =====
async function loadProducts() {
  try {
    const res = await fetch('products_with_images.json');
    const data = await res.json();
    PRODUCTS = data.data.map((item, index) => ({
      id: index + 1,
      name: item.Product || `Product ${index+1}`,
      company: item.Company || 'Unknown',
      price: Number(item.MRP) || 0,
      image: item.Image || 'https://placehold.co/160x120?text=No+Image'
    }));
  } catch (err) {
    console.warn('Could not load products_with_images.json — using fallback sample products.', err);
    PRODUCTS = [
      {id:1,name:'Paracetamol 500mg (10 tablets)',company:'Generic',price:40,image:'https://source.unsplash.com/400x300/?tablet,medicine'},
      {id:2,name:'Cough Syrup 100ml',company:'HealthCo',price:120,image:'https://source.unsplash.com/400x300/?syrup,medicine'},
      {id:3,name:'Vitamin C 500mg',company:'NutriLife',price:220,image:'https://source.unsplash.com/400x300/?vitamin,health'}
    ];
  }
  renderProducts();
}

function renderProducts(filter = '') {
  if (!productList) return;
  productList.innerHTML = '';

  const q = (filter || '').trim().toLowerCase();

  // Filter products based on name/company
  let filtered = PRODUCTS.filter(p =>
    !q || p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q)
  );

  // Show only first 30 results
  const displayLimit = 30;
  const limitedResults = filtered.slice(0, displayLimit);

  limitedResults.forEach(p => {
    const el = document.createElement('div');
    el.className = 'product';
    el.innerHTML = `
      <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
      <div style="flex:1">
        <div style="font-weight:700">${escapeHtml(p.name)}</div>
        <div class="small" style="margin-top:6px">${escapeHtml(p.company)}</div>
        <div class="price">₹${p.price.toFixed(2)}</div>
      </div>
      <button class="btn add-to-cart" data-id="${p.id}">Add</button>
    `;
    productList.appendChild(el);
  });

  // Show message if more results exist
  if (filtered.length > displayLimit) {
    const msg = document.createElement('div');
    msg.className = 'muted small';
    msg.style.margin = '10px 0';
    msg.textContent = `Showing top ${displayLimit} of ${filtered.length} results — refine your search to see more.`;
    productList.appendChild(msg);
  }

  // Handle no results
  if (limitedResults.length === 0) {
    productList.innerHTML = '<div class="muted small">No products found.</div>';
  }

  // Reattach Add button event listeners
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = Number(e.target.dataset.id);
      const product = PRODUCTS.find(p => p.id == id);
      if (!product) return;
      addToCart(product.id);
      const productEl = e.target.closest('.product');
      const imgEl = productEl ? productEl.querySelector('img') : null;
      animateAddToCart(e, imgEl);
      if (isMobileViewport()) openMobileCartSheet();
    });
  });
}

// Use event delegation for Add buttons so they always work
if (productList) {
  productList.addEventListener('click', function (e) {
    const btn = e.target.closest('.add, .add-to-cart');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (!id) return console.warn('Add button missing data-id');
    addToCart(id);
    const productEl = btn.closest('.product');
    const imgEl = productEl ? productEl.querySelector('img') : null;
    animateAddToCart(e, imgEl);
    if (isMobileViewport()) openMobileCartSheet();
  });
}

// ===== CART =====
function addToCart(id) {
  const p = PRODUCTS.find(x => x.id === id) || (typeof id === 'object' ? id : null);
  if (!p) return;
  const pid = typeof id === 'object' ? p.id : id;
  const prod = typeof id === 'object' ? p : PRODUCTS.find(x => x.id === pid);
  if (!prod) return;
  if (!cart[prod.id]) cart[prod.id] = { ...prod, qty: 0 };
  cart[prod.id].qty++;
  renderCart();
}
function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  renderCart();
}
window.changeQty = changeQty;

// ===== CART (with DISCOUNT LOGIC & mobile sync) =====
function renderCart() {
  if (!cartList) return;
  cartList.innerHTML = '';
  let subtotal = 0;
  const keys = Object.keys(cart);

  // Empty cart
  if (keys.length === 0) {
    cartList.innerHTML = '<div class="small">Cart is empty</div>';
    totalDisplay && (totalDisplay.textContent = '₹0.00');
    document.querySelector('.cart-offer')?.remove();
    updateMobileCartBadge();
    updateFloatingCartCount();
    renderMobileCart(0, 0, '');
    window.LAST_FINAL_TOTAL = 0;
    updateQRForTotal(0);
    return;
  }

  // Build cart items
  keys.forEach(id => {
    const it = cart[id];
    subtotal += it.price * it.qty;
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <div>
        <div style="font-weight:700">${escapeHtml(it.name)}</div>
        <div class="small">₹${it.price} × ${it.qty} = ₹${(it.price * it.qty).toFixed(2)}</div>
      </div>
      <div class="qty">
        <button onclick="changeQty(${id}, -1)">−</button>
        <div>${it.qty}</div>
        <button onclick="changeQty(${id}, 1)">+</button>
      </div>
    `;
    cartList.appendChild(el);
  });

  // ===== APPLY DISCOUNT RULES =====
  let discount = 0;
  let offerMsg = '';

  if (subtotal > 1500) {
    discount = subtotal * 0.12;
    offerMsg = '🌟 Best offer unlocked!';
  } else if (subtotal > 550) {
    discount = subtotal * 0.10;
    offerMsg = '🎉 Special offer applied!';
  }

  // ===== CALCULATE FINAL TOTAL =====
  let finalTotal = subtotal - discount;

  // Update total display
  totalDisplay && (totalDisplay.textContent = '₹' + finalTotal.toFixed(2));

  // Store globally for payment integrations
  window.LAST_FINAL_TOTAL = finalTotal;

  // Update offer message (optional)
  const offerEl = document.querySelector('.cart-offer');
  if (offerMsg) {
    if (offerEl) offerEl.textContent = offerMsg;
    else {
      const newOffer = document.createElement('div');
      newOffer.className = 'cart-offer';
      newOffer.textContent = offerMsg;
      cartList.parentNode.insertBefore(newOffer, cartList.nextSibling);
    }
  } else {
    offerEl?.remove();
  }

  // Update mobile cart and QR
  updateMobileCartBadge();
  updateFloatingCartCount();
  renderMobileCart(subtotal, discount, offerMsg);
  updateQRForTotal(finalTotal);

  // Show offer message under total (desktop)
  document.querySelector('.cart-offer')?.remove();
  if (offerMsg) {
    const offerEl2 = document.createElement('div');
    offerEl2.className = 'cart-offer small';
    offerEl2.style.marginTop = '6px';
    offerEl2.style.color = 'var(--accent-dark)';
    offerEl2.style.fontWeight = '600';
    offerEl2.style.cursor = 'pointer';
    offerEl2.textContent = offerMsg + ' (Tap to view savings)';
    offerEl2.addEventListener('click', () => {
      const saved = discount.toFixed(2);
      alert(`💰 You saved ₹${saved} on this order!`);
    });
    totalDisplay && totalDisplay.parentElement && totalDisplay.parentElement.insertAdjacentElement('afterend', offerEl2);
  }

  // Update item count
  cartCountEl && (cartCountEl.textContent = keys.reduce((s, k) => s + cart[k].qty, 0));
}

// ===== UPDATE MOBILE CART (list, total, offer) =====
function renderMobileCart(subtotal = 0, discount = 0, offerMsg = '') {
  const productContainer = document.getElementById('mobile-cart-contents');
  const totalEl = document.getElementById('mobile-sheet-total');
  if (!productContainer || !totalEl) return;

  productContainer.innerHTML = '';
  const keys = Object.keys(cart);

  if (keys.length === 0) {
    productContainer.innerHTML = '<div class="mobile-empty small">Your cart is empty</div>';
    totalEl.textContent = '₹0.00';
    document.querySelectorAll('.cart-offer-mobile').forEach(el => el.remove());
    return;
  }

  keys.forEach(id => {
    const it = cart[id];
    const item = document.createElement('div');
    item.className = 'mobile-cart-item';
    item.innerHTML = `
      <img src="${it.image}" alt="${escapeHtml(it.name)}">
      <div class="mobile-cart-info">
        <div class="title">${escapeHtml(it.name)}</div>
        <div class="meta">₹${it.price} × ${it.qty}</div>
        <div class="mobile-cart-line">₹${(it.price * it.qty).toFixed(2)}</div>
        <div class="mobile-qty">
          <button onclick="changeQty(${id}, -1)">−</button>
          <div class="q">${it.qty}</div>
          <button onclick="changeQty(${id}, 1)">+</button>
        </div>
      </div>  
    `;
    productContainer.appendChild(item);
  });

  const total = Math.round(subtotal - discount);
  totalEl.textContent = '₹' + total.toFixed(2);

  // Remove old offers first
  document.querySelectorAll('.cart-offer-mobile').forEach(el => el.remove());

  // Add clickable offer with savings
  const footer = document.querySelector('.sheet-footer');
  if (offerMsg && footer) {
    const offer = document.createElement('div');
    offer.className = 'cart-offer-mobile small';
    offer.style.color = 'var(--accent-dark)';
    offer.style.fontWeight = '600';
    offer.style.margin = '8px 12px 0 12px';
    offer.style.cursor = 'pointer';
    offer.textContent = offerMsg + ' (Tap to view savings)';
    offer.addEventListener('click', () => {
      const saved = discount.toFixed(2);
      alert(`💰 You saved ₹${saved} on this order!`);
    });
    footer.insertAdjacentElement('beforebegin', offer);
  }
}

// ===== SEARCH HANDLERS =====
searchInput && searchInput.addEventListener('input', e => renderProducts(e.target.value));
navSearchForm && navSearchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = navSearchInput.value || '';
  renderProducts(q);
  document.getElementById('products') && document.getElementById('products').scrollIntoView({behavior:'smooth', block:'start'});
});

// sync nav search with products search input
navSearchInput && navSearchInput.addEventListener('input', e => {
  const v = e.target.value || '';
  if (searchInput) searchInput.value = v;
  renderProducts(v);
});

// Prescription upload handler (uses your existing Render endpoint)
const prescInput = document.getElementById("prescription-input");
if (prescInput) {
  prescInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return alert("Select a file first.");

    const formData = new FormData();
    formData.append("prescription", file);
    formData.append("name", document.getElementById("cust-name").value);
    formData.append("phone", document.getElementById("cust-phone").value);
    formData.append("address", document.getElementById("cust-address").value);

    try {
      const response = await fetch(`${BACKEND_BASE}/upload-prescription`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        alert("✅ Uploaded successfully!");
        document.getElementById("uploaded-url").value = data.fileUrl;
        document.getElementById("send-prescription-btn").style.display = "block";
        // Keep reference to last prescription
        prescriptionData = { name: file.name, url: data.fileUrl };
      } else alert("❌ Upload failed");
    } catch (err) {
      console.error(err);
      alert("⚠️ Upload error.");
    }
  });
}

// Send prescription as WhatsApp message (two identical handlers were in original; keep one)
const sendPrescBtn = document.getElementById("send-prescription-btn");
if (sendPrescBtn) {
  sendPrescBtn.addEventListener("click", () => {
    const url = document.getElementById("uploaded-url").value;
    const name = document.getElementById("presc-name").value;
    const phone = document.getElementById("presc-phone").value;
    const address = document.getElementById("presc-address").value;

    const message =
      `Hello ${SHOP_NAME},\n\n` +
      `Customer Name: ${name}\n` +
      `Phone: ${phone}\n` +
      `Address: ${address}\n` +
      `Prescription: ${url}`;
    window.open(
      `https://wa.me/${MERCHANT_WHATSAPP_NUMBER.replace('+','')}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  });
}

// ===== MODAL FLOW =====
document.getElementById('checkout')?.addEventListener('click', () => {
  const items = Object.values(cart);
  if (items.length === 0) { alert('Your cart is empty'); return; }
  openModalStep(1);
});
function openModalStep(step) {
  if (!modal) return;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  if (step === 1) {
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    setStepIndicator(1);
  } else {
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    setStepIndicator(2);
  }
}
function closeModal() {
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}
function setStepIndicator(n) {
  stepIndicators.forEach(el => {
    el.classList.toggle('active', Number(el.dataset.step) === n);
  });
}
cancel1Btn?.addEventListener('click', () => closeModal());
backToStep1Btn?.addEventListener('click', () => openModalStep(1));

// ===== STEP 1 ➜ STEP 2 =====
toStep2Btn?.addEventListener('click', () => {
  const name = custNameInput.value.trim();
  const address = custAddressInput.value.trim();
  const pin = custPinInput.value.trim();
  const phone = custPhoneInput.value.trim();

  if (!name) return alert('Please enter full name');
  if (!address) return alert('Please enter delivery address');
  if (!/^\d{4,6}$/.test(pin)) return alert('Please enter valid PIN');
  if (!/^\d{6,15}$/.test(phone)) return alert('Please enter valid phone');
  openModalStep(2);
});

// ===== PAYMENT METHOD TOGGLE & DYNAMIC QR =====
function updateQRForTotal(totalAmt) {
  const method = paymentMethodInput ? (paymentMethodInput.value || '').toLowerCase() : '';
  const isCOD = method.includes('cash');
  const isOnline = method.includes('upi') || method.includes('gpay') || method.includes('paytm') || method.includes('phonepe') || method.includes('bank');

  if (isCOD) {
    qrCard && qrCard.classList.add('hidden');
    if (txnInput) txnInput.style.display = 'none';
    if (txnIdInput) txnIdInput.style.display = 'none';
    amountInput && (amountInput.style.display = 'none');
    return;
  }

  if (isOnline && totalAmt > 0) {
    const SHOPNAME = SHOP_NAME;
    const amtStr = Number(totalAmt).toFixed(2);
    const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(SHOPNAME)}&am=${encodeURIComponent(amtStr)}&cu=INR`;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(upiLink)}`;

    if (qrImage) {
      qrImage.src = qrSrc;
      qrImage.alt = `Scan to pay ₹${amtStr}`;
    }

    qrCard && qrCard.classList.remove('hidden');
    if (txnInput) txnInput.style.display = 'block';
    if (txnIdInput) txnIdInput.style.display = 'block';
    amountInput && (amountInput.style.display = 'block');

    const qrLabel = document.getElementById('qrLabel');
    if (qrLabel) {
      qrLabel.innerHTML = `
        <h3>Scan & Pay ₹${amtStr}</h3>
        <p>UPI ID: <b>${UPI_ID}</b></p>
        <p><small>Use any UPI app (GPay, PhonePe, Paytm, etc.)</small></p>
      `;
    }
  } else {
    qrCard && qrCard.classList.add('hidden');
    if (txnInput) txnInput.style.display = 'none';
    if (txnIdInput) txnIdInput.style.display = 'none';
    amountInput && (amountInput.style.display = 'none');
  }
}

// Auto-update on change
if (paymentMethodInput) {
  const togglePaymentUI = () => {
    const method = (paymentMethodInput.value || '').toLowerCase();
    const isCOD = method.includes('cash');
    const isOnline = method.includes('upi') || method.includes('gpay') || method.includes('paytm') || method.includes('phonepe') || method.includes('bank');

    if (isCOD) {
      qrCard && qrCard.classList.add('hidden');
      if (txnInput) txnInput.style.display = 'none';
      if (txnIdInput) txnIdInput.style.display = 'none';
      amountInput && (amountInput.style.display = 'none');
    } else if (isOnline) {
      if (txnInput) txnInput.style.display = 'block';
      if (txnIdInput) txnIdInput.style.display = 'block';
      amountInput && (amountInput.style.display = 'block');
      updateQRForTotal(window.LAST_FINAL_TOTAL || 0);
    } else {
      qrCard && qrCard.classList.add('hidden');
      if (txnInput) txnInput.style.display = 'none';
      if (txnIdInput) txnIdInput.style.display = 'none';
      amountInput && (amountInput.style.display = 'none');
    }
  };

  paymentMethodInput.addEventListener('change', togglePaymentUI);
  togglePaymentUI();
}

// ===== VALIDATION & SEND ORDER =====
sendOrderBtn?.addEventListener('click', () => {
  const method = paymentMethodInput ? (paymentMethodInput.value || 'N/A') : 'N/A';
  const txn = (txnInput && txnInput.value.trim()) || (txnIdInput && txnIdInput.value.trim()) || '';
  const amtRaw = amountInput ? amountInput.value.trim() : '';
  const amt = amtRaw === '' ? NaN : Number(amtRaw);

  // compute subtotal & discount
  const items = Object.values(cart);
  let subtotal = 0;
  items.forEach(it => subtotal += it.price * it.qty);

  let discount = 0;
  if (subtotal > 1500) discount = subtotal * 0.12;
  else if (subtotal > 550) discount = subtotal * 0.10;

  const finalTotal = Math.round(subtotal - discount);

  const custName = custNameInput ? custNameInput.value.trim() : '';
  const custAddress = custAddressInput ? custAddressInput.value.trim() : '';
  const custPin = custPinInput ? custPinInput.value.trim() : '';
  const custPhone = custPhoneInput ? custPhoneInput.value.trim() : '';

  if (!custName || !custAddress || !custPin || !custPhone) {
    alert('Customer details missing.');
    return;
  }

  // Create unique EID tied to phone + timestamp
  const timestamp = Date.now();
  const uniqueEID = `EID-${custPhone}-${timestamp}`;

  // SAVE ORDER LOCALLY (unchanged)
  const orderData = {
    EID: uniqueEID,
    phone: custPhone,
    name: custName,
    address: custAddress,
    pin: custPin,
    items: items,
    total: finalTotal,
    discount,
    status: 'Placed',
    date: new Date().toLocaleString(),
    payment: { method, txn, amount: amtRaw }
  };
  const existing = JSON.parse(localStorage.getItem('orders') || '[]');
  existing.push(orderData);
  localStorage.setItem('orders', JSON.stringify(existing));

  // WHATSAPP MESSAGE
  const lines = [];
  lines.push(`🛒 Shop: ${SHOP_NAME}`);
  lines.push(`🧾 Order ID: ${uniqueEID}`);
  lines.push('');
  lines.push('📦 Order Details:');
  items.forEach(it => lines.push(`${it.qty} x ${it.name} — ₹${(it.price * it.qty).toFixed(2)}`));
  lines.push(`Total (after discount): ₹${finalTotal}`);
  if (discount > 0) lines.push(`💰 You saved ₹${discount.toFixed(2)}`);
  if (prescriptionData) {
    lines.push('');
    lines.push(`📎 Prescription: ${prescriptionData.name} (uploaded)`);
  }
  lines.push('');
  lines.push('🧍 Customer Details:');
  lines.push(`Name: ${custName}`);
  lines.push(`Address: ${custAddress}`);
  lines.push(`PIN: ${custPin}`);
  lines.push(`Phone: ${custPhone}`);
  lines.push('');
  lines.push('💳 Payment:');
  lines.push(`Method: ${method}`);
  lines.push(`Txn ID: ${txn || 'N/A'}`);
  lines.push(`Amount Paid: ₹${amtRaw || 'N/A'}`);

  const text = encodeURIComponent(lines.join('\n'));
  const phone = MERCHANT_WHATSAPP_NUMBER.replace(/\s+/g, '');
  const waUrl = `https://wa.me/${phone.replace('+', '')}?text=${text}`;
  // open merchant whatsapp in new tab for manual confirmation (keeps current page)
  window.open(waUrl, '_blank');

  // Send to backend (non-blocking)
  (async () => {
    try {
      await submitOrderToServer({
        EID: uniqueEID,
        phone: custPhone,
        name: custName,
        address: custAddress,
        pin: custPin,
        items,
        total: finalTotal,
        discount,
        status: 'Placed',
        date: new Date().toISOString(),
        payment: { method, txn, amount: amtRaw }
      });
      // if backend returns an order id, it will be stored in window.LAST_ORDER_ID
    } catch (e) {
      console.error('Order send to backend failed:', e);
    }
  })();

  closeModal();
  showResult(true, `✅ Your Order ID: ${uniqueEID}`);
  cart = {};
  renderCart();
});

// ===== RESULT SCREEN =====
function showResult(success, message) {
  if (!resultScreen) return;
  resultScreen.classList.add('active');
  resultTitle.textContent = success ? '✅ Order Placed Successfully!' : '❌ Order Failed';
  resultMessage.textContent = (typeof message === 'number' || !isNaN(Number(message))) ? `Total: ₹${message}` : (message || (success ? 'Your order will be delivered soon.' : 'Please try again.'));
}

homeButton && homeButton.addEventListener('click', () => {
  resultScreen.classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

retryButton && retryButton.addEventListener('click', () => {
  resultScreen.classList.remove('active');
});

// ===== NAV TOGGLER & SMOOTH SCROLL =====
navToggle?.addEventListener('click', () => {
  if (navLinks) navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
});

document.querySelectorAll('[data-scroll]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    const el = document.querySelector(href);
    if (!el) return;
    el.scrollIntoView({behavior:'smooth',block:'start'});
    if (window.innerWidth < 900 && navLinks) navLinks.style.display = 'none';
  });
});

// ===== LIVE SEARCH SUGGESTIONS =====
const suggestionsBox = document.getElementById('search-suggestions');
const navSearch = document.getElementById('nav-search');

if (navSearch && suggestionsBox) {
  navSearch.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      suggestionsBox.classList.remove('active');
      suggestionsBox.innerHTML = '';
      return;
    }

    // find matches
    const matches = PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q)
    ).slice(0, 5);

    if (matches.length === 0) {
      suggestionsBox.classList.remove('active');
      suggestionsBox.innerHTML = '';
      return;
    }

    // render
    suggestionsBox.innerHTML = matches.map(p =>
      `<div class="suggestion-item" data-id="${p.id}">${p.name} — <span style="color:var(--muted)">${p.company}</span></div>`
    ).join('');
    suggestionsBox.classList.add('active');
  });

  // click suggestion
  suggestionsBox.addEventListener('click', e => {
    const item = e.target.closest('.suggestion-item');
    if (!item) return;
    const id = Number(item.dataset.id);
    const product = PRODUCTS.find(p => p.id === id);
    if (product) {
      navSearch.value = product.name;
      renderProducts(product.name);
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
    }
    suggestionsBox.classList.remove('active');
  });

  // hide on outside click
  document.addEventListener('click', e => {
    if (!suggestionsBox.contains(e.target) && e.target !== navSearch) {
      suggestionsBox.classList.remove('active');
    }
  });
}

// ===== SLIDER (loads images from data-img attributes) =====
function showSlide(idx) {
  if (!slides.length) return;
  slides.forEach((s,i) => {
    s.classList.toggle('active', i===idx);
    const visual = s.querySelector('.slide-visual');
    const url = s.dataset.img;
    if (visual && url) {
      if (!visual.querySelector('.bg-img')) {
        const el = document.createElement('div');
        el.className = 'bg-img';
        el.style.backgroundImage = `url('${url}')`;
        visual.appendChild(el);
      } else {
        visual.querySelector('.bg-img').style.backgroundImage = `url('${url}')`;
      }
    }
  });

  // dots
  const dots = document.getElementById('slider-dots');
  if (dots) {
    dots.innerHTML = '';
    slides.forEach((s,i)=>{
      const btn = document.createElement('button');
      btn.className = i===idx ? 'dot active' : 'dot';
      if (i===idx) btn.classList.add('active');
      btn.addEventListener('click', ()=> { slideIndex = i; restartSlider(); showSlide(i); });
      dots.appendChild(btn);
    });
  }
}
function nextSlide() { if (slides.length) { slideIndex = (slideIndex+1) % slides.length; showSlide(slideIndex); } }
function prevSlide() { if (slides.length) { slideIndex = (slideIndex-1 + slides.length) % slides.length; showSlide(slideIndex); } }
function restartSlider() { clearInterval(sliderTimer); sliderTimer = setInterval(nextSlide, 4800); }
document.getElementById('next-slide')?.addEventListener('click', ()=>{ nextSlide(); restartSlider(); });
document.getElementById('prev-slide')?.addEventListener('click', ()=>{ prevSlide(); restartSlider(); });

if (slides.length) { showSlide(0); restartSlider(); }

// ===== FLY-TO-CART ANIMATION =====
function animateAddToCart(ev, imgEl) {
  try {
    if (!imgEl) return;
    const imgRect = imgEl.getBoundingClientRect();
    const cartSideEl = document.getElementById('cart-side') || document.querySelector('.cart-side');
    const cartRect = cartSideEl ? cartSideEl.getBoundingClientRect() : {left: window.innerWidth-80, top: 80};
    const fly = imgEl.cloneNode(true);
    fly.className = 'flying';
    fly.style.width = imgRect.width + 'px';
    fly.style.height = imgRect.height + 'px';
    fly.style.left = imgRect.left + 'px';
    fly.style.top = imgRect.top + 'px';
    document.body.appendChild(fly);

    const tx = (cartRect.left + 20) - imgRect.left;
    const ty = (cartRect.top + 20) - imgRect.top;
    fly.style.setProperty('--tx', tx + 'px');
    fly.style.setProperty('--ty', ty + 'px');

    fly.addEventListener('animationend', () => fly.remove());
  } catch (e) { /* silently ignore animation errors */ }
}

// ===== MOBILE CART SHEET: render & controls =====
(function () {
  const mobileBtn = document.getElementById('mobile-cart-btn');
  const mobileBadge = document.getElementById('mobile-cart-badge');
  const mobileSheet = document.getElementById('mobile-cart-sheet');
  const sheetOverlay = document.getElementById('mobile-sheet-overlay');
  const closeBtn = document.getElementById('mobile-close-sheet');
  const productContainer = document.getElementById('mobile-cart-contents');
  const totalEl = document.getElementById('mobile-sheet-total');
  const nextBtn = document.getElementById('mobile-sheet-next');

  // safety guards
  if (!mobileBtn || !mobileSheet || !productContainer) {
    return;
  }

  function showSheetVisual() {
    mobileSheet.classList.add('show');
    mobileSheet.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }
  function hideSheetVisual() {
    mobileSheet.classList.remove('show');
    mobileSheet.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    document.body.style.touchAction = '';
  }

  // open sheet (public)
  window.openMobileCartSheet = function openMobileCartSheet() {
    renderCart();
    mobileSheet.style.display = 'block';
    setTimeout(showSheetVisual, 1);
  };

  // close sheet (public)
  window.closeMobileCartSheet = function closeMobileCartSheet() {
    hideSheetVisual();
    setTimeout(() => {
      if (!mobileSheet.classList.contains('show')) mobileSheet.style.display = '';
    }, 420);
  };

  // toggle via button
  mobileBtn.addEventListener('click', () => {
    if (mobileSheet.classList.contains('show')) {
      window.closeMobileCartSheet();
    } else {
      window.openMobileCartSheet();
    }
  });

  // close handlers
  closeBtn && closeBtn.addEventListener('click', window.closeMobileCartSheet);
  sheetOverlay && sheetOverlay.addEventListener('click', window.closeMobileCartSheet);

  // NEXT -> trigger existing #checkout button
  nextBtn && nextBtn.addEventListener('click', () => {
    window.closeMobileCartSheet();
    const existingCheckout = document.getElementById('checkout');
    if (existingCheckout) existingCheckout.click();
  });

  // initial badge updater
  window.updateMobileCartBadge = function updateMobileCartBadge() {
    const count = Object.keys(cart || {}).reduce((s,k) => s + (cart[k].qty || 0), 0);
    mobileBadge.textContent = count;
    mobileBadge.style.display = count > 0 ? 'inline-flex' : 'none';
  };

  updateMobileCartBadge();

  // Close sheet on ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileSheet.classList.contains('show')) window.closeMobileCartSheet();
  });
})();

// ===== FLOATING CART (desktop small toggle) =====
const floatingCartBtn = document.getElementById('floating-cart-btn');
const floatingCartCount = document.getElementById('floating-cart-count');
const cartSide = document.getElementById('cart-side');

function updateFloatingCartCount() {
  const totalItems = Object.keys(cart).reduce((sum, id) => sum + (cart[id].qty || 0), 0);
  if (floatingCartCount) floatingCartCount.textContent = totalItems;
  const mobileBadge = document.getElementById('mobile-cart-badge');
  if (mobileBadge) {
    mobileBadge.textContent = totalItems;
    mobileBadge.style.display = totalItems > 0 ? 'inline-flex' : 'none';
  }
}
updateFloatingCartCount();

if (floatingCartBtn) {
  floatingCartBtn.addEventListener('click', () => {
    if (!cartSide) return;
    cartSide.classList.toggle('active');
  });
}

// ===== ORDER CHECK FEATURE =====
const checkOrderBtn = document.getElementById('check-order-btn');
const orderPhoneInput = document.getElementById('order-phone');
const orderResult = document.getElementById('order-status-result');

checkOrderBtn?.addEventListener('click', () => {
  const q = (orderPhoneInput.value || '').trim();
  if (!q) {
    orderResult.textContent = '⚠️ Enter your Order ID (EID) or phone number.';
    return;
  }

  const allOrders = JSON.parse(localStorage.getItem('orders') || '[]');
  if (!allOrders.length) {
    orderResult.textContent = '❌ No orders found.';
    return;
  }

  // find by EID or phone
  const found = allOrders.find(o => (o.EID && o.EID === q) || (o.phone && o.phone === q));
  if (!found) {
    orderResult.textContent = '❌ No order found for that EID or phone number.';
    return;
  }

  // build readable result (show success badge)
  let html = `<div style="margin-bottom:8px;font-weight:700;color:var(--accent-dark)">✅ Order found!</div>`;
  html += `
    <strong>Order ID:</strong> ${found.EID}<br>
    <strong>Date:</strong> ${found.date}<br>
    <strong>Name:</strong> ${escapeHtml(found.name)}<br>
    <strong>Phone:</strong> ${escapeHtml(found.phone)}<br>
    <strong>Address:</strong> ${escapeHtml(found.address)}<br>
    <strong>PIN:</strong> ${escapeHtml(found.pin)}<br>
    <strong>Status:</strong> ${escapeHtml(found.status)}<br>
    <strong>Total:</strong> ₹${found.total}<br>
    ${found.discount ? `<strong>Saved:</strong> ₹${Number(found.discount).toFixed(2)}<br>` : ''}

``
    <br><strong>Items:</strong><br>
  `;
  found.items.forEach(it => {
    html += `${it.qty} × ${escapeHtml(it.name)} — ₹${(it.price * it.qty).toFixed(2)}<br>`;
  });

  orderResult.innerHTML = html;
});

// ===== INITIALIZE =====
loadProducts();
renderCart();


// =======================================================
// === MANUAL PAYMENT VERIFICATION BACKEND INTEGRATION ===
// =======================================================

// Save Order to backend
async function submitOrderToServer(orderData) {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });
    const data = await res.json();
    if (data && data.success) {
      console.log("✅ Order saved on server:", data.orderId);
      window.LAST_ORDER_ID = data.orderId;
      // friendly pop-up for user (non-intrusive)
      try {
        // show a small toast if you have one; fallback to alert
        if (typeof showToast === 'function') showToast('Order saved to server');
        else console.info('Order saved to server');
      } catch (e) {}
    } else {
      console.warn("❌ Order save failed on server:", data);
    }
  } catch (err) {
    console.error("⚠️ Unable to connect to backend for order save:", err);
  }
}

// Upload payment proof (txn ID or screenshot)
async function submitPaymentProof(txnId, file) {
  const fd = new FormData();
  fd.append("txnId", txnId || "");
  fd.append("orderId", window.LAST_ORDER_ID || "");
  if (file) fd.append("screenshot", file);

  try {
    const res = await fetch(`${BACKEND_BASE}/api/payment-proof`, { method: "POST", body: fd });
    const data = await res.json();
    if (data && data.success) {
      alert("✅ Payment proof submitted! We will verify and confirm your order soon.");
    } else {
      alert("❌ Upload failed. Try again.");
    }
  } catch (err) {
    console.error("Payment proof upload error:", err);
    alert("⚠️ Failed to upload payment proof.");
  }
}

// Hook: when local order is created by your existing sendOrderBtn flow,
// also send it to backend. We wrap the click to capture the local stored order.
if (sendOrderBtn) {
  // keep existing listeners intact; add second listener to send to server
  sendOrderBtn.addEventListener("click", () => {
    // small delay to allow localStorage write (your flow writes immediately)
    setTimeout(async () => {
      try {
        const allOrders = JSON.parse(localStorage.getItem("orders") || "[]");
        const lastOrder = allOrders[allOrders.length - 1];
        if (lastOrder) {
          await submitOrderToServer({
            EID: lastOrder.EID,
            phone: lastOrder.phone,
            name: lastOrder.name,
            address: lastOrder.address,
            pin: lastOrder.pin,
            items: lastOrder.items,
            total: lastOrder.total,
            discount: lastOrder.discount,
            status: lastOrder.status,
            date: new Date().toISOString(),
            payment: lastOrder.payment || {}
          });
        }
      } catch (err) {
        console.error("Error sending order to backend:", err);
      }
    }, 800);
  });
}

// Payment proof submit button hookup
if (proofBtn) {
  proofBtn.addEventListener("click", async () => {
    const txnIdVal = (txnInput && txnInput.value.trim()) || (txnIdInput && txnIdInput.value.trim()) || '';
    const file = screenshotUpload && screenshotUpload.files && screenshotUpload.files[0] ? screenshotUpload.files[0] : null;

    if (!txnIdVal && !file) {
      if (proofMsg) {
        proofMsg.textContent = "⚠️ Enter UPI transaction ID or upload screenshot.";
        proofMsg.style.color = "red";
      } else alert("⚠️ Enter UPI transaction ID or upload screenshot.");
      return;
    }

    // optional UX feedback
    if (proofMsg) {
      proofMsg.textContent = "Uploading proof...";
      proofMsg.style.color = "black";
    }

    await submitPaymentProof(txnIdVal, file);

    if (proofMsg) {
      proofMsg.textContent = "✅ Proof submitted. We'll verify and confirm your order.";
      proofMsg.style.color = "green";
    }

    // clear fields
    if (txnInput) txnInput.value = '';
    if (txnIdInput) txnIdInput.value = '';
    if (screenshotUpload) screenshotUpload.value = '';
  });
}

