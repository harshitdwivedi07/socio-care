# Socio Care – Backend (Node.js + Postgres)

## Environment variables
| Name | Value |
|---|---|
| `DATABASE_URL` | Provided by Railway Postgres |
| `JWT_SECRET` | 32+ random characters. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CORS_ORIGINS` | Your Vercel URL(s), comma separated, e.g. `https://socio-care.vercel.app` |
| `DB_SSL` | `false` on Railway's private network; `true` if you use a public DB URL |

Never commit a real `.env` file.

## Run locally
```
npm install
cp .env.example .env   # fill it in
npm run migrate
npm run dev
```

## Deploy on Railway
1. Push this folder to a GitHub repo.
2. Railway → New Project → Deploy from GitHub repo → pick it.
3. Add a **PostgreSQL** database to the same project, then link `DATABASE_URL` into the API service variables.
4. Add `JWT_SECRET`, `CORS_ORIGINS`, `DB_SSL`.
5. Run `npm run migrate` once (Railway shell or a one-off command).
6. Generate a public domain. Test `GET /health`.

## API summary
- Auth: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET/DELETE /me`
- `GET/POST /medicines`, `POST /medicines/:id/taken`, `DELETE /medicines/:id`
- `GET/POST /appointments`; `GET/POST /readings`
- `GET/POST/DELETE /sos/contacts`; `POST /sos`
- Caregivers: `POST /caregivers/invite`, `POST /caregivers/redeem`, `GET /caregivers`, `PATCH/DELETE /caregivers/:id`, `GET /care/:elderId/medicines`
- `GET /audit` (the user can see who accessed their data)

## Security built in
bcrypt (cost 12) password hashing · short-lived JWT + rotating refresh tokens (stored hashed) · login/OTP-style rate limits · zod validation on every body · parameterised SQL only · ownership check on every query · consent-gated caregiver access with audit log · helmet headers · strict CORS · generic error messages · account deletion cascades all data.

## Still needed before real users
- SMS/push provider for SOS and missed-medicine alerts (hook is marked `TODO` in `POST /sos`)
- Scheduled job to detect missed doses and alert consenting caregivers
- Password reset by email, HTTPS-only enforcement at your domain, backups, dependency scanning (`npm audit`) in CI
- Legal review of privacy policy and consent text (health data)
