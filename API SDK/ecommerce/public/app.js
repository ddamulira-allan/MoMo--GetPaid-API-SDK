const productGrid = document.querySelector('#product-grid');
const cartItems = document.querySelector('#cart-items');
const bagCount = document.querySelector('#bag-count');
const summaryCount = document.querySelector('#summary-count');
const subtotalText = document.querySelector('#subtotal');
const totalText = document.querySelector('#total');
const deliveryFeeText = document.querySelector('#delivery-fee');
const deliveryHint = document.querySelector('#delivery-hint');
const checkoutButton = document.querySelector('#checkout-button');
const cartView = document.querySelector('#cart-view');
const checkoutForm = document.querySelector('#checkout-form');
const paymentView = document.querySelector('#payment-view');
const checkoutError = document.querySelector('#checkout-error');
const paymentError = document.querySelector('#payment-error');
const toast = document.querySelector('#toast');
const freeDeliveryThreshold = 200000;

let catalog = [];
let currency = 'UGX';
let cart = new Map();
let activeRequestId = null;
let idempotencyKey = null;
let toastTimer = null;
let paymentPollTimer = null;
let checkingPayment = false;

function money(amount) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function productArt(product, compact = false) {
  const art = makeElement('div', `product-art art-${product.accent}`);
  const typeById = {
    'nomad-bag': ['bag-shape', 'm'],
    'studio-bottle': ['bottle-shape', ''],
    'weekend-knit': ['knit-shape', ''],
    'everyday-tote': ['tote-shape', 'm'],
  };
  const [shapeClass, text] = typeById[product.id] || ['bag-shape', 'm'];
  const object = makeElement('div', `art-object ${shapeClass}`);
  if (text) object.textContent = text;
  if (compact) {
    art.className = `cart-thumb art-${product.accent}`;
    art.textContent = text || '✳';
    return art;
  }
  if (product.badge) art.append(makeElement('span', 'product-badge', product.badge));
  art.append(object);
  return art;
}

function renderProducts() {
  productGrid.replaceChildren();
  for (const product of catalog) {
    const card = makeElement('article', 'product-card');
    card.append(productArt(product));
    const info = makeElement('div', 'product-info');
    info.append(makeElement('p', 'product-category', product.category));
    const titleRow = makeElement('div', 'product-name-row');
    titleRow.append(makeElement('h3', 'product-name', product.name));
    titleRow.append(makeElement('span', 'product-price', money(product.price)));
    info.append(titleRow);
    info.append(makeElement('p', 'product-description', product.description));
    const button = makeElement('button', 'add-button', 'Add to bag  +');
    button.type = 'button';
    button.addEventListener('click', () => {
      const currentQuantity = cart.get(product.id) || 0;
      if (currentQuantity >= 20) {
        showToast('You can add up to 20 of each item.');
        return;
      }
      cart.set(product.id, currentQuantity + 1);
      renderCart();
      showToast(`${product.name} added to your bag.`);
    });
    info.append(button);
    card.append(info);
    productGrid.append(card);
  }
}

