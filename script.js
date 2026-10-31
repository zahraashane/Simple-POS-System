/**
 * POS System — Kafé Nusantara
 * script.js  |  Vanilla JavaScript, no dependencies
 *
 * Sections:
 *  1. State & Constants
 *  2. Data Loading (fetch products.json)
 *  3. UI – Clock & Date
 *  4. UI – Category Filters
 *  5. UI – Product Grid Rendering
 *  6. Cart Logic (add / update qty / remove)
 *  7. Cart UI Rendering
 *  8. Payment Logic & Validation
 *  9. Modal (success screen)
 * 10. Utility helpers
 * 11. Event Listeners & Bootstrap
 */

'use strict';

/* =====================================================
   1. STATE & CONSTANTS
   ===================================================== */

/** Tax rate applied to the subtotal */
const TAX_RATE = 0.10;

/**
 * Application state object — single source of truth.
 * @type {{ products: Array, cart: Map<number, {product: Object, qty: number}>, activeCategory: string }}
 */
const state = {
  products: [],          // All products loaded from products.json
  cart: new Map(),       // key = product.id, value = { product, qty }
  activeCategory: 'All', // Currently selected category filter
  searchQuery: '',       // Current search string
};

/**
 * Resolves the image for a product.
 * Uses PRODUCT_IMAGES (loaded from images.js — Base64 JPEG, no internet needed).
 * Falls back to an SVG placeholder if images.js hasn't loaded.
 * @param {number} id
 * @returns {string} data URI or placeholder
 */
function getProductImage(id) {
  if (typeof PRODUCT_IMAGES !== 'undefined' && PRODUCT_IMAGES[id]) {
    return PRODUCT_IMAGES[id];
  }
  // SVG placeholder fallback (should never be needed if images.js is loaded)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%23fed7aa'/><text x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-size='72' font-family='sans-serif'>🍽</text></svg>`;
  return 'data:image/svg+xml,' + svg;
}

/**
 * Product data — images injected via getProductImage() from images.js.
 */
const FALLBACK_PRODUCTS = [
  { id:1,  name:'Espresso',         category:'Coffee',   price:25000 },
  { id:2,  name:'Cappuccino',       category:'Coffee',   price:35000 },
  { id:3,  name:'Latte',            category:'Coffee',   price:38000 },
  { id:4,  name:'Americano',        category:'Coffee',   price:28000 },
  { id:5,  name:'Green Tea Latte',  category:'Tea',      price:32000 },
  { id:6,  name:'Chamomile Tea',    category:'Tea',      price:22000 },
  { id:7,  name:'Croissant',        category:'Pastry',   price:28000 },
  { id:8,  name:'Blueberry Muffin', category:'Pastry',   price:24000 },
  { id:9,  name:'Chocolate Cake',   category:'Pastry',   price:42000 },
  { id:10, name:'Mineral Water',    category:'Beverage', price:12000 },
  { id:11, name:'Orange Juice',     category:'Beverage', price:30000 },
  { id:12, name:'Avocado Smoothie', category:'Beverage', price:36000 },
].map(p => ({ ...p, image: getProductImage(p.id) }));

/* =====================================================
   2. DATA LOADING
   ===================================================== */

/**
 * Fetches product data from products.json and initialises the UI.
 * Uses fetch() which works fine over http:// (GitHub Pages, Live Server, etc.).
 * NOTE: fetch() does NOT work from a plain file:// URL without a local server.
 */
