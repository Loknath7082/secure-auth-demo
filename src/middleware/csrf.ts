import { csrfSync } from "csrf-sync";

/**
 * csrf-sync implements the OWASP "synchronizer token pattern" for stateful
 * (session-based) apps.
 *
 * Defaults we rely on, and why:
 *  - The token is stored server-side in `req.session.csrfToken`.
 *  - Unsafe methods (everything except GET/HEAD/OPTIONS) must present the token
 *    in the `x-csrf-token` request header.
 *  - Invalid or missing tokens produce an error with code `EBADCSRFTOKEN`,
 *    which the error handler turns into a 403.
 */
export const { csrfSynchronisedProtection, generateToken } = csrfSync();
