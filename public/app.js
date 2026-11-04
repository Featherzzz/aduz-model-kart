'use strict';
(() => {
  const state = { products: [], category: 'All', query: '', sort: 'featured', cart: new Map(), toastTimer: null };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  async function loadProducts() {
    const grid = $('#productGrid');
    try {
      const response = await fetch('/api/products', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Could not load the project catalogue.');
      const products = await response.json();
      if (!Array.isArray(products)) throw new Error('The catalogue response was invalid.');
      state.products = products;
      renderProducts();
    } catch (error) {
      grid.innerHTML = `<div class="empty-results"><strong>Catalogue unavailable</strong>${escapeHTML(error.message)} Check that the local server is running.</div>`;
    }
  }

  function visibleProducts() {
    let list = state.products.filter(product => {
      const matchesCategory = state.category === 'All' || product.category === state.category;
      const searchable = `${product.name} ${product.desc} ${product.tag}`.toLowerCase();
      return matchesCategory && searchable.includes(state.query.toLowerCase());
    });
    if (state.sort === 'price-low') list.sort((a, b) => a.price - b.price);
    if (state.sort === 'price-high') list.sort((a, b) => b.price - a.price);
    if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  function categoryLabel(category) {
    return category === 'Basic Material Kit' ? 'Starter kit' : category === 'Standard Material Kit' ? 'Build kit' : 'Ready-made';
  }

  function renderProducts() {
    const products = visibleProducts();
    $('#resultCount').textContent = products.length;
    $('#productGrid').innerHTML = products.length ? products.map((product, index) => `
      <article class="product-card">
        <div class="product-visual"><img src="${escapeHTML(product.img)}" alt="Illustration of ${escapeHTML(product.name)}" loading="lazy"><span class="product-category">${escapeHTML(categoryLabel(product.category))}</span><span class="product-index">${String(index + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}</span></div>
        <div class="product-info"><div class="product-meta"><span>${escapeHTML(product.tag)}</span><span>ADUZ LAB</span></div><h3 class="product-title">${escapeHTML(product.name)}</h3><p class="product-desc">${escapeHTML(product.desc)}</p><div class="product-bottom"><div class="product-price">${money(product.price)} <small>INR</small></div><button class="add-button" type="button" data-add="${product.id}" aria-label="Add ${escapeHTML(product.name)} to cart">Add to cart <span>＋</span></button></div></div>
      </article>`).join('') : '<div class="empty-results"><strong>No matching projects.</strong>Try another search term or choose a different category.</div>';
  }

  function showToast(message) {
    const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
  }
  function cartEntries() { return [...state.cart.values()]; }
  function cartTotal() { return cartEntries().reduce((sum, item) => sum + item.price * item.quantity, 0); }
  function cartCount() { return cartEntries().reduce((sum, item) => sum + item.quantity, 0); }

  function renderCart() {
    const entries = cartEntries();
    const count = cartCount();
    $('#cartCount').textContent = count;
    $('#drawerCount').textContent = `(${count})`;
    $('#cartTotal').textContent = money(cartTotal());
    $('#checkoutTotal').textContent = money(cartTotal());
    $('#cartFooter').hidden = entries.length === 0;
    $('#cartItems').innerHTML = entries.length ? entries.map(item => `
      <article class="cart-line"><img src="${escapeHTML(item.img)}" alt=""><div><h3>${escapeHTML(item.name)}</h3><p>${money(item.price)} each</p><div class="qty-control"><button type="button" data-qty="${item.id}" data-change="-1" aria-label="Decrease ${escapeHTML(item.name)} quantity">−</button><span>${item.quantity}</span><button type="button" data-qty="${item.id}" data-change="1" aria-label="Increase ${escapeHTML(item.name)} quantity">＋</button></div></div><button class="remove-item" type="button" data-remove="${item.id}">Remove</button></article>`).join('') : '<div class="empty-cart"><span>＋</span><h3>Your cart is clear.</h3><p>Explore the collection and add a project to begin.</p><button class="text-link" id="continueShopping">Browse projects ↗</button></div>';
  }

  function openCart() {
    $('#cartDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; $('#cartClose').focus();
  }
  function closeCart() {
    $('#cartDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
  }
  function openCheckout() {
    if (!state.cart.size) return;
    closeCart(); $('#checkoutModal').classList.add('open'); $('#checkoutModal').setAttribute('aria-hidden', 'false');
    $('#checkoutContent').hidden = false; $('#successState').hidden = true; document.body.style.overflow = 'hidden'; $('#customerName').focus();
  }
  function closeCheckout() { $('#checkoutModal').classList.remove('open'); $('#checkoutModal').setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }

  $('#productGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-add]'); if (!button) return;
    const id = Number(button.dataset.add); const product = state.products.find(item => item.id === id); if (!product) return;
    const existing = state.cart.get(id);
    state.cart.set(id, { ...product, quantity: Math.min(20, (existing?.quantity || 0) + 1) });
    renderCart(); showToast(`${product.name} added to your cart.`);
    button.textContent = 'Added ✓'; setTimeout(() => { if (button.isConnected) button.innerHTML = 'Add to cart <span>＋</span>'; }, 900);
  });
  $('#cartItems').addEventListener('click', event => {
    const qtyButton = event.target.closest('[data-qty]');
    const removeButton = event.target.closest('[data-remove]');
    if (qtyButton) {
      const id = Number(qtyButton.dataset.qty); const item = state.cart.get(id); if (!item) return;
      const quantity = item.quantity + Number(qtyButton.dataset.change);
      if (quantity < 1) state.cart.delete(id); else if (quantity <= 20) state.cart.set(id, { ...item, quantity });
      renderCart();
    }
    if (removeButton) { state.cart.delete(Number(removeButton.dataset.remove)); renderCart(); }
    if (event.target.closest('#continueShopping')) closeCart();
  });
  $('#searchInput').addEventListener('input', event => { state.query = event.target.value.trim(); renderProducts(); });
  $$('.filter-btn').forEach(button => button.addEventListener('click', () => {
    state.category = button.dataset.category; $$('.filter-btn').forEach(item => item.classList.toggle('active', item === button)); renderProducts();
  }));
  $('#sortSelect').addEventListener('change', event => { state.sort = event.target.value; renderProducts(); });
  $('#cartOpen').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#drawerBackdrop').addEventListener('click', closeCart);
  $('#checkoutOpen').addEventListener('click', openCheckout);
  $('#checkoutClose').addEventListener('click', closeCheckout);
  $('#successClose').addEventListener('click', closeCheckout);
  $('#checkoutModal').addEventListener('click', event => { if (event.target === $('#checkoutModal')) closeCheckout(); });
  $('#menuToggle').addEventListener('click', () => {
    const nav = $('.main-nav'); const open = nav.classList.toggle('open'); $('#menuToggle').setAttribute('aria-expanded', String(open));
  });
  $$('.main-nav a').forEach(link => link.addEventListener('click', () => { $('.main-nav').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false'); }));
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#searchInput').focus(); }
    if (event.key === 'Escape') { closeCart(); closeCheckout(); $('.main-nav').classList.remove('open'); }
  });

  $('#checkoutForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#submitOrder'); const original = button.innerHTML;
    if (!event.currentTarget.reportValidity()) return;
    button.disabled = true; button.textContent = 'Submitting…';
    const payload = {
      name: $('#customerName').value.trim(), phone: $('#customerPhone').value.trim(),
      address: $('#customerAddress').value.trim(),
      cart: cartEntries().map(item => ({ id: item.id, quantity: item.quantity }))
    };
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not submit the demo order.');
      $('#orderReference').textContent = result.orderId;
      $('#checkoutContent').hidden = true; $('#successState').hidden = false;
      state.cart.clear(); renderCart(); event.currentTarget.reset();
    } catch (error) { showToast(error.message); }
    finally { button.disabled = false; button.innerHTML = original; }
  });

  renderCart(); loadProducts();
})();