async function loadProducts() {
  try {
    const response = await fetch('products.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json();
    // Attach real images from images.js (Base64)
    state.products = raw.map(p => ({ ...p, image: getProductImage(p.id) }));
  } catch (err) {
    // fetch() fails on file:// or network error — use built-in fallback silently
    console.warn('[POS] products.json not loaded via fetch, using built-in data.', err.message);
    state.products = FALLBACK_PRODUCTS;
  }
  renderCategoryTabs();
  renderProductGrid();
}

/* =====================================================
   3. UI – CLOCK & DATE
   ===================================================== */

/**
 * Updates the header clock and date every second.
 */
function startClock() {
  function tick() {
    const now = new Date();

    // Date: e.g. "Sabtu, 31 Oktober 2026"
    document.getElementById('currentDate').textContent = now.toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    // Time: HH:MM:SS
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  }

  tick();              // Run immediately on load
  setInterval(tick, 1000);
}

/* =====================================================
   4. UI – CATEGORY FILTERS
   ===================================================== */

/**
 * Builds the category filter tab buttons from the product data.
 * Always includes an "All" tab first.
 */
function renderCategoryTabs() {
  const container = document.getElementById('filterTabs');

  // Derive unique categories from product data
  const categories = ['All', ...new Set(state.products.map(p => p.category))];

  container.innerHTML = categories.map(cat => `
    <button
      class="filter-tab${cat === state.activeCategory ? ' active' : ''}"
      role="tab"
      aria-selected="${cat === state.activeCategory}"
      data-category="${cat}"
    >${cat}</button>
  `).join('');
}

/**
 * Handles category tab click — updates state and re-renders grid.
 * @param {string} category
 */
function setActiveCategory(category) {
  state.activeCategory = category;

  // Update tab button styles
  document.querySelectorAll('.filter-tab').forEach(btn => {
    const isActive = btn.dataset.category === category;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });

  renderProductGrid();
}

/* =====================================================
   5. UI – PRODUCT GRID RENDERING
   ===================================================== */

/**
 * Filters products by active category and search query,
 * then renders product cards into the grid.
 */
function renderProductGrid() {
  const grid      = document.getElementById('productGrid');
  const empty     = document.getElementById('emptyState');
  const query     = state.searchQuery.toLowerCase().trim();
  const category  = state.activeCategory;

  // Filter logic
  const filtered = state.products.filter(p => {
    const matchCat  = category === 'All' || p.category === category;
    const matchSearch = !query || p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query);
    return matchCat && matchSearch;
  });

  // Show empty state if no results
  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // Build card HTML
  grid.innerHTML = filtered.map(product => {
    const inCart  = state.cart.has(product.id);
    const cartQty = inCart ? state.cart.get(product.id).qty : 0;

    return `
      <article
        class="product-card"
        role="listitem"
        data-id="${product.id}"
        aria-label="${product.name}, ${formatRupiah(product.price)}"
        tabindex="0"
      >
        ${inCart ? `<span class="product-card__badge" aria-label="${cartQty} di keranjang">${cartQty}</span>` : ''}
        <div class="product-card__img-wrap">
          <img
            class="product-card__img"
            src="${product.image}"
            alt="${product.name}"
          />
          <div class="product-card__overlay" aria-hidden="true">
            <span class="product-card__overlay-text">+ Tambah<br>ke Keranjang</span>
          </div>
        </div>
        <div class="product-card__body">
          <span class="product-card__category">${product.category}</span>
          <span class="product-card__name">${product.name}</span>
          <span class="product-card__price">${formatRupiah(product.price)}</span>
        </div>
      </article>`;
  }).join('');
}

/* =====================================================
   6. CART LOGIC
   ===================================================== */

/**
 * Adds a product to the cart (or increments qty if already present).
 * @param {number} productId
 */
function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  if (state.cart.has(productId)) {
    // Increment quantity
    state.cart.get(productId).qty += 1;
  } else {
    // New cart entry
    state.cart.set(productId, { product, qty: 1 });
  }

  renderCartTable();
  renderProductGrid(); // Refresh badges on product cards
  updateCartBadge();
}

/**
 * Updates the quantity for a cart item.
 * Removes the item if qty drops to zero.
 * @param {number} productId
 * @param {number} delta  - +1 to increase, -1 to decrease
 */
function updateQty(productId, delta) {
  if (!state.cart.has(productId)) return;

  const item = state.cart.get(productId);
  item.qty += delta;

  if (item.qty <= 0) {
    removeFromCart(productId);
  } else {
    renderCartTable();
    renderProductGrid();
    updateCartBadge();
  }
}

/**
 * Removes a product from the cart entirely.
 * @param {number} productId
 */
