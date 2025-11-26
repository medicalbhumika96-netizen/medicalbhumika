// admin-client.js - minimal admin UI JS
const BACKEND = location.origin; // assume same origin or set to your backend URL
const API_LOGIN = BACKEND + "/api/admin/login";
const API_ORDERS = BACKEND + "/api/admin/orders";

const app = document.getElementById('app');
const loginScreen = document.getElementById('loginScreen');
const btnLogin = document.getElementById('btn-login');
const loginErr = document.getElementById('loginErr');
const btnLogout = document.getElementById('btn-logout');
const qInput = document.getElementById('q');
const filterStatus = document.getElementById('filter-status');
const ordersList = document.getElementById('ordersList');
const btnRefresh = document.getElementById('btn-refresh');
const btnSearch = document.getElementById('btn-search');
const btnExport = document.getElementById('btn-export');

const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalCustomer = document.getElementById('modalCustomer');
const modalItems = document.getElementById('modalItems');
const modalPayment = document.getElementById('modalPayment');
const modalProofWrap = document.getElementById('modalProofWrap');
const modalMeta = document.getElementById('modalMeta');
const modalNext = document.getElementById('modalNext');
const modalDelete = document.getElementById('modalDelete');

function getAuthHeader() { return { "x-admin-token": localStorage.getItem("admin_token") || "" }; }
function showApp() { loginScreen.style.display = 'none'; app.style.display = ''; }
function showLogin() { app.style.display = 'none'; loginScreen.style.display = ''; }

btnLogin.addEventListener('click', async () => {
  loginErr.style.display = 'none';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!email || !password) { loginErr.textContent = 'Enter email & password'; loginErr.style.display = 'block'; return; }
  const r = await fetch(API_LOGIN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!r.ok) { loginErr.textContent = 'Login failed'; loginErr.style.display = 'block'; return; }
  const data = await r.json();
  localStorage.setItem('admin_token', data.token);
  showApp();
  await loadOrders();
});

btnLogout.addEventListener('click', () => { localStorage.removeItem('admin_token'); location.reload(); });

async function fetchOrders() {
  const url = new URL(API_ORDERS, BACKEND);
  url.searchParams.set('t', Date.now());
  const r = await fetch(url.toString(), { headers: getAuthHeader() });
  if (!r.ok) { if (r.status === 401) { localStorage.removeItem('admin_token'); showLogin(); } throw new Error('fetch failed'); }
  const data = await r.json();
  return data.orders || [];
}

function escapeHtml(s = '') { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }

function renderOrders(orders) {
  if (!orders.length) { ordersList.innerHTML = '<div class="muted">No orders yet.</div>'; return; }
  let html = '<table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>';
  orders.forEach(o => {
    const itemsText = (o.items || []).map(i => `${i.qty}× ${i.name}`).slice(0, 3).join(', ');
    html += `<tr data-id="${o.orderId}" style="cursor:pointer"><td><b>${escapeHtml(o.orderId || '')}</b><div class="muted small">${escapeHtml(o.phone || '')}</div></td><td>${escapeHtml(o.name || '')}<div class="small muted">${escapeHtml(o.address || '')}</div></td><td>${escapeHtml(itemsText)}</td><td>₹${Number(o.total || 0).toFixed(2)}</td><td><span class="status-pill">${escapeHtml(o.status || 'Pending')}</span></td><td class="muted">${escapeHtml(o.createdAt || '')}</td></tr>`;
  });
  html += '</tbody></table>';
  ordersList.innerHTML = html;
  document.querySelectorAll('#ordersList tr[data-id]').forEach(r => r.addEventListener('click', () => {
    const id = r.dataset.id;
    fetchOrders().then(list => {
      const o = list.find(x => x.orderId === id);
      if (!o) return alert('Order not found');
      openOrderModal(o);
    });
  }));
  btnExport.href = BACKEND + '/api/admin/export';
}

function openOrderModal(o) {
  modalTitle.textContent = `Order — ${o.orderId}`;
  modalCustomer.innerHTML = `<div><strong>${escapeHtml(o.name)}</strong></div><div class="small muted">${escapeHtml(o.phone)}</div><div>${escapeHtml(o.address)}</div>`;
  modalItems.innerHTML = (o.items || []).map(it => `<div><strong>${escapeHtml(it.name)}</strong><div class="muted small">${it.qty} × ₹${it.price} = ₹${(it.price * it.qty).toFixed(2)}</div></div>`).join('');
  modalPayment.innerHTML = `<h4>Payment</h4><div><strong>Method:</strong> ${escapeHtml(o.payment?.method || 'COD')}</div><div><strong>Txn:</strong> ${escapeHtml(o.payment?.txn || '')}</div>`;
  modalProofWrap.innerHTML = o.fileUrl ? `<img src="${o.fileUrl}" class="thumb">` : '<div class="small muted">No screenshot</div>';
  modalMeta.innerHTML = `<div>Placed: ${escapeHtml(o.createdAt)}</div>`;
  modal.style.display = 'flex';
  modalNext.onclick = async () => { const steps = ['Pending', 'Confirmed', 'Out for Delivery', 'Delivered']; const cur = o.status || 'Pending'; const next = steps[Math.min(3, steps.indexOf(cur) + 1)]; if (!confirm('Move to ' + next + '?')) return; await fetch(BACKEND + `/api/admin/orders/${encodeURIComponent(o.orderId)}/status`, { method: 'POST', headers: { "content-type": "application/json", ...getAuthHeader() }, body: JSON.stringify({ status: next }) }); modal.style.display = 'none'; loadOrders(); };
  modalDelete.onclick = async () => { if (!confirm('Delete?')) return; await fetch(BACKEND + `/api/admin/orders/${encodeURIComponent(o.orderId)}`, { method: 'DELETE', headers: getAuthHeader() }); modal.style.display = 'none'; loadOrders(); };
}

async function loadOrders() { try { const orders = await fetchOrders(); renderOrders(orders); } catch (e) { console.error(e); } }

// Boot
if (localStorage.getItem('admin_token') === 'ADMIN_OK') { showApp(); loadOrders(); } else { showLogin(); }
closeModal.addEventListener('click', () => modal.style.display = 'none');
