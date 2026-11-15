# Socio Care

A health and safety companion app for elderly people and their families. It keeps medicines, appointments and emergency contacts in one simple, large-print app, with an AI helper for everyday questions.

## Download the Android app

Install the APK from the Expo build page:

**[Download Socio Care (Android APK)](https://expo.dev/accounts/gowri_1121/projects/run-app/builds/7187fd13-8328-4d69-b400-4fd999b6a675)**

How to install:
1. Open the link above on your Android phone.
2. Tap the download button and wait for the APK to finish downloading.
3. If Android asks, allow **Install unknown apps** for your browser, then install.
4. Open Socio Care, create an account, and sign in.

## Features

- **Medicines:** daily list, "I took it" tracking, and an **Ask AI** button that explains a medicine in plain words.
- **Appointments:** add and view upcoming doctor visits.
- **Emergency SOS:** 5-second countdown, then a ready-to-send alert with a map location link. The user sends it by SMS or WhatsApp, or calls 112.
- **Family:** invite relatives and choose what each person can see.
- **Health log:** record readings and notes.
- **Helper:** an AI chat for app help and general wellbeing tips. It does not diagnose or recommend medicines.
- **Settings:** English, Hindi and Telugu, adjustable text size, sign out, and delete account.

## Tech stack

| Part | Technology |
|---|---|
| App | React Native with Expo (runs on Android and in the browser) |
| Backend | Node.js with Express |
| Database | PostgreSQL |
| Security | bcrypt password hashing, JWT login tokens, zod validation, rate limiting, CORS |
| AI | Groq API (`openai/gpt-oss-120b`) |
| Hosting | Render (backend and database) |
| Android build | Expo EAS Build |
| Code | JavaScript (app and backend) and SQL (database) |

## Project structure

```
backend/     Express API, database schema and migration script
app/         Source files for the app screens, theme and API calls
run-app/     The runnable Expo project
setup-app.*  Scripts that generate run-app from the app/ files
```

## Run it locally

You need Node.js 20 or newer, Git, and a PostgreSQL database (for example a free Neon project).

```bash
git clone https://github.com/harshitdwivedi07/socio-care.git
cd socio-care
```

**1. Backend**
```bash
cd backend
cp .env.example .env      # on Windows: copy .env.example .env
npm install
npm run migrate           # creates the tables
npm run dev               # starts the API on port 3000
```

Fill in `backend/.env` with:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `JWT_SECRET` | A random string of 32 or more characters |
| `DB_SSL` | `true` for hosted databases, `false` for a local one |
| `CORS_ORIGINS` | Address of the web app, e.g. `http://localhost:8081` |
| `PORT` | `3000` |
| `GROQ_API_KEY` | Your own key from console.groq.com (optional; without it the AI uses fixed fallback answers) |

Open `http://localhost:3000/health`. You should see `{"ok":true}`.

**2. App** (in a second terminal)
```bash
cd run-app
npm install
echo "EXPO_PUBLIC_API_URL=http://localhost:3000" > .env
npx expo start            # press w to open it in the browser
```

Never commit `.env` files. They are listed in `.gitignore`.

## Deployment

- **Backend and database:** Render (Node web service with root directory `backend`, plus a PostgreSQL database).
- **Android app:** built with `eas build --platform android --profile preview`, with `EXPO_PUBLIC_API_URL` set to the live backend address.

## Important notes

- Socio Care is a student project. It is **not a medical device** and does not replace a doctor or emergency services. In an emergency, call **112**.
- SOS alerts are **not sent automatically**. The app prepares the message and the user taps Send in SMS or WhatsApp.
- The AI helper does not give diagnoses, medicine recommendations or doses. Always ask a doctor or pharmacist.
- Use test data only while experimenting. The app handles health information.

## Credits

- Built by **GOWRI SRI**
- Thanks to **HARSHIT DWIVEDI** for [what he did, e.g. testing, ideas, the Android build]
- Built with help from AI coding assistants
