"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeApiError, telemetryApi } from "@/lib/telemetry/api";
import {
  appendHistoryPoint,
  historyPointFromSnapshot,
  historyPointsFromApi,
  mergeHistory,
} from "@/lib/telemetry/history";
import type { HistoryPoint, Snapshot, TelemetryState } from "@/lib/telemetry/types";

const configuredPoll = Number(import.meta.env.VITE_TELEMETRY_POLL_MS);
export const POLL_INTERVAL_MS =
  Number.isFinite(configuredPoll) && configuredPoll >= 250
    ? Math.min(configuredPoll, 5_000)
    : 500;
export const STALE_AFTER_MS = 6_000;
const HISTORY_SECONDS = 120;
const RETRY_DELAYS = [5_000, 8_000, 15_000, 30_000];

const initialState: TelemetryState = {
  host: null,
  snapshot: null,
  history: [],
  health: null,
  connection: "connecting",
  lastSuccessAt: null,
  lastServerTimestamp: null,
  error: null,
  initialLoading: true,
  refreshing: false,
  historySource: "none",
  apiBase: telemetryApi.baseUrl,
  historyWindow: 300,
};

export interface TelemetryController extends TelemetryState {
  refresh: () => void;
  pollIntervalMs: number;
}

export function useTelemetry(): TelemetryController {
  const [state, setState] = useState<TelemetryState>(initialState);
  const pollRef = useRef<(manual?: boolean) => Promise<void>>(async () => {});
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    void pollRef.current(true);
  }, []);

  // Lightweight clock for "last updated" labels and stale presentation.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  // Mark a live connection stale if no successful response arrives in time.
  useEffect(() => {
    setState((previous) => {
      if (!previous.snapshot || !previous.lastSuccessAt) return previous;
      if (previous.connection === "offline" || previous.connection === "error") return previous;
      const isStale = now - previous.lastSuccessAt > STALE_AFTER_MS;
      if (isStale && previous.connection === "live") {
        return { ...previous, connection: "stale" };
      }
      return previous;
    });
  }, [now]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    let inFlight = false;
    let retryIndex = 0;
    let historyNeedsRetry = false;
    let hostNeedsRetry = false;
    let lastSampleTimestamp: string | null = null;
    let lastSampleChangeAt = 0;

    const noteSample = (timestamp: string) => {
      if (timestamp !== lastSampleTimestamp) {
        lastSampleTimestamp = timestamp;
        lastSampleChangeAt = Date.now();
        return true;
      }
      return false;
    };

    const clearTimer = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    const schedule = (delay: number) => {
      if (cancelled) return;
      clearTimer();
      if (typeof document !== "undefined" && document.hidden) return;
      if (streamOpen) return;
      timer = window.setTimeout(() => {
        void poll();
      }, delay);
    };

    const markFailure = (error: unknown) => {
      const message = describeApiError(error);
      setState((previous) => {
        const hasData = Boolean(previous.snapshot);
        return {
          ...previous,
          connection: hasData ? "stale" : "error",
          error: message,
          initialLoading: false,
          refreshing: false,
        };
      });
    };

    const fetchHistory = async (signal: AbortSignal) => {
      try {
        const response = await telemetryApi.history(HISTORY_SECONDS, signal);
        const points = historyPointsFromApi(response);
        if (cancelled) return;
        setState((previous) => ({
          ...previous,
          history: mergeHistory(previous.history, points).slice(-previous.historyWindow),
          historySource: points.length > 0 ? "api" : previous.historySource,
        }));
        historyNeedsRetry = false;
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        historyNeedsRetry = true;
      }
    };

    const fetchHost = async (signal: AbortSignal) => {
      try {
        const host = await telemetryApi.host(signal);
        if (cancelled) return;
        setState((previous) => ({ ...previous, host }));
        hostNeedsRetry = false;
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        hostNeedsRetry = true;
      }
    };

    const applySnapshot = (snapshot: Snapshot) => {
      const point = historyPointFromSnapshot(snapshot);
      const advanced = noteSample(snapshot.timestamp);
      const frozen = !advanced && Date.now() - lastSampleChangeAt > STALE_AFTER_MS;

      setState((previous) => {
        let history = previous.history;
        if (point) history = appendHistoryPoint(history, point, previous.historyWindow);
        return {
          ...previous,
          snapshot,
          history,
          connection: !snapshot.online ? "offline" : frozen ? "stale" : "live",
          lastSuccessAt: Date.now(),
          lastServerTimestamp: snapshot.timestamp,
          error: frozen
            ? "The API has returned the same sample timestamp for over 6 seconds; the values may be stale."
            : null,
          initialLoading: false,
          refreshing: false,
          historySource:
            previous.historySource === "none" && history.length > 0 ? "live" : previous.historySource,
        };
      });
    };

    const poll = async (manual = false) => {
      if (cancelled || inFlight) return;
      if (!manual && streamOpen) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setState((previous) => ({
          ...previous,
          connection: previous.snapshot ? "stale" : "error",
          error: "This browser is offline. Reconnect to resume live telemetry.",
          initialLoading: false,
          refreshing: false,
        }));
        schedule(RETRY_DELAYS[Math.min(retryIndex, RETRY_DELAYS.length - 1)]);
        return;
      }

      inFlight = true;
      controller = new AbortController();
      if (manual) {
        setState((previous) => ({ ...previous, refreshing: true }));
      }

      try {
        const snapshot = await telemetryApi.snapshot(controller.signal);
        if (cancelled) return;

        applySnapshot(snapshot);
        retryIndex = 0;

        if (historyNeedsRetry) {
          const historyController = new AbortController();
          void fetchHistory(historyController.signal);
        }
        if (hostNeedsRetry) {
          const hostController = new AbortController();
          void fetchHost(hostController.signal);
        }

        schedule(POLL_INTERVAL_MS);
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        markFailure(error);
        retryIndex = Math.min(retryIndex + 1, RETRY_DELAYS.length - 1);
        schedule(RETRY_DELAYS[retryIndex - 1] ?? POLL_INTERVAL_MS);
      } finally {
        inFlight = false;
      }
    };

    let stream: EventSource | null = null;
    let streamOpen = false;

    const connectStream = () => {
      if (cancelled || stream || typeof EventSource === "undefined") return;

      const source = new EventSource(`${telemetryApi.baseUrl}/api/v1/stream`);
      stream = source;

      source.onopen = () => {
        streamOpen = true;
        retryIndex = 0;
        clearTimer();
      };

      source.onmessage = (event) => {
        try {
          const snapshot = JSON.parse(event.data) as Snapshot;
          if (!snapshot || typeof snapshot.timestamp !== "string") return;
          streamOpen = true;
          clearTimer();
          applySnapshot(snapshot);
          retryIndex = 0;
        } catch {
          // Ignore malformed frames; polling remains the safety net.
        }
      };

      source.onerror = () => {
        streamOpen = false;
        schedule(POLL_INTERVAL_MS);
      };
    };

    pollRef.current = poll;
    connectStream();

    const bootstrap = async () => {
      const bootstrapController = new AbortController();
      controller = bootstrapController;

      const [snapshotResult, hostResult, healthResult, historyResult] = await Promise.allSettled([
        telemetryApi.snapshot(bootstrapController.signal),
        telemetryApi.host(bootstrapController.signal),
        telemetryApi.health(bootstrapController.signal),
        telemetryApi.history(HISTORY_SECONDS, bootstrapController.signal),
      ]);

      if (cancelled) return;

      if (hostResult.status === "fulfilled") {
        setState((previous) => ({ ...previous, host: hostResult.value }));
      } else {
        hostNeedsRetry = true;
      }

      if (healthResult.status === "fulfilled") {
        setState((previous) => ({ ...previous, health: healthResult.value }));
      }

      let apiHistory: HistoryPoint[] = [];
      if (historyResult.status === "fulfilled") {
        apiHistory = historyPointsFromApi(historyResult.value);
      } else {
        historyNeedsRetry = true;
      }

      if (snapshotResult.status === "fulfilled") {
        const snapshot = snapshotResult.value;
        noteSample(snapshot.timestamp);
        const point = historyPointFromSnapshot(snapshot);
        setState((previous) => {
          let history = apiHistory;
          if (point) history = appendHistoryPoint(history, point, previous.historyWindow);
          return {
            ...previous,
            snapshot,
            history,
            connection: snapshot.online ? "live" : "offline",
            lastSuccessAt: Date.now(),
            lastServerTimestamp: snapshot.timestamp,
            error: null,
            initialLoading: false,
            historySource: apiHistory.length > 0 ? "api" : "live",
          };
        });
        retryIndex = 0;
        schedule(POLL_INTERVAL_MS);
      } else {
        markFailure(snapshotResult.reason);
        retryIndex = 1;
        schedule(RETRY_DELAYS[0]);
      }

      inFlight = false;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearTimer();
        stream?.close();
        stream = null;
        streamOpen = false;
        return;
      }
      if (cancelled) return;
      void poll();
      connectStream();
    };

    const onOnline = () => {
      void poll();
    };

    const onOffline = () => {
      setState((previous) => ({
        ...previous,
        connection: previous.snapshot ? "stale" : "error",
        error: "This browser is offline. Reconnect to resume live telemetry.",
        initialLoading: false,
      }));
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    void bootstrap();

    return () => {
      cancelled = true;
      clearTimer();
      stream?.close();
      stream = null;
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return {
    ...state,
    refresh,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}
