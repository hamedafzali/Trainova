// Order matters: storage and crypto must exist before the shared store loads.
import "expo-sqlite/localStorage/install";
import "./src/platform/polyfills";
import "expo-router/entry";
