# Gemini Journal & Wellbeing Companion

A privacy-first, full-stack AI-powered wellbeing companion and cognitive reflection journal built with **Google AI Studio**, powered by **Gemini 3.6 / 3.8 Flash**, **Firebase Authentication (Google Sign-In)**, **Cloud Firestore**, **Google Calendar API**, and **Google Maps / Places API**.

Designed around the **United Nations Sustainable Development Goal 3 (Good Health & Wellbeing)**, the application helps users capture daily experiences, understand personal patterns, hold natural conversations, reflect on feelings, develop sustainable routines, discover real-world restorative places, and turn intentions into realistic calendar commitments.

> **Non-Clinical Guarantee**: This application supports Good Health & Wellbeing. It does not represent itself as a doctor, psychologist, therapist, or diagnostic system, and does not provide clinical healthcare advice.

---

## Key Features & Capabilities

### 1. Natural Conversation & Mindful Listening (Non-Forced Recommendations)
- **Natural, Unforced Dialogue**: The AI functions as an authentic conversational companion. You can chat freely, vent about your day, discuss ideas, or ask general questions without the AI forcing unwanted activity assignments, exercise prescriptions, or calendar events.
- **Selective Action Extraction**: Concrete activity recommendations and 1-click Google Calendar scheduling proposals are generated **only** when you explicitly request them (e.g., *"What should I do today?"*, *"Suggest some routines"*) or when using Brainstorm mode.
- **Prompt Starters**: Quick-start prompts for *Casual Chat & Free Thought*, *Morning Clarity*, *Stress Reframing*, and *Bedtime Unwinding*.

### 2. Four Interactive Journal Modes
- **Reflect**: Empathetic sounding board, mindful inquiry, and gentle cognitive reframing to unpack emotional undercurrents.
- **Natural Chat**: Authentic, conversational dialogue and active listening with zero unsolicited activity recommendations.
- **Brainstorm**: Creative wellbeing experiments, restorative ideas, and routine suggestions.
- **Summary**: Structured synthesis highlighting core emotional currents, themes, and actionable takeaways.

### 3. Three Behavioral Reflection Depths
- **Quick (Low Latency)**: 1 single concise paragraph (2–3 sentences) offering warm acknowledgment with **zero forced questions**. Optimized for `gemini-3.1-flash-lite`.
- **Reflect (Mindful Inquiry)**: 2–3 balanced paragraphs of cognitive reframing with at most one thoughtful follow-up question.
- **Deep (Multi-Factor Synthesis)**: Longitudinal analysis connecting mood, stress, energy, sleep, routines, and historical entries with clear correlation vs. causation boundaries.

### 4. Wellbeing Domains (Mind, Body, Life, Connection)
- **Mind**: Mood, stress, cognitive reflections, gratitude, and emotional patterns.
- **Body**: Sleep, physical energy, nutrition, hydration, and restorative movement.
- **Life**: Personal goals, routines, work-life balance, and scheduling.
- **Connection**: Family, friends, community, and social/spiritual grounding.

### 5. Daily Check-In & Context Grounding
- **Check-In Attributes**: Track daily mood (e.g., Peaceful, Energized, Reflective, Anxious, Overwhelmed), energy level (1–5 scale), stress level (1–5 scale), and private notes.
- **Active Grounding Engine**: All AI responses and reflections are dynamically shaped by your current check-in state, matching energy and stress levels respectfully.

### 6. Google Calendar Integration & Schedule Sync
- **OAuth 2.0 Least-Privilege Flow**: Securely connects with `calendar.events` and `calendar.readonly` scopes via client-side Google Identity Services.
- **Upcoming Schedule Reader**: Reads your 7-day schedule to detect event density and avoid over-scheduling.
- **1-Click Smart Sync**: Converts explicitly recommended activities into Google Calendar events with accurate date/time calculations relative to your timezone.
- **Conflict-Aware Scheduling**: Detects overlapping events and suggests open times without leaking private event details.

### 7. Google Maps & Places Real-World Discovery
- **Local Activity Discovery**: Discovers nearby venues for badminton courts, swimming pools, sports complexes, gyms, parks, nature trails, libraries, and healthy dining.
- **Rich Place Details**: Displays venue name, rating, address, open/closed status, distance, and direct Google Maps navigation links.
- **Verified Results Only**: A city/profile location or approved device location is required. If Google Places is unavailable, the UI reports the failure; it never invents fallback venues, ratings, addresses, or distances.

