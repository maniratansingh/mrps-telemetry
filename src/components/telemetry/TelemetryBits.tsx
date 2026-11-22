import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function Stat({
  label,
  value,
  unit,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`tm-stat ${className}`.trim()}>
      <span className="tm-stat-label">{label}</span>
      <span className="tm-stat-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {hint ? <span className="tm-stat-hint">{hint}</span> : null}
    </div>
  );
}

export function Meter({
  value,
  color,
  label,
  className = "",
}: {
  value: number | null;
  color?: string;
  label: string;
  className?: string;
}) {
  const safe = value === null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  return (
    <div
      className={`tm-meter ${className}`.trim()}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe ?? undefined}
      aria-valuetext={safe === null ? "Unavailable" : `${safe.toFixed(1)} percent`}
    >
      {safe !== null ? (
        <span style={{ width: `${safe}%`, background: color ?? "var(--tm-champagne)" }} />
      ) : null}
    </div>
  );
}

export function RadialGauge({
  value,
  size = 46,
  stroke = 4,
  color = "var(--tm-champagne)",
  label,
  className = "",
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  className?: string;
}) {
  const safe = value === null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = safe === null ? circumference : circumference * (1 - safe / 100);

  return (
    <span
      className={`tm-gauge ${className}`.trim()}
      style={{ width: size, height: size }}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe === null ? undefined : Math.round(safe)}
      aria-valuetext={safe === null ? "Unavailable" : `${safe.toFixed(1)} percent`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--tm-track)"
          strokeWidth={stroke}
        />
        <circle
          className="tm-gauge-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="tm-gauge-text tm-mono">{safe === null ? "—" : Math.round(safe)}</span>
    </span>
  );
}

export function StatusBadge({
  state,
  label,
  pulse = false,
}: {
  state: "live" | "stale" | "offline" | "error" | "connecting";
  label: string;
  pulse?: boolean;
}) {
  return (
    <span className={`tm-status-pill tm-status-${state}`}>
      <span className={`tm-status-dot ${pulse ? "tm-dot-pulse" : ""}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div className={`tm-empty ${compact ? "tm-empty-compact" : ""}`.trim()}>
      {Icon ? (
        <span className="tm-empty-icon" aria-hidden="true">
          <Icon size={compact ? 16 : 20} strokeWidth={1.5} />
        </span>
      ) : null}
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

export function InlineValue({
  children,
  mono = true,
}: {
  children: ReactNode;
  mono?: boolean;
}) {
  return <span className={mono ? "tm-mono" : ""}>{children}</span>;
}
