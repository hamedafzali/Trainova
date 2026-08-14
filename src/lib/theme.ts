export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "trainova-theme";

/** Inline, blocking (runs before paint) — sets data-theme before hydration so
 * an explicit light/dark choice never flashes the wrong theme. "system"
 * intentionally sets nothing: the CSS prefers-color-scheme query resolves it. */
export const NO_FLASH_THEME_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
`;

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const t = window.localStorage.getItem(STORAGE_KEY);
  return t === "light" || t === "dark" ? t : "system";
}

export function applyTheme(pref: ThemePreference) {
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    document.documentElement.setAttribute("data-theme", pref);
    window.localStorage.setItem(STORAGE_KEY, pref);
  }
}
