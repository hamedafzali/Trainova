// Cache key definitions
// Centralized cache key management for consistency

export const CACHE_KEYS = {
  // AI-related cache keys
  AI_ONBOARDING_PROGRAM: (userId: string) => `ai:onboarding:${userId}`,
  AI_WORKOUT_GENERATION: (params: string) => `ai:workout:${params}`,
  AI_WEEKLY_CHECKIN: (userId: string, week: number) => `ai:checkin:${userId}:${week}`,
  AI_COACH_INTRO: (userId: string, contextHash: string) => `ai:coach:intro:${userId}:${contextHash}`,
  AI_COACH_MEALS: (userId: string, contextHash: string) => `ai:coach:meals:${userId}:${contextHash}`,

  // User data cache keys
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  USER_TEMPLATES: (userId: string) => `user:templates:${userId}`,
  USER_SESSIONS: (userId: string) => `user:sessions:${userId}`,
  
  // Exercise library cache
  EXERCISE_LIBRARY: 'exercises:library',
  EXERCISE_BY_ID: (exerciseId: string) => `exercise:${exerciseId}`,
  
  // Device library cache
  DEVICE_LIBRARY: 'devices:library',
  DEVICE_BY_ID: (deviceId: string) => `device:${deviceId}`,
  
  // Progress data cache
  USER_PROGRESS: (userId: string) => `progress:${userId}`,
  PERSONAL_RECORDS: (userId: string) => `prs:${userId}`,
  
  // Session cache
  ACTIVE_SESSION: (userId: string) => `session:active:${userId}`,
  SESSION_BY_ID: (sessionId: string) => `session:${sessionId}`,
} as const;

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  // AI responses - cache for 1 hour
  AI_RESPONSE: 3600,

  // AI Coach responses - training/nutrition context only changes a handful
  // of times a day at most, so cache longer than a one-off generation call.
  AI_COACH: 6 * 3600,

  // User data - cache for 5 minutes
  USER_DATA: 300,
  
  // Static data - cache for 1 hour
  STATIC_DATA: 3600,
  
  // Session data - cache for 1 minute
  SESSION_DATA: 60,
  
  // Progress data - cache for 10 minutes
  PROGRESS_DATA: 600,
} as const;
