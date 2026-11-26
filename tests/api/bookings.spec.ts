import { test, expect } from '@playwright/test';
import { loadSession, bearer, Session } from '../helpers/auth';

const validBooking = {
  flightNumber: 'QF401',
  passenger: { firstName: 'Sam', lastName: 'Lee' },
};

test.describe('Bookings API', () => {
  let session: Session;

  // Runs after the setup project has logged in and saved the tokens.
  test.beforeAll(() => {
    session = loadSession();
  });

  test('creating a booking returns 201 and the documented shape', async ({ request }) => {
    const res = await request.post('/api/bookings', { headers: bearer(session.main.token), data: validBooking });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.bookingRef).toMatch(/^[A-Z0-9]{6}$/);
    expect(body.status).toBe('CONFIRMED');
    expect(body.passenger).toEqual({ firstName: 'Sam', lastName: 'Lee' });
    expect(typeof body.totalPrice).toBe('number');   // a classic bug: price returned as a string
    expect(body.totalPrice).toBe(189);
  });

  test('data is consistent: GET returns what POST created', async ({ request }) => {
    const headers = bearer(session.main.token);
    const created = await (await request.post('/api/bookings', { headers, data: validBooking })).json();

    const res = await request.get(`/api/bookings/${created.bookingRef}`, { headers });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual(created);
  });

  test('no token returns 401', async ({ request }) => {
    const res = await request.post('/api/bookings', { data: validBooking });
    expect(res.status()).toBe(401);
  });

  test('invalid token returns 401', async ({ request }) => {
    const res = await request.post('/api/bookings', { headers: bearer('wrong-token'), data: validBooking });
    expect(res.status()).toBe(401);
  });

  test('another user cannot read my booking: 403 (authorisation)', async ({ request }) => {
    const created = await (
      await request.post('/api/bookings', { headers: bearer(session.main.token), data: validBooking })
    ).json();

    const asOther = await request.get(`/api/bookings/${created.bookingRef}`, { headers: bearer(session.other.token) });
    expect(asOther.status()).toBe(403);

    const asOwner = await request.get(`/api/bookings/${created.bookingRef}`, { headers: bearer(session.main.token) });
    expect(asOwner.status()).toBe(200);
  });

  test('reading a booking without a token returns 401', async ({ request }) => {
    const created = await (
      await request.post('/api/bookings', { headers: bearer(session.main.token), data: validBooking })
    ).json();
    const res = await request.get(`/api/bookings/${created.bookingRef}`);
    expect(res.status()).toBe(401);
  });

  test('missing lastName returns 400 with a clear message', async ({ request }) => {
    const res = await request.post('/api/bookings', {
      headers: bearer(session.main.token),
      data: { flightNumber: 'QF401', passenger: { firstName: 'Sam' } },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('lastName');
  });

  test('blank firstName returns 400', async ({ request }) => {
    const res = await request.post('/api/bookings', {
      headers: bearer(session.main.token),
      data: { flightNumber: 'QF401', passenger: { firstName: '   ', lastName: 'Lee' } },
    });
    expect(res.status()).toBe(400);
  });

  test('unknown flight returns 404', async ({ request }) => {
    const res = await request.post('/api/bookings', {
      headers: bearer(session.main.token),
      data: { flightNumber: 'XX999', passenger: { firstName: 'Sam', lastName: 'Lee' } },
    });
    expect(res.status()).toBe(404);
  });

  test('malformed JSON returns 400, not 500', async ({ request }) => {
    const res = await request.post('/api/bookings', {
      headers: { ...bearer(session.main.token), 'Content-Type': 'application/json' },
      data: '{ this is not json',
    });
    expect(res.status()).toBe(400);
  });

  test('getting an unknown booking returns 404', async ({ request }) => {
    const res = await request.get('/api/bookings/ZZZZZZ', { headers: bearer(session.main.token) });
    expect(res.status()).toBe(404);
  });
});