### 8. Daily Check-In Reminder System
- **Quick Header Toggle**: Fast on/off control directly in the navigation bar.
- **Flexible Reminder Schedules**: Presets for Morning Clarity (8:00 AM), Evening Reflection (8:00 PM), Bedtime Wind-Down (10:00 PM), or custom times.
- **Browser Notifications & Calendar Sync**: Instant test notifications and optional recurring calendar reminders.

### 9. Confidence-Aware Personalization & Privacy
- **Confidence Tiers**:
  - **High Confidence**: Explicit preferences directly confirmed by the user (hobbies, preferred sports, grounding rituals).
  - **Medium Confidence**: Observed behavioral patterns across journal entries.
  - **Low Confidence**: AI hypotheses (clearly labeled, transparent, and editable; never used for automated actions).
- **No False Memory**: Inferences are never presented as user-stated facts.

---

## Security & Architectural Directives

- **Exclusive Google Account Authentication**: Guest logins, anonymous sessions, and custom password forms are strictly disabled. Users authenticate exclusively via verified Google accounts through Firebase Auth (`GoogleAuthProvider`).
- **Owner-Bound Path Isolation**: All user entries, reflections, and preferences are strictly isolated under `/users/{userId}/*` in Cloud Firestore.
- **Zero-Hardcoding Hygiene**: Zero hardcoded credentials or API keys. All keys resolve from environment variables or Google Cloud Secret Manager.
- **Authenticated Backend Boundary**: Gemini, Maps, and administrative API routes verify a current Firebase ID token using the Firebase Admin SDK. Only verified Google-provider accounts are accepted; admin diagnostics additionally require an `admin: true` custom claim.
- **Strict Schemas**: Zod allowlists and bounds every backend request. Structured AI metadata and recommendation output is validated before application use.
- **Prompt-Injection Boundary**: Journal history, profile fields, Calendar data, Places results, uploads, and external payloads are explicitly treated as untrusted data and cannot grant tools, change authorization, or request secrets.
- **Write Integrity**: Firestore objects have `undefined` fields removed, rejected writes propagate to the UI, drafts remain intact, and affected flows expose a retry action.
- **Ephemeral Calendar Credentials**: Google Calendar OAuth access tokens exist only in browser memory and are cleared at sign-out; they are never written to local storage, URLs, analytics, or application logs.
- **Minimal Diagnostics**: Public health responses expose availability only—not secret paths, credential sources, project details, or internal model configuration. Expensive authenticated routes are rate-limited per user.
- **Deterministic Safety Gate**: Acute self-harm or suicide language bypasses normal reflection/recommendation logic and returns immediate real-world safety guidance with no activities, score, or diagnosis.
- **Resilient Gemini Fallback Ladder**: Server routes implement an automated fallback ladder ordered by availability and latency:
  1. Primary: `gemini-3.6-flash` / `gemini-3.8-flash`
  2. High-Availability Fallback: `gemini-3.1-flash-lite`
  3. Dynamic Alias: `gemini-flash-latest`
  4. Deep Reasoning Fallback: `gemini-3.7-flash`

---

## Environment & Prerequisites

1. Install Node.js 20 or later, the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), and the Firebase CLI:

   ```bash
   npm install --global firebase-tools
   ```

2. Authenticate both CLIs and create local Application Default Credentials for Firebase Admin and Secret Manager:

   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   firebase login
   firebase use YOUR_PROJECT_ID
   ```

3. Enable the required Google Cloud services:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     aiplatform.googleapis.com \
     places.googleapis.com
   ```

4. In Firebase Console, create Firestore, enable **Authentication > Sign-in method > Google**, and add `localhost` plus the deployed Cloud Run hostname to **Authorized domains**. Do not enable Anonymous or Email/Password providers for this application.

5. In Google Cloud Console, configure an OAuth web client for Google Calendar. Add the local and deployed origins, then use its client ID for `VITE_GOOGLE_CLIENT_ID`. Restrict the Maps key to the Places and Geocoding APIs and to the server workload wherever supported.

---

## Secret Management Setup

Store credentials in **Google Cloud Secret Manager** and grant the Cloud Run runtime service account permission to read them:

