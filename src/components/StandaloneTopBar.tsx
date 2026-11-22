import * as React from "react";
import { ArrowUpRight, Moon, Sun } from "lucide-react";

function currentIsDark() {
  return !document.documentElement.classList.contains("light");
}

export function StandaloneTopBar() {
  const [dark, setDark] = React.useState(true);

  React.useEffect(() => {
    setDark(currentIsDark());
  }, []);

  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    const root = document.documentElement;
    root.classList.toggle("light", !nextDark);
    root.classList.toggle("dark", nextDark);
    try {
      localStorage.setItem("theme", nextDark ? "dark" : "light");
    } catch {
      /* theme simply will not persist */
    }
  };

  return (
    <header className="st-topbar">
      <a
        className="st-brand"
        href="https://mrps.in"
        target="_blank"
        rel="noreferrer"
        aria-label="MRPS — open mrps.in"
      >
        <span className="st-brand-dot" aria-hidden="true" />
        <span>MRPS</span>
      </a>

      <span className="st-divider" aria-hidden="true" />
      <span className="st-title">Live telemetry</span>

      <div className="st-actions">
        <a className="st-site-link" href="https://mrps.in" target="_blank" rel="noreferrer">
          mrps.in
          <ArrowUpRight size={13} strokeWidth={1.8} aria-hidden="true" />
        </a>
        <button
          type="button"
          className="st-theme"
          onClick={toggleTheme}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? (
            <Sun size={16} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Moon size={16} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
