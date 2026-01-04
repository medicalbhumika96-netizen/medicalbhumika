const BACKEND_BASE = "https://medicalbhumika-2.onrender.com";

async function loadOrders() {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/admin/orders`);
    const data = await res.json();

    if (!data.success) {
      alert("Failed to load orders");
      return;
    }

    const tbody = document.querySelector("#ordersTable tbody");
    tbody.innerHTML = "";

    data.orders.forEach(o => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${o.orderId || o.EID}</td>
        <td>${o.name}</td>
        <td>${o.phone}</td>
        <td>₹${o.total}</td>
        <td class="pending">${o.status}</td>
        <td>${new Date(o.createdAt).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}

loadOrders();