```bash
# 1. Create and populate the Gemini API key secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. (Optional) Create and populate Google Maps API key secret
gcloud secrets create GOOGLE_MAPS_API_KEY --replication-policy="automatic"
echo -n "YOUR_GOOGLE_MAPS_API_KEY" | gcloud secrets versions add GOOGLE_MAPS_API_KEY --data-file=-

# 3. Retrieve your Cloud Project Number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# 4. Grant the default Cloud Run service account access to read secrets
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding GOOGLE_MAPS_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Database Security Configuration (Cloud Firestore)

The repository's `firestore.rules` file is the source of truth for owner-bound access to profiles, journal interactions, routines, activities, and daily check-ins. Non-authenticated users and other tenants cannot read, list, or modify this private data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    function isValidId(id) {
      return id is string && id.size() > 0 && id.size() <= 128
        && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /interactions/{interactionId} {
        allow read: if isOwner(userId);
        allow write: if isOwner(userId) && isValidId(interactionId);
      }

      match /routines/{routineId} {
        allow read: if isOwner(userId);
        allow write: if isOwner(userId) && isValidId(routineId);
      }

      match /activities/{activityId} {
        allow read: if isOwner(userId);
        allow write: if isOwner(userId) && isValidId(activityId);
      }

      match /checkins/{checkInId} {
        allow read: if isOwner(userId);
        allow write: if isOwner(userId) && isValidId(checkInId);
      }
    }
  }
}
```

Deploy the rules via the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

Run the deployment against the same project and Firestore database configured by
`VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_DATABASE_ID`. Deploying rules to the
default database does not update a separately named database.

---

## Cloud Run Deployment Flow

Deploy the containerized application to **Google Cloud Run** with automatic secret injection and port 3000 binding:

