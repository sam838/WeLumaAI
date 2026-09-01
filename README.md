# Gemini Journal & Reflections

A secure, user-authenticated journaling and cognitive reflection application built with Google AI Studio, powered by the **Gemini 3.6 Flash API**, **Firebase Authentication (Google Sign-In)**, and **Cloud Firestore**.

All journal entries and AI reflections are strictly isolated to each authenticated user path in Firestore, protected by granular Attribute-Based Access Control (ABAC) rules.

---

## Architecture Overview

- **Frontend & App Engine**: React 19 + TypeScript + Tailwind CSS with responsive layout and multi-turn reflection stream.
- **Backend Service**: Express.js server providing secure API proxies to keep `GEMINI_API_KEY` hidden server-side.
- **AI Processing Engine**: Gemini 3.6 Flash with automated fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`).
- **User Identity**: Firebase Authentication via federated Google Sign-In (no passwords stored in application code).
- **Backend Database**: Google Cloud Firestore with owner-bound path isolation (`/users/{userId}/interactions/{interactionId}`).
- **Secret Management**: Google Cloud Secret Manager / runtime environment variables.

---

## Prerequisites & Environment Setup

1. **Google Cloud CLI**: Ensure `gcloud` is installed and authenticated:
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
     aiplatform.googleapis.com
   ```

---

## Secret Management Setup

To keep the Gemini API key secure and comply with zero-hardcoding standards, store the credential in Google Cloud Secret Manager and grant the Cloud Run runtime service account permission to read it:

```bash
# 1. Create and populate the secret in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Identify your Cloud Project Number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# 3. Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Cloud Firestore Security Rules

Deploy the following security rules to ensure user data isolation so that users cannot read, list, or tamper with each other's journal interactions:

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

Deploy the rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## Cloud Run Deployment

Deploy the containerized application to Google Cloud Run:

```bash
# 1. Build and deploy to Cloud Run with Secret Manager mounting
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

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY in .env
   ```

3. Start unified full-stack dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the application.
