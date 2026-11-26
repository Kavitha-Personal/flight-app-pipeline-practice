import fs from 'fs';

// Files written by tests/auth.setup.ts once per test run. Both are git-ignored (.auth/).
export const SESSION_FILE = '.auth/session.json';   // tokens for the API tests
export const UI_STATE_FILE = '.auth/ui-state.json'; // logged-in browser state for the UI tests

export interface UserSession {
  username: string;
  token: string;
}

export interface Session {
  main: UserSession;   // the main test user
  other: UserSession;  // a second user, used to prove one user cannot see another user's data
}

/** Read a required setting from the environment (.env locally, GitHub Secrets in the pipeline). */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        'Locally: copy .env.example to .env. ' +
        'In the pipeline: add it under Settings -> Secrets and variables -> Actions.',
    );
  }
  return value;
}

export function loadSession(): Session {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error('No saved login session found. Run the whole suite so the "setup" project runs first.');
  }
  return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8')) as Session;
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