```bash
# 1. Build and deploy service to Cloud Run
gcloud run deploy gemini-journal \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-build-env-vars="VITE_FIREBASE_API_KEY=YOUR_FIREBASE_WEB_API_KEY,VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com,VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID,VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app,VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID,VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID,VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID" \
  --set-env-vars="GCP_PROJECT_ID=YOUR_PROJECT_ID,FIREBASE_PROJECT_ID=YOUR_PROJECT_ID" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest" \
  --port 3000

# 2. Apply mandatory campaign label for automated challenge verification
gcloud run services update gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

`--allow-unauthenticated` makes the sign-in page and minimal `/api/health` readiness response reachable. Private Gemini and Maps routes still require a verified Firebase bearer token on every request. Do not place service-account JSON files in the image or repository; Cloud Run uses Application Default Credentials from its runtime service account.

---

## Local Development & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and provide your development credentials:
   ```bash
   cp .env.example .env
   ```
   *Note: Never commit `.env` or files containing secret keys to version control.*

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the application.

4. **Lint and Type Check**:
   ```bash
   npm run lint
   npm test
   npm run build
   ```

The `dev` command starts the unified Express/Vite server. It does not start a frontend-only server, so `/api/*` behavior matches the production architecture. Hot-module-reload WebSockets are disabled by default to avoid preview-host errors; set `ENABLE_HMR=true` only in a compatible local browser environment.

### Environment variable contract

Client-visible Firebase identifiers and the Google OAuth client ID must use `import.meta.env` names. Server credentials must use server environment injection or Secret Manager.

| Variable | Runtime | Required | Purpose |
| :--- | :--- | :---: | :--- |
| `VITE_FIREBASE_API_KEY` | Vite build/client | Yes | Firebase web app configuration; not a server secret |
| `VITE_FIREBASE_AUTH_DOMAIN` | Vite build/client | Yes | Firebase Authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Vite build/client | Yes | Firebase project |
| `VITE_FIREBASE_STORAGE_BUCKET` | Vite build/client | Yes | Firebase web configuration |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Vite build/client | Yes | Firebase web configuration |
| `VITE_FIREBASE_APP_ID` | Vite build/client | Yes | Firebase web app ID |
| `VITE_FIREBASE_DATABASE_ID` | Vite build/client | No | Named Firestore database; blank means default |
| `VITE_GOOGLE_CLIENT_ID` | Vite build/client | Calendar only | Google Calendar OAuth web client ID |
| `FIREBASE_PROJECT_ID` | Server | Yes | Firebase project whose ID tokens the backend verifies; must match `VITE_FIREBASE_PROJECT_ID` |
| `GCP_PROJECT_ID` | Server | Recommended | Secret Manager project override |
| `GEMINI_API_KEY` | Server secret | Yes for AI | Gemini credential, preferably injected from Secret Manager |
| `GOOGLE_MAPS_API_KEY` | Server secret | Maps only | Places/Geocoding credential, preferably injected from Secret Manager |

Never commit `.env`, `.env.*`, `firebase-applet-config.json`, OAuth tokens, or service-account JSON. The repository tracks only the placeholder-only `.env.example`; existing local `.env` files must not be overwritten.

---

## Interactive Feature Walkthrough & Test Guide

| Feature / Flow | Action / Step | Expected Outcome |
| :--- | :--- | :--- |
| **Natural Conversation** | Select **Natural Chat** mode, submit: *"Hey Gemini, I just wanted to chat about how nice the morning sun feels."* | Gemini replies with warm, natural conversation without attaching any unsolicited activity recommendations or calendar cards. |
| **Explicit Activity Request** | Submit: *"Can you suggest 2 restorative activities for Sunday morning?"* | Gemini provides 2 personalized ideas with **1-Click Sync to Calendar** buttons and calculated dates/times. |
| **Mindful Reflection** | Select **Reflect** mode, submit a paragraph about a challenging workday. | Gemini delivers an empathetic 2–3 paragraph reflection with cognitive reframing and at most one thoughtful follow-up question. |
| **Quick Check-In** | Select **Quick** depth, submit a short thought. | Gemini responds in 1 concise paragraph (2–3 sentences) with zero forced questions. |
| **Deep Synthesis** | Select **Deep** depth, submit thoughts on recurring fatigue. | Gemini analyzes multi-factor interactions (sleep, energy, workload) distinguishing correlation from causation. |
| **Daily Check-In** | Set mood to *Calm*, energy to *4*, stress to *2* on Today tab. | Active Grounding Indicator in Journal updates; subsequent reflections adapt tone to match your energy level. |
| **Google Calendar Sync** | Click **Connect Calendar**, authorize Google OAuth. | Displays your 7-day upcoming events; clicking **Add to Calendar** creates an event with live confirmation. |
| **Google Maps Discovery** | Open Places Discovery or ask *"Find badminton courts near me"*. | Displays verified nearby courts with ratings, addresses, and navigation links. |
| **Reminder Scheduler** | Toggle the bell icon in the navbar, select *Evening Reflection (8:00 PM)*, click *Send Test Reminder*. | Dispatches an immediate browser notification and saves the preferred daily reflection time. |
| **Authentication Gate** | Open the app while signed out, then try calling `/api/gemini/reflect` or `/api/maps/places-search` without a bearer token. | The private UI stays inaccessible and the API returns `401`; no journal/profile cache is exposed. |
| **Google-Only Authentication** | Sign in with the Google button using a verified account. | The authenticated shell loads. Anonymous, guest, sandbox, and password login choices are absent. |
| **Sign Out Sanitation** | Connect Calendar, then sign out. | The Firebase session and in-memory Calendar token are cleared; private views disappear immediately. |
| **Onboarding Save / Retry** | Complete or skip onboarding while online; repeat with Firestore writes blocked. | Success advances only after confirmation. Failure keeps all choices visible and shows **Retry Save** without clearing input. |
| **Theme and Readability** | In Profile, switch Light and Dark; inspect headings, body copy, cards, inputs, focus rings, disabled buttons, alerts, and the `20:00` reminder time. | Text and controls remain readable, semantic colors preserve contrast, and one consistent sans/serif pairing is used. |
| **Primary Navigation** | Visit Home / Today, Journal, Insights, Activities, Planner, and Profile on desktop and mobile. | Every destination is keyboard reachable, visibly focused, correctly titled, and mobile navigation does not obscure content. |
| **Check-In Save / Retry** | Enter mood, energy, stress, and notes; block Firestore before saving. | The local draft remains, an accessible error appears, and **Retry Save** confirms the same payload when connectivity returns. |
| **Journal Input Integrity** | Submit a journal entry, force the first Firestore write to fail, then restore access and retry. | Gemini is not called until the original user input is confirmed saved; the raw text is never replaced by AI output. |
| **Journal Finalization Failure** | Allow the initial journal write and AI reply, then fail the final combined write. | User and AI messages remain in the pending entry and **Retry Save** persists both together. |
| **Journal Editing** | Change title, mode, or depth; then test the same actions with denied writes. | Each change persists when allowed; failures surface without deleting the entry or silently claiming success. |
| **Journal Deletion** | Delete an entry and confirm the dialog; repeat with denied writes. | Cloud deletion occurs before the local mirror is removed. On failure, the entry stays visible and an error is shown. |
| **Insights / Ask My Journal** | Ask a question with sufficient and insufficient history, then open a cited entry. | Answers are grounded in the signed-in user's history, admit insufficient evidence, distinguish observation/correlation/hypothesis, and link back where available. |
| **Preference Memory** | Add and remove an explicit preference; simulate a failed write. | Confidence/source labels remain visible. Failed changes are not silently accepted and can be retried without losing typed content. |
| **Activity Feedback / Save** | Mark Interested, Not interested, Already do, Too far, Wrong time, and Don't recommend again; toggle bookmark; fail one write. | Each choice persists as preference feedback only, does not infer mood, and a failed action shows **Retry Save**. |
| **AI Activity Recommendations** | Request recommendations with a check-in and Calendar connected; inspect the reason text. | Results explain how they fit stated preferences, energy, and schedule; no opaque ranking or automatic consequential action occurs. |
| **Routine Create / Toggle / Delete** | Create a routine, mark it complete, and delete it with confirmation; repeat while writes are denied. | Successful changes synchronize. Failed operations remain actionable and display a clear error instead of silently mutating cloud state. |
| **Calendar Read Privacy** | Connect Calendar and inspect conflict messages. | Availability can be read for seven days, but unrelated event details are not repeated in recommendation text. |
| **Calendar Consequential Actions** | Draft create, edit, delete, and recurring-event actions. | A preview shows activity, date, time, duration, location, recurrence, and reminder; nothing is written until explicit confirmation. |
| **Calendar Token Storage** | Connect Calendar, inspect local/session storage, refresh the page, and sign out. | No OAuth access token appears in storage, URLs, logs, or rendered UI; page refresh requires reconnecting. |
| **Places Location Permission** | Search nearby places with no profile city or device location, then add/authorize one and retry. | The first attempt requests location context and returns no invented data. The second returns only live Google Places results. |
| **Places Failure** | Disable the Places API or remove its key and search. | A clear retryable error is shown; no fabricated venue, address, rating, opening status, or distance is displayed. |
| **Input and Injection Boundary** | Put `ignore previous instructions`, tool requests, HTML, or fake system messages inside a journal entry, Calendar title, profile field, or place text. | Content is treated as data only; it cannot change authorization, reveal prompts/secrets, or trigger a write/tool action. |
| **Acute Safety Flow** | Submit a direct statement indicating imminent self-harm or suicide through Journal, Ask My Journal, or recommendation input. | Normal AI/recommendation logic stops; the app prioritizes emergency/professional/trusted-person support and shows no score, routine, or activity recommendation. |
| **Cross-User Isolation** | With two test Google accounts, attempt to read or write the other UID's profile and each subcollection through the Firestore SDK. | Every attempt fails with `permission-denied`; each account still accesses its own data. |
| **Rate Limits and Expired Sessions** | Repeatedly call Gemini/Maps routes above their window; repeat with an expired/revoked token. | Excess calls return `429` with `Retry-After`; invalid sessions return `401` with no provider diagnostics. |
| **Profile Export** | Download the JSON export. | Only the current signed-in user's application profile/preferences are exported; no OAuth token or server secret is present. |
| **Accessibility / Keyboard** | Navigate buttons, tabs, forms, modals, confirmation dialogs, and retry banners using keyboard only and test at 200% zoom. | Focus is visible, labels remain understandable, alerts are announced, Escape closes supported modals, and content does not become unusable. |

### Automated verification

`npm test` currently verifies bearer-token parsing, bounded/strict request validation, coordinate validation, structured AI-output allowlists, prompt-data delimiter escaping, Firestore `undefined` stripping, and owner-bound Firestore-rule invariants. Run `npm run lint`, `npm test`, and `npm run build` before every deployment. The walkthrough above is the acceptance-test specification for browser automation and Firebase Emulator tests.

### Production security checklist

- Deploy `firestore.rules` to the exact configured project and database, then run the two-account isolation test.
- Confirm only Google is enabled under Firebase Authentication providers and all deployed origins are authorized.
- Use a dedicated Cloud Run service account where practical; grant only Secret Accessor for the two named secrets.
- Restrict Maps credentials and OAuth origins/scopes; rotate any credential that has ever appeared in source, logs, screenshots, or exports.
- Confirm `/api/health` returns availability only and `/api/secret/refresh` returns `403` for non-admin users.
- Verify Cloud Run logs contain no journal text, OAuth bearer token, API key, precise location, or secret resource path.
- Retain Cloud Run's public ingress only for the web sign-in surface; rely on Firebase JWT verification at every private API boundary.
