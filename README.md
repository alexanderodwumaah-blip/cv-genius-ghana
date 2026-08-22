# CV Genius Ghana 🇬🇭

A professional AI-powered CV builder, refiner, and expert review platform built specifically for Ghanaian students, graduates, national service applicants, and working professionals.

---

## Features

### Core Tools
- **Refine Your CV** — Upload or paste your existing CV and get a professionally refined version tailored to your target opportunity (Corporate Job, National Service, Graduate Programme, Banking, Tech, Academia, NGO, and more)
- **Build From Scratch** — Fill in your details across 7 guided tabs and generate a perfectly formatted, print-ready CV
- **CV Score** — Get a 6-metric analysis covering contact info, structure, action language, quantification, date consistency, and length
- **Cover Letter Generator** — Instantly generate a tailored, professional cover letter for any opportunity type
- **CV Tips** — 7 learning tabs including Foundational Rules, Writing Tips, Action Verbs reference, and tips by opportunity type
- **Sample CVs** — View and download sample CVs across Finance/Banking, Engineering, National Service, and Postgraduate profiles

### Expert Review System (New)
- **User CV Submission** (`cv-upload.html`) — Users upload their CV and receive expert human feedback within 24–48 hours
- **AI Instant Scan** — Gemini 2.5 Flash automatically scans every submitted CV and generates a structured JSON report covering formatting, content, language, structure, ATS compatibility, critical issues, and top recommendations
- **Admin Dashboard** (`dashboard.html`) — Full review workspace for the admin including:
  - Submissions table with filter by status and AI scan results
  - Review Workspace with 6 tabs: Overview, AI Analysis, Annotate CV, Feedback, Upload Refined CV, Messages
  - **Canvas Annotation Tool** — draw freehand, circles, boxes, arrows, and text comments directly on CV images
  - **AI Suggestion Integration** — append AI-generated recommendations to feedback with one click
  - **Refined CV Upload** — download the user's CV, refine it manually, upload back; user gets a download link
  - **Push to User** — sends the complete review (feedback + annotation + refined CV) to the user's dashboard
  - **Real-time Messaging** — admin and user can exchange messages on each submission
- **User Dashboard Notifications** — users see a prominent banner in their dashboard when a new review is ready
- **Review Page** — users see annotated CV image, written feedback, score breakdown, and refined CV download on `cv-upload.html`

---

## Tech Stack

Pure HTML, CSS, and JavaScript (ES Modules) — no frameworks, no build tools.

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML + CSS + JS (ES Modules) |
| Auth | Firebase Authentication (Google + Email/Password) |
| Database | Firebase Firestore |
| File Storage | Firebase Storage |
| AI | Google Gemini 2.5 Flash (CV refinement + AI scan) |
| Cover Letters | OpenAI GPT-4o |
| Hosting | Firebase Hosting |

---

## Project Structure

```
cv/
├── index.html          # Main site (CV builder, refiner, tips, samples)
├── cv-upload.html      # User CV submission & review dashboard
├── dashboard.html      # Admin review dashboard (restricted)
├── app.js              # Main app logic (builder, refiner, score, cover letter)
├── firebase-app.js     # Firebase Auth + Firestore module for main site
├── firebase-review.js  # Shared Firebase module for review system
├── style.css           # All styles
├── config.js           # API keys (gitignored — never commit)
├── firebase.json       # Firebase Hosting config
├── firestore.rules     # Firestore security rules
└── storage.rules       # Firebase Storage security rules
```

---

## Firebase Setup (Required for Review System)

### 1. Enable Firebase Storage
In your Firebase Console → Storage → Get Started.
Deploy storage rules:
```bash
firebase deploy --only storage
```

### 2. Deploy Updated Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 3. Register Admin Accounts
The admin dashboard (`dashboard.html`) checks for a document in the `admins` Firestore collection.
To grant admin access, go to Firebase Console → Firestore → create a document manually:

```
Collection: admins
Document ID: <the admin's Firebase UID>
Fields: { email: "admin@yoursite.com", role: "admin" }
```

To find a user's UID: Firebase Console → Authentication → Users → copy the UID.

### 4. config.js (never commit this file)
```js
window.__GEMINI_KEY__ = 'your-gemini-api-key';
window.__OPENAI_KEY__ = 'your-openai-api-key';
```
This file is gitignored but must be present on your hosting deployment.

---

## Firestore Collections

| Collection | Purpose |
|---|---|
| `cvs` | User-saved CVs (built/refined/cover letters) |
| `cv_submissions` | Expert review submissions from users |
| `cv_reviews` | Admin review feedback, annotation URLs, refined CV URLs |
| `cv_messages` | Real-time messages between admin and user per submission |
| `admins` | Admin registry (UID → admin record) |

---

## Local Development

Just open `index.html` in a browser, or serve with any static server:

```bash
npx serve .
# or
python -m http.server 5500
```

> **Note:** Firebase Storage uploads require HTTPS or localhost. Running on `file://` will block uploads. Use a local server.

## Deployment

```bash
firebase deploy
```

Or deploy to Vercel/Netlify — all files are static. Make sure `config.js` is deployed but not in Git.

---

Built with 🇬🇭 by [alexanderodwumaah-blip](https://github.com/alexanderodwumaah-blip)
