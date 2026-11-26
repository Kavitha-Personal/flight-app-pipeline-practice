import { test, expect } from '@playwright/test';

test.describe('GET /api/health and /api/flights', () => {
  test('health check returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('MEL to SYD returns two flights with the documented fields', async ({ request }) => {
    const res = await request.get('/api/flights', { params: { origin: 'MEL', destination: 'SYD' } });

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');

    const body = await res.json();
    expect(body.count).toBe(2);
    for (const flight of body.flights) {
      expect(flight).toMatchObject({
        flightNumber: expect.any(String),
        origin: 'MEL',
        destination: 'SYD',
        departs: expect.any(String),
        price: expect.any(Number),
      });
    }
  });

  test('a route with no flights returns 200 and an empty list', async ({ request }) => {
    const res = await request.get('/api/flights', { params: { origin: 'PER', destination: 'BNE' } });
    expect(res.status()).toBe(200);
    expect((await res.json()).count).toBe(0);
  });

  test('missing query parameters returns 400', async ({ request }) => {
    const res = await request.get('/api/flights');
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('required');
  });

  test('same origin and destination returns 400', async ({ request }) => {
    const res = await request.get('/api/flights', { params: { origin: 'MEL', destination: 'MEL' } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('must be different');
  });

  test('unknown endpoint returns 404', async ({ request }) => {
    const res = await request.get('/api/does-not-exist');
    expect(res.status()).toBe(404);
  });
});
