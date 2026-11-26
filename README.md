# Flight App + Tests + Pipeline (the "real project" way)

One repo that contains **the application and its automated tests**. Every pull request starts a pipeline that
runs the app, logs in with test accounts, runs the API and UI tests, and shows green or red on the pull request.

## 1. The idea in plain English (read this first)

A real project never puts passwords or tokens in the code. It works like this:

```
   Laptop                                  GitHub pipeline
   ------                                  ---------------
   .env file  (NOT in Git)                 GitHub Secrets (Settings page)
        \                                        /
         \______ same names: TEST_USERNAME, TEST_PASSWORD ______/
                               |
                    the tests read them (process.env)
                               |
             log in:  POST /api/login  ->  server returns a TOKEN
                               |
        every test sends the token:  Authorization: Bearer <token>
```

Plain answers to the usual questions:

| Question | Answer |
|---|---|
| Where do usernames and passwords live? | Laptop: `.env` file (ignored by Git). Pipeline: **GitHub Secrets**. |
| Where does the token come from? | The tests **log in** at the start of the run and the server gives back a token. Nobody copies a token by hand. |
| Why not save the token? | Tokens **expire**. Getting a fresh one each run is normal. |
| Who creates the test accounts? | The team. Real projects have dedicated test users per environment. In this repo they are built into the practice app. |
| Why is `.env` ignored by Git? | So secrets never leave your laptop. We commit `.env.example` instead: the variable names with fake or placeholder values. |
| Why two test users? | To test **403**: user B must not read user A's booking. |

## 2. What is in the repo

| App (what gets tested) | Tests | Pipeline and config |
|---|---|---|
| `server.js` (API with login) | `tests/auth.setup.ts` (logs in once) | `.github/workflows/ci.yml` |
| `public/` (web page with login) | `tests/api/*.spec.ts` | `playwright.config.ts` |
| | `tests/ui/*.spec.ts` | `.env.example` (committed) |
| | `tests/helpers/auth.ts` | `.env` (yours, never committed) |

API endpoints of the practice app:

