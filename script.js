// ===== CONFIG =====
const MERCHANT_WHATSAPP_NUMBER = '+918003929804';
const SHOP_NAME = 'Bhumika Medical';

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

const qrCard = document.getElementById('qr-card');
const qrImage = document.getElementById('qr-image');

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
const txnInput = document.getElementById('transaction-id');
const amountInput = document.getElementById('amount-paid');

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

// set shop name & phone
document.querySelectorAll('.brand-name').forEach(el => el.textContent = SHOP_NAME);
document.getElementById('cfg-phone') && (document.getElementById('cfg-phone').textContent = MERCHANT_WHATSAPP_NUMBER);

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
      image: item.Image || 'https://via.placeholder.com/160x120?text=No+Image'
    }));
  } catch (err) {
    console.warn('Could not load products.json — using fallback sample products.');
    PRODUCTS = [
      {id:1,name:'Paracetamol 500mg (10 tablets)',company:'Generic',price:40,image:'https://source.unsplash.com/400x300/?tablet,medicine'},
      {id:2,name:'Cough Syrup 100ml',company:'HealthCo',price:120,image:'https://source.unsplash.com/400x300/?syrup,medicine'},
      {id:3,name:'Vitamin C 500mg',company:'NutriLife',price:220,image:'https://source.unsplash.com/400x300/?vitamin,health'}
    ];
  }
  renderProducts();
}

// ===== RENDER PRODUCTS =====
function renderProducts(filter = '') {
  if (!productList) return;
  productList.innerHTML = '';

  const q = (filter || '').trim().toLowerCase();

  // Filtered results (if searching, show all matches)
  let filtered = PRODUCTS.filter(p =>
    !q || p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q)
  );

  // If not searching, only show 20
  if (!q) {
    filtered = filtered.slice(0, 20);
  }

  // Render filtered list
  filtered.forEach(p => {
    const el = document.createElement('div');
    el.className = 'product';
    el.innerHTML = `
      <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
      <div style="flex:1">
        <div style="font-weight:700">${escapeHtml(p.name)}</div>
        <div class="small" style="margin-top:6px">${escapeHtml(p.company)}</div>
        <div class="meta">
          <div class="price">₹${p.price}</div>
          <button class="add">Add</button>
        </div>
      </div>
    `;
    const btn = el.querySelector('.add');
    btn.addEventListener('click', (ev) => {
      addToCart(p.id);
      animateAddToCart(ev, el.querySelector('img'));
    });
    productList.appendChild(el);
  });
}


// ===== CART =====
function addToCart(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  if (!cart[id]) cart[id] = { ...p, qty: 0 };
  cart[id].qty++;
  renderCart();
}
function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  renderCart();
}
window.changeQty = changeQty;

function renderCart() {
  if (!cartList) return;
  cartList.innerHTML = '';
  let total = 0;
  const keys = Object.keys(cart);
  if (keys.length === 0) {
    cartList.innerHTML = '<div class="small">Cart is empty</div>';
  } else {
    keys.forEach(id => {
      const it = cart[id];
      total += it.price * it.qty;
      const el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML = `
        <div>
          <div style="font-weight:700">${escapeHtml(it.name)}</div>
          <div class="small">₹${it.price} × ${it.qty} = ₹${it.price * it.qty}</div>
        </div>
        <div class="qty">
          <button onclick="changeQty(${id}, -1)">−</button>
          <div>${it.qty}</div>
          <button onclick="changeQty(${id}, 1)">+</button>
        </div>
      `;
      cartList.appendChild(el);
    });
  }
  totalDisplay.textContent = '₹' + total;
  cartCountEl && (cartCountEl.textContent = Object.keys(cart).reduce((s,k)=>s+cart[k].qty,0));
}

// ===== SEARCH HANDLERS =====
searchInput && searchInput.addEventListener('input', e => renderProducts(e.target.value));
navSearchForm && navSearchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = navSearchInput.value || '';
  // perform search in product list and scroll to products
  renderProducts(q);
  document.getElementById('products') && document.getElementById('products').scrollIntoView({behavior:'smooth', block:'start'});
});

// sync nav search with products search input (nice UX)
navSearchInput && navSearchInput.addEventListener('input', e => {
  const v = e.target.value || '';
  if (searchInput) searchInput.value = v;
  renderProducts(v);
});

// clear button
document.getElementById('clear')?.addEventListener('click', () => { cart = {}; renderCart(); });

