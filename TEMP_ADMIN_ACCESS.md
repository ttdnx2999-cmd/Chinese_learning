# Temporary admin access

Open `/admin-test` to automatically sign in as the existing `admin` account and
open the home page with all admin functions. No password is requested.
Anyone who can reach this page can become admin while this feature is enabled.

Set `ENABLE_TEMP_ADMIN_ACCESS=true` in `packages/backend/.env` and restart the
backend to enable it. It is disabled when this setting is absent or not `true`.
The admin account must exist, be active, and have the admin role.

Sessions last one hour; revisit `/admin-test` to start another session.
Set `ENABLE_TEMP_ADMIN_ACCESS=false` and restart the backend to disable the entry
and invalidate all temporary admin tokens. Normal logins remain available.
