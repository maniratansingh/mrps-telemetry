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
    const elements = SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (element): element is HTMLElement => Boolean(element),
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-18% 0px -66% 0px", threshold: [0, 0.1, 0.5] },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
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
