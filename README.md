# Chinese Learning App

React web app, Express API, and Expo mobile app for Chinese vocabulary learning.

## Local setup

1. Install Node.js and MySQL, then run `npm install`.
2. Copy `packages/backend/.env.example` to `packages/backend/.env` and fill in your database settings, API keys, and a strong random `JWT_SECRET`.
3. Create the database using `packages/backend/database/setup.sql` and configure an admin account using `packages/backend/scripts/setup-admin-user.ts`.
4. Run `npm run dev:backend` and `npm run dev:frontend` in separate terminals.
5. Open http://localhost:5173.

See [temporary admin testing](TEMP_ADMIN_ACCESS.md) for the optional password-free entry, disabled by default.

Local credentials, deployment configuration, generated assets, and previous repository history are excluded.
