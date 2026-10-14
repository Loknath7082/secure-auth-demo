# secure-auth-demo

A small JSON API with Argon2id password hashing, server-side sessions in SQLite, an `HttpOnly` session cookie, and CSRF protection.

## Setup

1. Copy the example env file:

   ```bash
   cp .env.example .env
   ```

2. Generate a session secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Paste the output into `.env` as the value of `SESSION_SECRET`. The app refuses to start while it is blank.

3. Install dependencies:

   ```bash
   npm install
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

5. Run the tests:

   ```bash
   npm test
   ```
