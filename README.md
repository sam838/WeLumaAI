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
- **Resilient Gemini Fallback Ladder**: Server routes implement an automated fallback ladder ordered by availability and latency:
  1. Primary: `gemini-3.6-flash` / `gemini-3.8-flash`
  2. High-Availability Fallback: `gemini-3.1-flash-lite`
  3. Dynamic Alias: `gemini-flash-latest`
  4. Deep Reasoning Fallback: `gemini-3.7-flash`

---

## Environment & Prerequisites

1. **Google Cloud CLI (`gcloud`)**: Install the Google Cloud SDK and authenticate:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable Required Google Cloud Services**:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     aiplatform.googleapis.com \
     places.googleapis.com
   ```

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

Deploy the following owner-bound security rules to ensure complete user data isolation. Non-authenticated users and other tenants cannot read, list, or tamper with personal journal interactions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Deploy the rules via the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

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
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000

# 2. Apply mandatory campaign label for automated challenge verification
gcloud run services update gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

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
   npm run build
   ```

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