function renderCart() {
  cartItems.replaceChildren();
  let itemCount = 0;
  let subtotal = 0;

  for (const [id, quantity] of cart) {
    const product = catalog.find((item) => item.id === id);
    if (!product) continue;
    itemCount += quantity;
    subtotal += product.price * quantity;
    const row = makeElement('div', 'cart-item');
    row.append(productArt(product, true));
    const details = makeElement('div');
    details.append(makeElement('h4', 'cart-name', product.name));
    details.append(makeElement('p', 'cart-unit', money(product.price)));
    const controls = makeElement('div', 'quantity-control');
    for (const [label, delta] of [['Decrease quantity', -1], ['Increase quantity', 1]]) {
      const button = makeElement('button', '', delta < 0 ? '−' : '+');
      button.type = 'button';
      button.setAttribute('aria-label', `${label} of ${product.name}`);
      button.addEventListener('click', () => {
        const nextQuantity = (cart.get(id) || 0) + delta;
        if (nextQuantity < 1) cart.delete(id);
        else if (nextQuantity <= 20) cart.set(id, nextQuantity);
        else {
          showToast('You can add up to 20 of each item.');
          return;
        }
        renderCart();
      });
      controls.append(button);
      if (delta < 0) controls.append(makeElement('span', '', String(quantity)));
    }
    details.append(controls);
    row.append(details);
    row.append(makeElement('strong', 'cart-price', money(product.price * quantity)));
    cartItems.append(row);
  }

  if (itemCount === 0) cartItems.append(makeElement('p', 'empty-cart', 'Your bag is waiting for something lovely.'));
  const formattedCount = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
  const shipping = subtotal > 0 && subtotal < freeDeliveryThreshold ? 5000 : 0;
  bagCount.textContent = String(itemCount);
  summaryCount.textContent = formattedCount;
  subtotalText.textContent = money(subtotal);
  totalText.textContent = money(subtotal + shipping);
  checkoutButton.disabled = itemCount === 0;
  document.querySelector('#checkout-total').textContent = money(subtotal + shipping);

  if (subtotal > 0 && shipping === 0) {
    deliveryFeeText.textContent = 'Free';
    deliveryHint.textContent = 'Lovely! Your delivery is on us.';
  } else {
    deliveryFeeText.textContent = money(shipping);
    deliveryHint.textContent = `Free delivery on orders over ${money(freeDeliveryThreshold)}.`;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function showError(target, message) {
  target.textContent = message;
  target.hidden = false;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function showPayment(order) {
  activeRequestId = order.requestId;
  cartView.hidden = true;
  checkoutForm.hidden = true;
  paymentView.hidden = false;
  document.querySelector('#payment-heading').textContent = 'Check your phone';
  document.querySelector('#payment-message').textContent = 'Approve the MTN Mobile Money prompt to complete your order.';
  document.querySelector('#payment-order-id').textContent = order.orderId;
  document.querySelector('#payment-amount').textContent = money(order.amount);
  paymentError.hidden = true;
  document.querySelector('#check-payment').disabled = false;
  document.querySelector('#check-payment').textContent = 'Check payment status';
  document.querySelector('#check-payment').hidden = false;
  document.querySelector('#cancel-waiting').hidden = true;
  clearInterval(paymentPollTimer);
  checkingPayment = false;
  paymentPollTimer = setInterval(checkPayment, 5000);
  checkPayment();
}

async function checkPayment() {
  if (!activeRequestId || checkingPayment) return;
  checkingPayment = true;
  const button = document.querySelector('#check-payment');
  button.disabled = true;
  paymentError.hidden = true;
  try {
    const result = await api(`/api/orders/${encodeURIComponent(activeRequestId)}`);
    if (result.status === 'SUCCESSFUL') {
      clearInterval(paymentPollTimer);
      document.querySelector('#payment-heading').textContent = 'It’s a good day.';
      document.querySelector('#payment-message').textContent = 'Your payment went through. We’ll be in touch with the delivery details soon.';
      document.querySelector('#check-payment').hidden = true;
      document.querySelector('#cancel-waiting').textContent = 'Continue shopping';
      document.querySelector('#cancel-waiting').hidden = false;
      cart.clear();
      renderCart();
      showToast(`Order ${result.orderId} is confirmed.`);
    } else if (result.status === 'FAILED') {
      clearInterval(paymentPollTimer);
      document.querySelector('#payment-heading').textContent = 'Payment wasn’t completed';
      document.querySelector('#payment-message').textContent = result.reason || 'The payment request was declined or expired.';
      document.querySelector('#check-payment').hidden = true;
      document.querySelector('#cancel-waiting').textContent = 'Return to checkout';
      document.querySelector('#cancel-waiting').hidden = false;
    } else {
      button.textContent = 'Check payment status';
      button.disabled = false;
    }
  } catch (error) {
    showError(paymentError, error.message);
    button.disabled = false;
  } finally {
    checkingPayment = false;
  }
}

checkoutButton.addEventListener('click', () => {
  cartView.hidden = true;
  checkoutForm.hidden = false;
  checkoutForm.querySelector('input').focus();
});

document.querySelector('#back-to-cart').addEventListener('click', () => {
  checkoutForm.hidden = true;
  cartView.hidden = false;
});

document.querySelector('#check-payment').addEventListener('click', checkPayment);
document.querySelector('#cancel-waiting').addEventListener('click', () => {
  clearInterval(paymentPollTimer);
  activeRequestId = null;
  paymentView.hidden = true;
  if (cart.size) cartView.hidden = false;
  else {
    cartView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  checkoutError.hidden = true;
  const button = document.querySelector('#pay-button');
  button.disabled = true;
  button.textContent = 'Starting secure payment…';
  if (!idempotencyKey) idempotencyKey = crypto.randomUUID();

  const formData = new FormData(checkoutForm);
  const customer = Object.fromEntries(['name', 'email', 'phone', 'address', 'city']
    .map((field) => [field, formData.get(field)]));
  try {
    const order = await api('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        customer,
        items: [...cart].map(([id, quantity]) => ({ id, quantity })),
        idempotencyKey,
      }),
    });
    idempotencyKey = null;
    showPayment(order);
  } catch (error) {
    showError(checkoutError, error.message);
    button.disabled = false;
    button.replaceChildren(document.createTextNode('Place order & pay '));
    const arrow = makeElement('span', '', '→');
    arrow.setAttribute('aria-hidden', 'true');
    button.append(arrow);
  }
});

async function startShop() {
  try {
    const [store, status] = await Promise.all([api('/api/products'), api('/api/status')]);
    catalog = store.products;
    currency = store.currency;
    renderProducts();
    renderCart();
    if (!status.paymentsEnabled) {
      const button = document.querySelector('#pay-button');
      button.disabled = true;
      button.title = 'Configure the MoMo credentials in the server .env file to enable checkout.';
      showError(checkoutError, 'Mobile Money checkout needs to be configured by the store owner.');
    }
  } catch (error) {
    productGrid.replaceChildren(makeElement('p', 'loading-message', error.message));
    checkoutButton.disabled = true;
  }
}

startShop();
