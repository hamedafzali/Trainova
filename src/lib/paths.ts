// Routes that open without a session. A plain module, so server components can read them too.

/** The public introduction to the app, with the downloads. Signed-out visitors also see it at "/". */
export const LANDING_PATH = "/app";

/** Sign in, create an account or continue as a guest. */
export const SIGN_IN_PATH = "/start";