function removeFromCart(productId) {
  // Animate the row out, then delete after the animation duration (250ms).
  // Using setTimeout instead of animationend because animationend is
  // unreliable on <tr> elements in some browsers.
  const row = document.querySelector(`[data-cart-id="${productId}"]`);
  if (row) {
    row.classList.add('removing');
    setTimeout(() => {
      state.cart.delete(productId);
      renderCartTable();
      renderProductGrid();
      updateCartBadge();
    }, 260); // slightly longer than the 0.25s CSS animation
  } else {
    state.cart.delete(productId);
    renderCartTable();
    renderProductGrid();
    updateCartBadge();
  }
}

/**
 * Clears all items from the cart.
 */
function clearCart() {
  state.cart.clear();
  document.getElementById('paymentInput').value = '';
  document.getElementById('changeDisplay').hidden = true;
  document.getElementById('paymentError').hidden = true;
  renderCartTable();
  renderProductGrid();
  updateCartBadge();
}

/* =====================================================
   7. CART UI RENDERING
   ===================================================== */

/**
 * Re-renders the entire cart table based on current state.cart.
 * Also recalculates and displays totals and quick-pay amounts.
 */
function renderCartTable() {
  const tbody      = document.getElementById('cartBody');
  const cartEmpty  = document.getElementById('cartEmpty');
  const cartTable  = document.querySelector('.cart-table');

  if (state.cart.size === 0) {
    // Show empty placeholder
    tbody.innerHTML = '';
    cartEmpty.hidden = false;
    cartTable.style.display = 'none';
    updateTotals(0, 0, 0);
    renderQuickAmounts(0);
    return;
  }

  cartEmpty.hidden = true;
  cartTable.style.display = '';

  // Build table rows
  tbody.innerHTML = [...state.cart.values()].map(({ product, qty }) => {
    const subtotal = product.price * qty;
    return `
      <tr data-cart-id="${product.id}" class="adding">
        <td>
          <span class="cart-item__name" title="${product.name}">${product.name}</span>
          <span class="cart-item__price">${formatRupiah(product.price)}</span>
        </td>
        <td class="text-center">
          <div class="qty-stepper">
            <button class="qty-stepper__btn" data-action="dec" data-id="${product.id}" aria-label="Kurangi ${product.name}">−</button>
            <span class="qty-stepper__value" aria-label="Jumlah">${qty}</span>
            <button class="qty-stepper__btn" data-action="inc" data-id="${product.id}" aria-label="Tambah ${product.name}">+</button>
          </div>
        </td>
        <td class="text-right cart-item__subtotal">${formatRupiah(subtotal)}</td>
        <td class="text-center">
          <button class="btn-delete" data-action="remove" data-id="${product.id}" aria-label="Hapus ${product.name}">🗑</button>
        </td>
      </tr>`;
  }).join('');

  // Recalculate totals
  const subtotal = calculateSubtotal();
  const tax      = subtotal * TAX_RATE;
  const total    = subtotal + tax;
  updateTotals(subtotal, tax, total);
  renderQuickAmounts(total);

  // Re-validate payment input if it already has a value
  const paymentVal = parseFloat(document.getElementById('paymentInput').value) || 0;
  if (paymentVal > 0) validatePayment(paymentVal, total);
}

/**
 * Calculates the subtotal of all cart items (before tax).
 * @returns {number}
 */
function calculateSubtotal() {
  let total = 0;
  state.cart.forEach(({ product, qty }) => { total += product.price * qty; });
  return total;
}

/**
 * Updates the summary row displays.
 * @param {number} subtotal
 * @param {number} tax
 * @param {number} total
 */
function updateTotals(subtotal, tax, total) {
  document.getElementById('subtotalDisplay').textContent = formatRupiah(subtotal);
  document.getElementById('taxDisplay').textContent      = formatRupiah(tax);
  document.getElementById('totalDisplay').textContent    = formatRupiah(total);
}

/**
 * Updates the cart badge (item count in header).
 */
function updateCartBadge() {
  let totalQty = 0;
  state.cart.forEach(({ qty }) => { totalQty += qty; });
  const badge = document.getElementById('cartBadge');
  badge.textContent = `${totalQty} item${totalQty !== 1 ? '' : ''}`;
}

/**
 * Renders quick-pay amount buttons based on current total.
 * Offers rounded-up options for convenience.
 * @param {number} total
 */
