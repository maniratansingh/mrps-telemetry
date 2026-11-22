import type { ReactNode } from "react";

interface TelemetryPanelProps {
  id: string;
  index: string;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function TelemetryPanel({
  id,
  index,
  title,
  subtitle,
  meta,
  action,
  children,
  className = "",
}: TelemetryPanelProps) {
  const headingId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`tm-panel tm-anchor ${className}`.trim()}
    >
      <header className="tm-panel-head">
        <div className="tm-panel-heading">
          <span className="tm-panel-index" aria-hidden="true">
            {index}
          </span>
          <div className="tm-panel-heading-copy">
            <h2 id={headingId} className="tm-panel-title">
              {title}
            </h2>
            {subtitle ? <p className="tm-panel-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {meta || action ? (
          <div className="tm-panel-actions">
            {meta ? <div className="tm-panel-meta">{meta}</div> : null}
            {action}
          </div>
        ) : null}
      </header>
      <div className="tm-panel-body">{children}</div>
    </section>
  );
}