// ===== PRESCRIPTION PREVIEW =====
const presInput = document.getElementById('prescription-file');
const presPreview = document.getElementById('prescription-preview');
presInput && presInput.addEventListener('change', ev => {
  const f = ev.target.files[0];
  if (!f) return;
  prescriptionData = { name: f.name, type: f.type };
  const url = URL.createObjectURL(f);
  prescriptionData.blobUrl = url;
  presPreview.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">
      <div style="flex:1">
        <div style="font-weight:700">${f.name}</div>
        <div class="small">${(f.size / 1024).toFixed(1)} KB</div>
      </div>
      <a href="${url}" download="${f.name}">
        <button>Download</button>
      </a>
    </div>
  `;
});

// ===== MODAL FLOW =====
document.getElementById('checkout')?.addEventListener('click', () => {
  const items = Object.values(cart);
  if (items.length === 0) { alert('Your cart is empty'); return; }
  openModalStep(1);
});
function openModalStep(step) {
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

// ===== PAYMENT METHOD TOGGLE =====
paymentMethodInput?.addEventListener('change', () => {
  const m = paymentMethodInput.value;
  if (m === 'Cash on Delivery') {
    qrCard.classList.add('hidden');
    txnInput.style.display = 'none';
    amountInput.style.display = 'none';
  } else {
    qrCard.classList.remove('hidden');
    txnInput.style.display = 'block';
    amountInput.style.display = 'block';
  }
});
paymentMethodInput && paymentMethodInput.dispatchEvent(new Event('change'));

// ===== VALIDATION & SEND ORDER =====
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

sendOrderBtn?.addEventListener('click', () => {
  const method = paymentMethodInput.value || 'N/A';
  const txn = txnInput.value.trim();
  const amtRaw = amountInput.value.trim();
  const amt = amtRaw === '' ? NaN : Number(amtRaw);

  const items = Object.values(cart);
  let total = 0;
  items.forEach(it => total += it.price * it.qty);

  let success = method === 'Cash on Delivery' || (txn && !Number.isNaN(amt) && amt >= total);

  const custName = custNameInput.value.trim();
  const custAddress = custAddressInput.value.trim();
  const custPin = custPinInput.value.trim();
  const custPhone = custPhoneInput.value.trim();

  if (!custName || !custAddress || !custPin || !custPhone) {
    alert('Customer details missing.');
    return;
  }

  const lines = [];
  lines.push(`🛒 Shop: ${SHOP_NAME}`);
  lines.push('');
  lines.push('🧾 Order:');
  items.forEach(it => lines.push(`${it.qty} x ${it.name} — ₹${it.price * it.qty}`));
  lines.push(`Total: ₹${total}`);
  if (prescriptionData) {
    lines.push('');
    lines.push(`📎 Prescription: ${prescriptionData.name} (uploaded)`);
  }
  lines.push('');
  lines.push('🧍 Customer details:');
  lines.push(`Name: ${custName}`);
  lines.push(`Address: ${custAddress}`);
  lines.push(`PIN: ${custPin}`);
  lines.push(`Phone: ${custPhone}`);
  lines.push('');
  lines.push('💳 Payment details:');
  lines.push(`Method: ${method}`);
  lines.push(`Txn ID: ${txn || 'N/A'}`);
  lines.push(`Amount Paid: ₹${amtRaw || 'N/A'}`);

  const text = encodeURIComponent(lines.join('\n'));
  const phone = MERCHANT_WHATSAPP_NUMBER.replace(/\s+/g, '');
  const waUrl = `https://wa.me/${phone.replace('+', '')}?text=${text}`;
  window.open(waUrl, '_blank');

  closeModal();
  showResult(success, total);
});

// ===== RESULT SCREEN =====
function showResult(success, message) {
  if (!resultScreen) return;
  resultScreen.classList.add('active');
  resultTitle.textContent = success ? '✅ Order Placed Successfully!' : '❌ Order Failed';
  resultMessage.textContent = message || (success ? 'Your order will be delivered soon.' : 'Please try again.');

  // Optional animation can be added here if you want
}

// Buttons
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

// ===== SLIDER (loads images from data-img attributes) =====
function showSlide(idx) {
  if (!slides.length) return;
  slides.forEach((s,i) => {
    s.classList.toggle('active', i===idx);
    // set background image for visual area
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
function nextSlide() { slideIndex = (slideIndex+1) % slides.length; showSlide(slideIndex); }
function prevSlide() { slideIndex = (slideIndex-1 + slides.length) % slides.length; showSlide(slideIndex); }
function restartSlider() { clearInterval(sliderTimer); sliderTimer = setInterval(nextSlide, 4800); }
document.getElementById('next-slide')?.addEventListener('click', ()=>{ nextSlide(); restartSlider(); });
document.getElementById('prev-slide')?.addEventListener('click', ()=>{ prevSlide(); restartSlider(); });

if (slides.length) { showSlide(0); restartSlider(); }

// ===== FLY-TO-CART ANIMATION =====
function animateAddToCart(ev, imgEl) {
  try {
    if (!imgEl) return;
    const imgRect = imgEl.getBoundingClientRect();
    const cartSide = document.getElementById('cart-side') || document.querySelector('.cart-side');
    const cartRect = cartSide ? cartSide.getBoundingClientRect() : {left: window.innerWidth-80, top: 80};
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

// ===== HELPERS =====
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }

// ===== INIT =====
loadProducts();
renderCart();
// ===== ORDER STATUS MOCKUP =====
const checkOrderBtn = document.getElementById('check-order-btn');
const orderPhoneInput = document.getElementById('order-phone');
const orderResult = document.getElementById('order-status-result');

// Mock order data (In future, this will come from your backend)
let ORDER_HISTORY = [
  { phone: '8003929804', orderId: 'ORD-12345', status: 'Delivered', date: '2025-10-30', total: '₹520' },
  { phone: '9822334455', orderId: 'ORD-56789', status: 'Out for Delivery', date: '2025-10-31', total: '₹230' },
];

checkOrderBtn && checkOrderBtn.addEventListener('click', () => {
  const phone = orderPhoneInput.value.trim();
  if (!phone) {
    orderResult.textContent = '⚠️ Please enter your phone number.';
    return;
  }

  const order = ORDER_HISTORY.find(o => o.phone === phone);
  if (order) {
    orderResult.innerHTML = `
      <strong>Order ID:</strong> ${order.orderId}<br>
      <strong>Date:</strong> ${order.date}<br>
      <strong>Status:</strong> ${order.status}<br>
      <strong>Total:</strong> ${order.total}
    `;
  } else {
    orderResult.textContent = '❌ No orders found for this phone number.';
  }
});
// ===== MOBILE NAV TOGGLE =====
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('show');
  });
}
