# Socio Care – Complete Package (run locally first)

## What is in this folder
```
socio-care-complete
├── backend/          Node.js + Express API (PostgreSQL database)
├── app/              React Native (Expo) app source files
├── setup-app.bat     Windows: builds the runnable app from /app
├── setup-app.sh      Mac/Linux version of the same
└── START-HERE.md     this guide
```

## 1. Install once
1. **Node.js** (LTS) from nodejs.org
2. **PostgreSQL** from postgresql.org/download. Remember the password you set for the `postgres` user.
Restart your computer (or at least the terminal) afterwards.

## 2. Create the database
Open **SQL Shell (psql)** from the Start menu, press Enter at each prompt until it asks for your password, then run:
```
CREATE DATABASE sociocare;
```

## 3. Run the backend
Open a terminal inside the `backend` folder (File Explorer → click the address bar → type `cmd` → Enter).

1. Copy `.env.example` to a new file named `.env` and edit it:
```
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/sociocare
JWT_SECRET=type-any-long-random-text-of-at-least-32-characters
CORS_ORIGINS=http://localhost:8081
DB_SSL=false
PORT=3000
ANTHROPIC_API_KEY=
```
2. Run, one at a time:
```
npm install
npm run migrate
npm run dev
```
3. Open http://localhost:3000/health. You should see `{"ok":true}`. Keep this terminal open.

## 4. Build and run the app
In a **second** terminal in the main folder, run `setup-app.bat` (Windows) or `./setup-app.sh` (Mac/Linux). It creates a `run-app` folder with everything installed and set to talk to `http://localhost:3000`. Then:
```
cd run-app
npx expo start
```
Press **w** to open it in your browser.

To try it on a phone with Expo Go: put your computer's IP address instead of `localhost` in `run-app/.env` (for example `http://192.168.1.5:3000`), add `http://192.168.1.5:8081` to `CORS_ORIGINS`, restart both, and keep phone and computer on the same Wi-Fi. (Native phone apps are not limited by CORS, but the web version is.)

## 5. Test checklist
- [ ] Create an account, sign out, sign in again
- [ ] Add a medicine, tap "I took it", see "Up next" change on Home
- [ ] Book an appointment (date like 2026-12-31, time like 10:30)
- [ ] Add an SOS contact, press SOS, test both Cancel and letting it finish
- [ ] Add a health reading (bad values should be rejected)
- [ ] Family: create an invite code, then in a private window create a second account, enter the code, and view the shared medicines. Turn sharing off and check it stops.
- [ ] Helper: ask "How do I add a medicine?" and "I have chest pain" (it should point you to SOS/112). Try Read aloud (and Speak in Chrome).
- [ ] Settings: switch to Hindi and Telugu, change text size, close and reopen (choices are remembered)
- [ ] Delete account (everything for that user is removed)

## What is included
Email/password login with rotating sessions · medicine reminders and "taken" tracking · appointment booking · on-device reminders on phones (medicines daily, appointments 1 hour before) · SOS with cancel countdown, location and contacts · caregiver invites with per-person consent, revoke and audit log · missed-dose check that finds consenting caregivers to alert · health log with range checks · AI helper with read-aloud and web voice input · English/Hindi/Telugu labels · text-size control · black-and-white card-tile design.

## Honest limits (to do before real users)
- **Alerts are logged, not sent.** SOS and missed-dose alerts need an SMS/push provider (Twilio, MSG91, Firebase). The spot is marked `TODO` in `backend/src/server.js` (`notify` and `POST /sos`).
- **AI helper:** without `ANTHROPIC_API_KEY` it uses simple built-in answers. With a key, the typed question (only that, never stored health data) is sent to Anthropic's API. It is told never to diagnose or advise on doses.
- Notifications work on phones only, not in the browser. Phone voice input needs a native build; the browser supports it in Chrome.
- Translations cover main labels, not every sentence.
- Not yet built: password reset by email, medicine-information database, daily activities beyond reminders (add them as a reminder, e.g. "Evening walk"), date picker, offline mode.
- Run `npm audit`, set up backups, and get privacy-policy and consent text reviewed (health data) before launch.
- The backend was tested against a real PostgreSQL database (registration, login, refresh, medicines, appointments, readings, SOS, caregiver consent, audit, delete). The app screens were syntax-checked but not yet run on a device, so expect small fixes on first run.

## Deploy later
Backend: GitHub → Railway (add PostgreSQL, set the env variables, run `npm run migrate`).
Web app: `npx expo export --platform web` in `run-app`, deploy the `dist` folder on Vercel, set `EXPO_PUBLIC_API_URL` to your Railway URL, and add the Vercel URL to `CORS_ORIGINS`. Set `DB_SSL` as your database requires.
