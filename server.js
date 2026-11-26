'use strict';
/**
 * A tiny flight-booking app: a web page + a REST API. No frameworks, no database.
 * This is the "application under test" that lives in the SAME repo as the tests.
 * Data is kept in memory and resets every time the server restarts.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS) || 3600; // how long a login token lives
const PUBLIC_DIR = path.join(__dirname, 'public');

const flights = [
  { flightNumber: 'QF401', origin: 'MEL', destination: 'SYD', departs: '07:00', price: 189.0 },
  { flightNumber: 'QF403', origin: 'MEL', destination: 'SYD', departs: '12:30', price: 215.5 },
  { flightNumber: 'QF501', origin: 'SYD', destination: 'BNE', departs: '09:15', price: 159.0 },
  { flightNumber: 'QF9', origin: 'PER', destination: 'SYD', departs: '06:00', price: 410.0 },
];

// Test accounts for the practice app. A real company uses an identity provider (Okta, Azure AD,
// AWS Cognito...) and the QA team is given dedicated test users per environment.
const users = {
  'qa.customer@example.com': 'Passw0rd!',
  'qa.other@example.com': 'Passw0rd!2',
};
const tokens = new Map();   // access token -> { username, expiresAt }
const bookings = new Map(); // booking reference -> { owner, booking }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Returns the username for a valid, unexpired "Authorization: Bearer <token>" header, otherwise null.
function getUser(req) {
  const match = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!match) return null;
  const entry = tokens.get(match[1]);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokens.delete(match[1]);
    return null;
  }
  return entry.username;
}

function newBookingRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = '';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function handleApi(req, res, url) {
  const { pathname } = url;

  // GET /api/health
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  // POST /api/login   { username, password }  ->  { access_token, token_type, expires_in }
  if (req.method === 'POST' && pathname === '/api/login') {
    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    if (!isNonEmptyString(body.username) || !isNonEmptyString(body.password)) {
      return sendJson(res, 400, { error: 'username and password are required' });
    }
    const known = Object.prototype.hasOwnProperty.call(users, body.username);
    if (!known || users[body.username] !== body.password) {
      return sendJson(res, 401, { error: 'Invalid username or password' });
    }
    const accessToken = crypto.randomBytes(24).toString('hex');
    tokens.set(accessToken, { username: body.username, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000 });
    return sendJson(res, 200, { access_token: accessToken, token_type: 'Bearer', expires_in: TOKEN_TTL_SECONDS });
  }

  // GET /api/me   (needs a token)  ->  who am I?
  if (req.method === 'GET' && pathname === '/api/me') {
    const user = getUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorised' });
    return sendJson(res, 200, { username: user });
  }

  // GET /api/flights?origin=MEL&destination=SYD
  if (req.method === 'GET' && pathname === '/api/flights') {
    const origin = (url.searchParams.get('origin') || '').toUpperCase();
    const destination = (url.searchParams.get('destination') || '').toUpperCase();

    if (!origin || !destination) {
      return sendJson(res, 400, { error: 'origin and destination are required' });
    }
    if (origin === destination) {
      return sendJson(res, 400, { error: 'Origin and destination must be different' });
    }
    const results = flights.filter((f) => f.origin === origin && f.destination === destination);
    return sendJson(res, 200, { count: results.length, flights: results });
  }

  // POST /api/bookings   (needs a token)
  if (req.method === 'POST' && pathname === '/api/bookings') {
    const user = getUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorised' });

    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }

    const passenger = body.passenger || {};
    if (!isNonEmptyString(body.flightNumber)) {
      return sendJson(res, 400, { error: 'flightNumber is required' });
    }
    if (!isNonEmptyString(passenger.firstName)) {
      return sendJson(res, 400, { error: 'passenger.firstName is required' });
    }
    if (!isNonEmptyString(passenger.lastName)) {
      return sendJson(res, 400, { error: 'passenger.lastName is required' });
    }

    const flight = flights.find((f) => f.flightNumber === body.flightNumber);
    if (!flight) return sendJson(res, 404, { error: 'Flight not found' });

    const booking = {
      bookingRef: newBookingRef(),
      status: 'CONFIRMED',
      flightNumber: flight.flightNumber,
      passenger: { firstName: passenger.firstName.trim(), lastName: passenger.lastName.trim() },
      totalPrice: flight.price,
    };
    bookings.set(booking.bookingRef, { owner: user, booking });
    return sendJson(res, 201, booking);
  }

  // GET /api/bookings/:ref   (needs a token)
  const match = pathname.match(/^\/api\/bookings\/([A-Za-z0-9]+)$/);
  if (req.method === 'GET' && match) {
    const user = getUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorised' });
    const entry = bookings.get(match[1].toUpperCase());
    if (!entry) return sendJson(res, 404, { error: 'Booking not found' });
    if (entry.owner !== user) return sendJson(res, 403, { error: 'Forbidden' });   // not your booking
    return sendJson(res, 200, entry.booking);
  }

  return sendJson(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(PUBLIC_DIR, path.normalize(requested));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch(() => sendJson(res, 500, { error: 'Internal server error' }));
  } else {
    serveStatic(req, res, url);
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Flight app running at http://localhost:${PORT}`));
}

module.exports = server;
