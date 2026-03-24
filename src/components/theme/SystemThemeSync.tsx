import { useEffect } from "react";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const DARK_THEME_COLOR = "#0a0a0a";
const LIGHT_THEME_COLOR = "#f4f4f5";

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

export default function SystemThemeSync() {
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);

    const syncTheme = () => applyTheme(media.matches ? "dark" : "light");
    syncTheme();

    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, []);

  return null;
}
