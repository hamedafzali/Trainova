// The Trainova server the app talks to. Override per build with
// EXPO_PUBLIC_API_URL (e.g. a staging host in eas.json).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://trainova.eu.cc").replace(/\/$/, "");