function renderQuickAmounts(total) {
  const container = document.getElementById('quickAmounts');
  if (total === 0) { container.innerHTML = ''; return; }

  // Generate 4 sensible rounded amounts
  const amounts = generateQuickAmounts(total);

  container.innerHTML = amounts.map(amt => `
    <button class="quick-btn" data-amount="${amt}" aria-label="Bayar ${formatRupiah(amt)}">
      ${formatRupiah(amt)}
    </button>`).join('');
}

/**
 * Generates up to 4 rounded payment suggestions above the total.
 * @param {number} total
 * @returns {number[]}
 */
function generateQuickAmounts(total) {
  const magnitudes = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const amounts    = new Set();

  // "Exact" — already the total if it's round, otherwise round up to nearest 1000
  const exact = Math.ceil(total / 1000) * 1000;
  amounts.add(exact);

  // Add rounded multiples above the total
  for (const mag of magnitudes) {
    const rounded = Math.ceil(total / mag) * mag;
    if (rounded >= total) amounts.add(rounded);
    if (amounts.size >= 4) break;
  }

  return [...amounts].slice(0, 4).sort((a, b) => a - b);
}

/* =====================================================
   8. PAYMENT LOGIC & VALIDATION
   ===================================================== */

/**
 * Validates the entered payment amount against the total.
 * Shows change or an error message.
 * @param {number} payment
 * @param {number} total
 * @returns {boolean} isValid
 */
function validatePayment(payment, total) {
  const errorEl  = document.getElementById('paymentError');
  const changeEl = document.getElementById('changeDisplay');
  const changeValEl = document.getElementById('changeValue');

  // Hide both by default
  errorEl.hidden  = true;
  changeEl.hidden = true;

  if (total === 0) return false;

  if (payment <= 0) {
    // No input yet — neutral state, no error shown
    return false;
  }

  if (payment < total) {
    // Insufficient payment
    errorEl.hidden      = false;
    errorEl.textContent = `⚠️ Pembayaran kurang ${formatRupiah(total - payment)} dari total belanja.`;
    return false;
  }

  // Valid payment — show change
  changeEl.hidden           = false;
  changeValEl.textContent   = formatRupiah(payment - total);
  return true;
}

/**
 * Processes the checkout when the user clicks "Bayar Sekarang".
 * Validates cart and payment, then shows success modal.
 */
function processCheckout() {
  const subtotal   = calculateSubtotal();
  const total      = subtotal + subtotal * TAX_RATE;
  const paymentRaw = document.getElementById('paymentInput').value;
  const payment    = parseFloat(paymentRaw) || 0;

  // Guard: empty cart
  if (state.cart.size === 0) {
    showError('Keranjang masih kosong. Tambahkan produk terlebih dahulu.');
    return;
  }

  // Validate payment
  const isValid = validatePayment(payment, total);
  if (!isValid) {
    document.getElementById('paymentInput').focus();
    return;
  }

  // Show success modal
  const change   = payment - total;
  const itemList = [...state.cart.values()]
    .map(({ product, qty }) => `• ${product.name} ×${qty}`)
    .join('\n');

  showSuccessModal({
    total,
    payment,
    change,
    itemList,
  });
}

/* =====================================================
   9. MODAL
   ===================================================== */

/**
 * Displays the payment success modal.
 * @param {{ total: number, payment: number, change: number, itemList: string }} data
 */
function showSuccessModal({ total, payment, change, itemList }) {
  const overlay = document.getElementById('modalOverlay');
  const body    = document.getElementById('modalBody');

  body.textContent = [
    itemList,
    '',
    `Total Belanja : ${formatRupiah(total)}`,
    `Pembayaran    : ${formatRupiah(payment)}`,
    `Kembalian     : ${formatRupiah(change)}`,
    '',
    'Terima kasih telah berbelanja! 😊',
  ].join('\n');

  overlay.hidden = false;
  document.getElementById('newTransactionBtn').focus();
}

/**
 * Hides the success modal and starts a fresh transaction.
 */
function closeModal() {
  document.getElementById('modalOverlay').hidden = true;
  clearCart();
}

