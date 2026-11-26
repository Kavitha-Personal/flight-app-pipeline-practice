import { test as setup, expect, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import { SESSION_FILE, UI_STATE_FILE, UserSession, requireEnv } from './helpers/auth';

/**
 * Runs ONCE before the API and UI tests (see "dependencies" in playwright.config.ts).
 * This is how real projects handle authentication:
 *   1. credentials come from environment variables (.env locally, GitHub Secrets in CI)
 *   2. log in through the API and get a short-lived token
 *   3. save the token so every test can reuse it instead of logging in again
 */
async function login(request: APIRequestContext, username: string, password: string): Promise<UserSession> {
  const res = await request.post('/api/login', { data: { username, password } });
  expect(res.status(), `Login failed for ${username}. Check the username and password.`).toBe(200);
  const body = await res.json();
  return { username, token: body.access_token };
}

setup('log in the test users and save their sessions', async ({ request, baseURL }) => {
  const main = await login(request, requireEnv('TEST_USERNAME'), requireEnv('TEST_PASSWORD'));
  const other = await login(request, requireEnv('OTHER_USERNAME'), requireEnv('OTHER_PASSWORD'));

  fs.mkdirSync('.auth', { recursive: true });

  // Tokens for the API tests
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ main, other }, null, 2));

  // A "logged in" browser state for the UI tests (the page keeps the token in localStorage)
  const origin = new URL(baseURL as string).origin;
  const uiState = {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: 'access_token', value: main.token },
          { name: 'username', value: main.username },
        ],
      },
    ],
  };
  fs.writeFileSync(UI_STATE_FILE, JSON.stringify(uiState, null, 2));
});
