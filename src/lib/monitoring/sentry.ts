// Sentry configuration for error monitoring and performance tracking
// https://docs.sentry.io/platforms/javascript/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture Replay for 10% of all sessions,
  // and for 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Filter out localhost and development errors and add custom context
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (
      process.env.NODE_ENV === "development" &&
      !process.env.SENTRY_ENABLE_DEV
    ) {
      return null;
    }

    // Add custom context
    event.contexts = {
      ...event.contexts,
      app: {
        name: "Trainova",
        version: process.env.npm_package_version || "0.1.0",
      },
    };

    return event;
  },
});

/**
 * Capture error with additional context
 */
export function captureError(
  error: Error,
  context?: Record<string, any>,
): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture message with level
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, any>,
): void {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setUserContext(
  userId: string,
  email?: string,
  username?: string,
): void {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>,
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: "info",
  });
}