/* =====================================================
   10. UTILITY HELPERS
   ===================================================== */

/**
 * Formats a number as Indonesian Rupiah currency string.
 * e.g. 35000 → "Rp 35.000"
 * @param {number} amount
 * @returns {string}
 */
function formatRupiah(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

/**
 * Shows a quick inline error using the paymentError element.
 * @param {string} message
 */
function showError(message) {
  const errorEl = document.getElementById('paymentError');
  errorEl.hidden      = false;
  errorEl.textContent = `⚠️ ${message}`;
}

/* =====================================================
   11. EVENT LISTENERS & BOOTSTRAP
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ── Sync --header-h CSS variable to actual header height (keeps sticky offsets accurate)
  function syncHeaderHeight() {
    const h = document.querySelector('.header');
    if (h) {
      document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
    }
  }
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight);

  // ── Initialise clock
  startClock();

  // ── Load products from JSON
  loadProducts();

  // ── Render empty cart state on startup
  renderCartTable();

  // -------------------------------------------------
  // Category filter tab clicks (event delegation)
  // -------------------------------------------------
  document.getElementById('filterTabs').addEventListener('click', e => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    setActiveCategory(tab.dataset.category);
  });

  // -------------------------------------------------
  // Product card click → add to cart (event delegation)
  // -------------------------------------------------
  document.getElementById('productGrid').addEventListener('click', e => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    addToCart(Number(card.dataset.id));
  });

  // Allow keyboard activation of product cards (Enter / Space)
  document.getElementById('productGrid').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.product-card');
      if (!card) return;
      e.preventDefault();
      addToCart(Number(card.dataset.id));
    }
  });

  // -------------------------------------------------
  // Cart table actions: inc / dec / remove (delegation)
  // -------------------------------------------------
  document.getElementById('cartBody').addEventListener('click', e => {
    const btn    = e.target.closest('[data-action]');
    if (!btn) return;
    const id     = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if      (action === 'inc')    updateQty(id, +1);
    else if (action === 'dec')    updateQty(id, -1);
    else if (action === 'remove') removeFromCart(id);
  });

  // -------------------------------------------------
  // Search input
  // -------------------------------------------------
  const searchInput = document.getElementById('searchInput');
  const clearBtn    = document.getElementById('clearSearch');

  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    clearBtn.hidden   = searchInput.value.length === 0;
    renderProductGrid();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value   = '';
    state.searchQuery   = '';
    clearBtn.hidden     = true;
    searchInput.focus();
    renderProductGrid();
  });

  // -------------------------------------------------
  // Payment input → live validation
  // -------------------------------------------------
  document.getElementById('paymentInput').addEventListener('input', () => {
    const payment  = parseFloat(document.getElementById('paymentInput').value) || 0;
    const subtotal = calculateSubtotal();
    const total    = subtotal + subtotal * TAX_RATE;
    if (total > 0) validatePayment(payment, total);
  });

  // -------------------------------------------------
  // Quick amount buttons (event delegation on container)
  // -------------------------------------------------
  document.getElementById('quickAmounts').addEventListener('click', e => {
    const btn = e.target.closest('.quick-btn');
    if (!btn) return;
    document.getElementById('paymentInput').value = btn.dataset.amount;
    // Trigger input validation
    document.getElementById('paymentInput').dispatchEvent(new Event('input'));
  });

  // -------------------------------------------------
  // Checkout button
  // -------------------------------------------------
  document.getElementById('checkoutBtn').addEventListener('click', processCheckout);

  // -------------------------------------------------
  // Clear cart button
  // -------------------------------------------------
  document.getElementById('clearCartBtn').addEventListener('click', () => {
    if (state.cart.size === 0) return;
    // Simple confirm — keeps it dependency-free
    if (window.confirm('Kosongkan semua item di keranjang?')) clearCart();
  });

  // -------------------------------------------------
  // New transaction button (inside modal)
  // -------------------------------------------------
  document.getElementById('newTransactionBtn').addEventListener('click', closeModal);

  // Close modal on overlay click (outside the card)
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Close modal on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('modalOverlay').hidden) {
      closeModal();
    }
  });

});
