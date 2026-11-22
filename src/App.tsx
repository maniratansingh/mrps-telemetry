import { AmbientAtmosphere } from "@/components/AmbientAtmosphere";
import { StandaloneTopBar } from "@/components/StandaloneTopBar";
import { TelemetryDashboard } from "@/components/telemetry/TelemetryDashboard";

export function App() {
  return (
    <>
      <AmbientAtmosphere />
      <StandaloneTopBar />
      <main className="st-main">
        <TelemetryDashboard />
      </main>
    </>
  );
}
