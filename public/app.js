// Front-end for the demo. Plain JavaScript, no framework.
// After login the token is kept in localStorage and sent with each booking request.
const TOKEN_KEY = 'access_token';
const USER_KEY = 'username';

const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const logoutBtn = document.getElementById('logout-btn');

const form = document.getElementById('search-form');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');
const bookingPanel = document.getElementById('booking-panel');
const selectedFlightEl = document.getElementById('selected-flight');
const confirmationEl = document.getElementById('confirmation');

let selectedFlight = null;

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearMessages() {
  errorEl.hidden = true;
  errorEl.textContent = '';
  confirmationEl.hidden = true;
  confirmationEl.textContent = '';
}

function renderLoginState() {
  const user = localStorage.getItem(USER_KEY);
  const loggedIn = Boolean(user && localStorage.getItem(TOKEN_KEY));
  loginStatus.textContent = loggedIn ? `Logged in as ${user}` : 'Not logged in';
  loginForm.hidden = loggedIn;
  logoutBtn.hidden = !loggedIn;
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  renderLoginState();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessages();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    showError(data.error);
    return;
  }
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY, username);
  renderLoginState();
});

logoutBtn.addEventListener('click', clearSession);
renderLoginState();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessages();
  bookingPanel.hidden = true;
  resultsEl.innerHTML = '';

  const origin = document.getElementById('origin').value;
  const destination = document.getElementById('destination').value;

  const res = await fetch(`/api/flights?origin=${origin}&destination=${destination}`);
  const data = await res.json();

  if (!res.ok) {
    showError(data.error);
    return;
  }
  if (data.count === 0) {
    resultsEl.innerHTML = '<p data-testid="no-results">No flights found for this route.</p>';
    return;
  }
  for (const flight of data.flights) {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-testid', 'flight-card');
    card.innerHTML =
      `<strong data-testid="flight-number">${flight.flightNumber}</strong> ` +
      `<span>${flight.origin} to ${flight.destination}, departs ${flight.departs}</span> ` +
      `<span data-testid="price">$${flight.price.toFixed(2)}</span> ` +
      `<button type="button" data-testid="select-flight">Select</button>`;
    card.querySelector('button').addEventListener('click', () => selectFlight(flight));
    resultsEl.appendChild(card);
  }
});

function selectFlight(flight) {
  clearMessages();
  selectedFlight = flight;
  selectedFlightEl.textContent = `Selected: ${flight.flightNumber} (${flight.origin} to ${flight.destination})`;
  bookingPanel.hidden = false;
}

document.getElementById('confirm-btn').addEventListener('click', async () => {
  clearMessages();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    showError('Please log in first');
    return;
  }
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      flightNumber: selectedFlight.flightNumber,
      passenger: {
        firstName: document.getElementById('first-name').value,
        lastName: document.getElementById('last-name').value,
      },
    }),
  });
  const data = await res.json();

  if (res.status === 401) {
    clearSession();
    showError('Your session expired. Please log in again.');
    return;
  }
  if (!res.ok) {
    showError(data.error);
    return;
  }
  confirmationEl.textContent = `Booking confirmed: ${data.bookingRef}`;
  confirmationEl.hidden = false;
});
