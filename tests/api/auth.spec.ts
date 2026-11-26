import { test, expect } from '@playwright/test';
import { requireEnv, loadSession, bearer } from '../helpers/auth';

/**
 * Authentication tests. The three questions behind every one of these:
 *   - Who are you?                (authentication -> 401 if the server cannot tell)
 *   - Are you allowed to do this? (authorisation  -> 403 if the server knows you but says no)
 *   - Does the happy path work?   (200 with a token)
 */
test.describe('Login (POST /api/login)', () => {
  test('valid credentials return a bearer token', async ({ request }) => {
    const res = await request.post('/api/login', {
      data: { username: requireEnv('TEST_USERNAME'), password: requireEnv('TEST_PASSWORD') },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.access_token).toEqual(expect.any(String));
    expect(body.token_type).toBe('Bearer');
    expect(body.expires_in).toEqual(expect.any(Number));
  });

  test('wrong password returns 401', async ({ request }) => {
    const res = await request.post('/api/login', {
      data: { username: requireEnv('TEST_USERNAME'), password: 'definitely-wrong' },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toContain('Invalid');
  });

  test('unknown user returns 401', async ({ request }) => {
    const res = await request.post('/api/login', { data: { username: 'nobody@example.com', password: 'x' } });
    expect(res.status()).toBe(401);
  });

  test('missing password returns 400', async ({ request }) => {
    const res = await request.post('/api/login', { data: { username: requireEnv('TEST_USERNAME') } });
    expect(res.status()).toBe(400);
  });
});

test.describe('Using the token (GET /api/me)', () => {
  test('valid token returns the logged-in user', async ({ request }) => {
    const { main } = loadSession();
    const res = await request.get('/api/me', { headers: bearer(main.token) });

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ username: main.username });
  });

  test('no token returns 401', async ({ request }) => {
    const res = await request.get('/api/me');
    expect(res.status()).toBe(401);
  });

  test('made-up token returns 401', async ({ request }) => {
    const res = await request.get('/api/me', { headers: bearer('not-a-real-token') });
    expect(res.status()).toBe(401);
  });

  test('wrong header format returns 401', async ({ request }) => {
    const { main } = loadSession();
    const res = await request.get('/api/me', { headers: { Authorization: `Token ${main.token}` } });
    expect(res.status()).toBe(401);
  });
});
