"use client";

import * as React from "react";

const SECTIONS = [
  { id: "overview", number: "00", label: "Overview" },
  { id: "cpu", number: "01", label: "CPU" },
  { id: "gpu", number: "02", label: "Graphics" },
  { id: "memory", number: "03", label: "Memory" },
  { id: "network", number: "04", label: "Network" },
  { id: "disk", number: "05", label: "Disk I/O" },
  { id: "thermal", number: "06", label: "Thermal" },
  { id: "storage", number: "07", label: "Storage" },
  { id: "processes", number: "08", label: "Processes" },
  { id: "vpn", number: "09", label: "Secure Links" },
  { id: "system", number: "10", label: "System" },
];

export function TelemetrySectionNav() {
  const [active, setActive] = React.useState("overview");

  React.useEffect(() => {
    const inner = document.querySelector<HTMLElement>(".tm-section-nav-inner");
    const link = inner?.querySelector<HTMLElement>('.tm-section-link[data-active="true"]');
    if (!inner || !link) return;

    const left = link.offsetLeft - (inner.clientWidth - link.clientWidth) / 2;
    inner.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  React.useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const nav = document.querySelector(".tm-section-nav");
      const offset = (nav?.getBoundingClientRect().bottom ?? 140) + 32;
      let current = SECTIONS[0].id;

      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= offset) current = section.id;
      }

      setActive(current);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav className="tm-section-nav" aria-label="Telemetry sections">
      <div className="tm-section-nav-inner scrollbar-none">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="tm-section-link"
            data-active={active === section.id}
            aria-current={active === section.id ? "location" : undefined}
          >
            <span className="tm-section-number">{section.number}</span>
            <span>{section.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
