"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type {
  SystemStatusSnapshot,
  SettingsEvent,
  SettingsApplyState,
} from "@/lib/contracts/settings";

export function useSettings() {
  const [snapshot, setSnapshot] = useState<SystemStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<SettingsApplyState>("idle");
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const revisionRef = useRef<number>(0);

  const fetchSnapshot = useCallback(async () => {
    try {
      const resp = await fetch("/api/settings/snapshot");
      if (!resp.ok) throw new Error(`Snapshot request failed: ${resp.status}`);
      const data = (await resp.json()) as SystemStatusSnapshot;
      if (data.revision >= revisionRef.current) {
        revisionRef.current = data.revision;
        setSnapshot(data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snapshot");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/settings/snapshot")
      .then((resp) => {
        if (!resp.ok) throw new Error(`Snapshot request failed: ${resp.status}`);
        return resp.json() as Promise<SystemStatusSnapshot>;
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.revision >= revisionRef.current) {
          revisionRef.current = data.revision;
          setSnapshot(data);
        }
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load snapshot");
        setLoading(false);
      });

    const eventSource = new EventSource("/api/settings/events");

    eventSource.addEventListener("snapshot_updated", (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as SettingsEvent;
        if (event.type === "snapshot_updated" && event.snapshot.revision >= revisionRef.current) {
          revisionRef.current = event.snapshot.revision;
          setSnapshot(event.snapshot);
        }
      } catch {
        // parse error
      }
    });

    eventSource.addEventListener("apply_state_changed", (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as SettingsEvent;
        if (event.type === "apply_state_changed") {
          setApplyState(event.state);
          if (event.message) setApplyNotice(event.message);
        }
      } catch {
        // parse error
      }
    });

    eventSource.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      isMounted = false;
      eventSource.close();
    };
  }, []);

  const testHermes = async () => {
    setActionInProgress("test_hermes");
    try {
      const res = await fetch("/api/settings/hermes/test", { method: "POST" });
      const data = await res.json();
      await fetchSnapshot();
      return data;
    } finally {
      setActionInProgress(null);
    }
  };

  const refreshHermes = async () => {
    setActionInProgress("refresh_hermes");
    try {
      const res = await fetch("/api/settings/hermes/refresh", { method: "POST" });
      const data = await res.json();
      await fetchSnapshot();
      return data;
    } finally {
      setActionInProgress(null);
    }
  };

  const testGateway = async () => {
    setActionInProgress("test_gateway");
    try {
      const res = await fetch("/api/settings/gateway/test", { method: "POST" });
      const data = await res.json();
      await fetchSnapshot();
      return data;
    } finally {
      setActionInProgress(null);
    }
  };

  const testGatewayStreaming = async () => {
    setActionInProgress("test_streaming");
    try {
      const res = await fetch("/api/settings/gateway/test-stream", { method: "POST" });
      const data = await res.json();
      await fetchSnapshot();
      return data;
    } finally {
      setActionInProgress(null);
    }
  };

  const testGatewayTools = async () => {
    setActionInProgress("test_tools");
    try {
      const res = await fetch("/api/settings/gateway/test-tools", { method: "POST" });
      const data = await res.json();
      await fetchSnapshot();
      return data;
    } finally {
      setActionInProgress(null);
    }
  };

  const saveProviderKey = async (platform: string, key: string, label?: string) => {
    setActionInProgress("save_key");
    try {
      const res = await fetch("/api/settings/gateway/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, key, label }),
      });
      const data = await res.json();
      await fetchSnapshot();
      return data;
    } finally {
      setActionInProgress(null);
    }
  };

  const applySettings = async (options: { gatewayUrl?: string; model?: string }) => {
    setApplyState("applying");
    setApplyNotice("Applying configuration...");
    try {
      const res = await fetch("/api/settings/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      setApplyState(data.state ?? "applied");
      setApplyNotice(data.message ?? "Settings applied");
      await fetchSnapshot();
      return data;
    } catch (err: unknown) {
      setApplyState("failed");
      setApplyNotice(err instanceof Error ? err.message : "Apply failed");
    }
  };

  return {
    snapshot,
    loading,
    error,
    applyState,
    applyNotice,
    actionInProgress,
    testHermes,
    refreshHermes,
    testGateway,
    testGatewayStreaming,
    testGatewayTools,
    saveProviderKey,
    applySettings,
    refreshSnapshot: fetchSnapshot,
  };
}