| Endpoint | Needs token? | Results |
|---|---|---|
| `POST /api/login` | no | 200 token, 400 missing fields, 401 wrong credentials |
| `GET /api/me` | yes | 200 who you are, 401 |
| `GET /api/flights?origin=MEL&destination=SYD` | no | 200, 400 |
| `POST /api/bookings` | yes | 201, 400, 401, 404 |
| `GET /api/bookings/:ref` | yes | 200, 401, **403** (someone else's booking), 404 |

Test accounts (practice app only): `qa.customer@example.com` / `Passw0rd!` and `qa.other@example.com` / `Passw0rd!2`.

## 3. Run it on your laptop

```bash
copy .env.example .env        # Windows (PowerShell or cmd). Mac/Linux: cp .env.example .env
npm ci
npx playwright install chromium
npm test
npm run report
```

What happens when you run `npm test`:
1. Playwright starts the app (`npm start`).
2. The **setup** project logs in both users and saves their tokens in `.auth/` (ignored by Git).
3. The **api** and **ui-chromium** projects run, reusing those tokens.
4. Playwright stops the app.

If you forget the `.env` file you get a clear message: *Missing environment variable TEST_USERNAME...* 

## 4. Put it on GitHub and add the secrets (do this BEFORE the first push)

1. Create a **public** repo on github.com (personal account). No README.
2. In the project folder:
```bash
git init
git config user.name "Your Name"
git config user.email "your-personal-email@example.com"
git add .
git status          # check: .env and .auth must NOT be listed
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/flight-app-pipeline-practice.git
git push -u origin main
```
3. On GitHub: **Settings -> Secrets and variables -> Actions -> New repository secret**. Add four secrets (names are case sensitive):

| Name | Value |
|---|---|
| `TEST_USERNAME` | `qa.customer@example.com` |
| `TEST_PASSWORD` | `Passw0rd!` |
| `OTHER_USERNAME` | `qa.other@example.com` |
| `OTHER_PASSWORD` | `Passw0rd!2` |

4. **Actions** tab -> open the first run. If it ran before you added the secrets it fails at
   *Check required secrets exist* with a clear message. Add them, then click **Re-run all jobs**.
5. Leave the repository **variable** `BASE_URL` unset. It is only used to point the tests at a deployed environment.

## 5. Daily workflow (branch, change, pull request, merge)

```bash
git checkout main
git pull
git checkout -b feature/my-change
# edit, save, run: npm test
git add .
git commit -m "Describe the change"
git push -u origin feature/my-change
```
On GitHub click **Compare & pull request** -> **Create pull request**. The pipeline starts automatically.
Red? Open **Details**, find the first red step, read the error, fix, push again (same PR re-runs).
Green? **Merge pull request**, then `git checkout main` and `git pull`.

When does the pipeline run? On every pull request into `main`, on every push to `main` (after a merge),
and manually from the Actions tab. Not on a plain branch push without a pull request.

## 6. Exercises (each one is a real-world situation)

**A. Green baseline.** Push, add the secrets, read the green run, download the `playwright-results` artifact.

**B. Feature change breaks tests.** Add this flight in `server.js` after QF403 on a branch:
`{ flightNumber: 'QF405', origin: 'MEL', destination: 'SYD', departs: '18:45', price: 199.0 },`
Open a PR, it goes red (tests expect 2 flights). Decide: bug or outdated test? Update `flights.spec.ts`
(`toBe(3)`) and `booking-journey.spec.ts` (`toHaveCount(3)`), push, merge.

**C. A secret goes missing.** In GitHub delete `TEST_PASSWORD`, re-run. Read the failure
(*Secret TEST_PASSWORD is missing*). Add it back. Lesson: a missing secret should fail fast with a clear message.

**D. A secret is wrong.** Change `TEST_PASSWORD` to a wrong value, re-run. Now the pipeline fails in the
**setup** test with *Login failed* (401). Lesson: setup failures mean credentials, not the product.

**E. A security bug the tests must catch.** In `server.js` delete the line
`if (entry.owner !== user) return sendJson(res, 403, ...)`. The test *another user cannot read my booking: 403* fails.
Say it aloud: *"User B could read user A's booking, which is an authorisation defect, critical severity."*

**F. Other planted bugs:** change `201` to `200` in the booking response, `totalPrice: String(flight.price)`,
or remove the `lastName` check. Open a PR for each, read Expected/Received, fix.

**G. Token expiry.** Run `set TOKEN_TTL_SECONDS=1` then `npm start` (PowerShell: `$env:TOKEN_TTL_SECONDS=1; npm start`),
log in through the page, wait 2 seconds, try to book: you get *Your session expired*. Lesson: tokens expire, which is why tests log in fresh every run.

**H. Required status check.** Settings -> Branches (or Rules) -> require the **test** check on `main`.
Do not require approvals in a solo practice repo (you cannot approve your own PR).

## 7. Practise the same flow in Postman (how you would explain it in the interview)

1. Environment variables: `baseUrl` = `http://localhost:3000`, `username`, `password`, `token` (leave empty).
2. Request **Login**: `POST {{baseUrl}}/api/login`, body (raw JSON) `{ "username": "{{username}}", "password": "{{password}}" }`.
   In the **Tests** tab: `pm.environment.set("token", pm.response.json().access_token);`
3. Every other request: Authorization tab -> Bearer Token -> `{{token}}`.
4. Run Login first, then `GET {{baseUrl}}/api/me`. Remove the token and see 401. Send a made-up token and see 401.
5. Create a booking with user A's token, then read it with user B's token to see **403**.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `Missing environment variable ...` | Local: `copy .env.example .env`. Pipeline: add the secret. |
| `Login failed for ...` in setup | Wrong username or password in `.env` or in the GitHub secret. |
| Pipeline fails at *Check required secrets exist* | Add the four secrets, then Re-run all jobs. |
| `.env` appears in `git status` | `.gitignore` is missing or `.env` was committed earlier. Stop and fix before pushing. |
| Port 3000 in use | Stop any running `npm start` (Ctrl+C). |
| `npm ci` fails | Run from the folder that contains `package.json`; keep `package-lock.json` committed. |
| UI tests fail locally | Run `npx playwright install chromium`. |

## 9. How to say it in the interview

> "Credentials live in GitHub Secrets for the pipeline and a git-ignored .env file locally, with a committed .env.example listing the names. The tests log in through the API at the start of the run, get a short-lived bearer token, and reuse it, so nothing sensitive is in the repo and tokens are always fresh. I test 401 for missing or bad tokens and 403 when a valid user touches someone else's data. The pipeline fails fast with a clear message if a secret is missing, and the same setup runs on every pull request."

Only say what you have actually done.
