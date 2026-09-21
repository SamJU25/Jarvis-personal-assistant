"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useSettings } from "@/lib/settings/use-settings";

export function SettingsShell() {
  const {
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
    refreshSnapshot,
  } = useSettings();

  const [selectedPlatform, setSelectedPlatform] = useState("groq");
  const [keyInput, setKeyInput] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;

    setKeySaveMessage(null);
    const result = await saveProviderKey(selectedPlatform, keyInput.trim(), keyLabel.trim() || undefined);
    if (result.success) {
      setKeyInput("");
      setKeyLabel("");
      setKeySaveMessage(`Key for ${selectedPlatform} saved securely into declarative config.`);
    } else {
      setKeySaveMessage(`Failed: ${result.message}`);
    }
  };

  const handleTestHermes = async () => {
    setActionMessage(null);
    const res = await testHermes();
    setActionMessage(`Hermes: ${res.message} (${res.latencyMs}ms)`);
  };

  const handleRefreshHermes = async () => {
    setActionMessage(null);
    const res = await refreshHermes();
    setActionMessage(`Refreshed Hermes: ${res.capabilitiesCount} capabilities, ${res.skillsCount} skills.`);
  };

  const handleTestGateway = async () => {
    setActionMessage(null);
    const res = await testGateway();
    setActionMessage(`Gateway: ${res.message}${res.latencyMs ? ` (${res.latencyMs}ms)` : ""}`);
  };

  const handleTestStreaming = async () => {
    setActionMessage(null);
    const res = await testGatewayStreaming();
    setActionMessage(`Streaming: ${res.message} (${res.latencyMs}ms)`);
  };

  const handleTestTools = async () => {
    setActionMessage(null);
    const res = await testGatewayTools();
    setActionMessage(`Tool Calling: ${res.message} (${res.latencyMs}ms)`);
  };

  const handleApplyGateway = async () => {
    setActionMessage(null);
    const gatewayUrl = snapshot?.gateway.baseUrl || "http://127.0.0.1:3001/v1";
    await applySettings({ gatewayUrl, model: "auto" });
  };

  const isHermesConnected = snapshot?.hermes.status === "connected";
  const isGatewayConnected = snapshot?.gateway.status === "connected";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void, #05080b)",
        color: "var(--text, #edf5f7)",
        padding: "clamp(16px, 3vw, 36px)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ maxWidth: "1180px", margin: "0 auto", display: "grid", gap: "24px" }}>
        {/* Top Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--line, rgba(187, 218, 233, 0.12))",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--cyan, #8de2f2)",
                textDecoration: "none",
                fontSize: "0.86rem",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line, rgba(187, 218, 233, 0.12))",
                background: "rgba(16, 25, 33, 0.6)",
              }}
            >
              <Icon name="arrow" />
              <span>Return to JARVIS</span>
            </Link>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
                Control Center & Settings
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted, #60727a)" }}>
                Hermes Core, FreeLLMAPI Gateway, Obsidian Memory & Credentials
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => refreshSnapshot()}
              disabled={loading || Boolean(actionInProgress)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "8px",
                border: "1px solid var(--line, rgba(187, 218, 233, 0.12))",
                background: "rgba(16, 25, 33, 0.7)",
                color: "var(--text, #edf5f7)",
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              <Icon name="pulse" />
              <span>{loading ? "Checking..." : "Refresh Probes"}</span>
            </button>
          </div>
        </header>

        {/* Global Notice / Apply Banner */}
        {applyNotice && (
          <div
            role="status"
            style={{
              padding: "12px 18px",
              borderRadius: "10px",
              border: `1px solid ${
                applyState === "failed"
                  ? "var(--danger, #c68067)"
                  : applyState === "verified"
                  ? "var(--cyan, #8de2f2)"
                  : "var(--amber, #d6a96d)"
              }`,
              background: "rgba(16, 25, 33, 0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background:
                    applyState === "failed"
                      ? "var(--danger, #c68067)"
                      : applyState === "verified"
                      ? "var(--cyan, #8de2f2)"
                      : "var(--amber, #d6a96d)",
                }}
              />
              <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                Status: <strong style={{ textTransform: "capitalize" }}>{applyState}</strong> — {applyNotice}
              </span>
            </div>
          </div>
        )}

        {actionMessage && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              background: "rgba(141, 226, 242, 0.08)",
              border: "1px solid rgba(141, 226, 242, 0.2)",
              color: "var(--cyan, #8de2f2)",
              fontSize: "0.82rem",
            }}
          >
            {actionMessage}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              background: "rgba(198, 128, 103, 0.1)",
              border: "1px solid var(--danger, #c68067)",
              color: "var(--danger, #c68067)",
              fontSize: "0.84rem",
            }}
          >
            Error: {error}
          </div>
        )}

        {/* Quick Status Bar */}
        <section
          aria-label="System Status Bar"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "12px",
          }}
        >
          <div style={pillStyle}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #60727a)" }}>Hermes Core</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={dotStyle(isHermesConnected)} />
              <strong style={{ fontSize: "0.88rem" }}>{isHermesConnected ? "Connected" : "Unavailable"}</strong>
            </div>
          </div>

          <div style={pillStyle}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #60727a)" }}>Inference Gateway</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={dotStyle(isGatewayConnected)} />
              <strong style={{ fontSize: "0.88rem" }}>{isGatewayConnected ? "Healthy" : "Unavailable"}</strong>
            </div>
          </div>

          <div style={pillStyle}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #60727a)" }}>Obsidian Memory</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={dotStyle(snapshot?.obsidian.status === "Connected" || snapshot?.obsidian.status === "Available")} />
              <strong style={{ fontSize: "0.88rem" }}>{snapshot?.obsidian.status ?? "Checking"}</strong>
            </div>
          </div>

          <div style={pillStyle}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #60727a)" }}>Voice Subsystem</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={dotStyle(Boolean(snapshot?.voice.whisper && snapshot.voice.whisper !== "Not configured"))} />
              <strong style={{ fontSize: "0.88rem" }}>
                {snapshot?.voice.whisper === "Available" ? "Ready" : "Offline"}
              </strong>
            </div>
          </div>
        </section>

        {/* Main Grid of Settings Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: "20px" }}>
          {/* CARD 1: Hermes Core */}
          <section style={cardStyle} aria-labelledby="hermes-card-title">
            <div style={cardHeaderStyle}>
              <div>
                <h2 id="hermes-card-title" style={cardTitleStyle}>
                  Hermes Core
                </h2>
                <p style={cardSubtitleStyle}>Autonomous agent runtime & task execution loop</p>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "12px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  background: isHermesConnected ? "rgba(141, 226, 242, 0.15)" : "rgba(198, 128, 103, 0.15)",
                  color: isHermesConnected ? "var(--cyan, #8de2f2)" : "var(--danger, #c68067)",
                  border: `1px solid ${isHermesConnected ? "rgba(141, 226, 242, 0.3)" : "rgba(198, 128, 103, 0.3)"}`,
                }}
              >
                {snapshot?.hermes.status ?? "Checking"}
              </span>
            </div>

            <dl style={dlStyle}>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Version</dt>
                <dd style={ddStyle}>{snapshot?.hermes.version || "Unknown"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Base URL</dt>
                <dd style={ddStyle}>{snapshot?.hermes.baseUrl || "http://127.0.0.1:8642"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Session Readiness</dt>
                <dd style={ddStyle}>{snapshot?.hermes.sessionReadiness === "ready" ? "Ready" : "Not ready"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Runs Execution</dt>
                <dd style={ddStyle}>{snapshot?.hermes.runReadiness === "ready" ? "Ready" : "Not ready"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Active Capabilities</dt>
                <dd style={ddStyle}>{snapshot?.hermes.capabilityCount ?? 0} registered</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Discovered Skills</dt>
                <dd style={ddStyle}>{snapshot?.hermes.skillCount ?? 0} active</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Specialist Delegation</dt>
                <dd style={ddStyle}>{snapshot?.hermes.delegationEnabled ? "Enabled (Hermes Core)" : "Disabled"}</dd>
              </div>
            </dl>

            <div style={buttonRowStyle}>
              <button
                type="button"
                style={actionBtnStyle}
                disabled={actionInProgress === "test_hermes"}
                onClick={handleTestHermes}
              >
                {actionInProgress === "test_hermes" ? "Testing..." : "Test Connection"}
              </button>
              <button
                type="button"
                style={actionBtnStyle}
                disabled={actionInProgress === "refresh_hermes"}
                onClick={handleRefreshHermes}
              >
                {actionInProgress === "refresh_hermes" ? "Refreshing..." : "Refresh Capabilities"}
              </button>
            </div>
          </section>

          {/* CARD 2: Inference Gateway (FreeLLMAPI) */}
          <section style={cardStyle} aria-labelledby="gateway-card-title">
            <div style={cardHeaderStyle}>
              <div>
                <h2 id="gateway-card-title" style={cardTitleStyle}>
                  Inference Gateway
                </h2>
                <p style={cardSubtitleStyle}>FreeLLMAPI smart failover & model routing</p>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "12px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  background: isGatewayConnected ? "rgba(141, 226, 242, 0.15)" : "rgba(198, 128, 103, 0.15)",
                  color: isGatewayConnected ? "var(--cyan, #8de2f2)" : "var(--danger, #c68067)",
                  border: `1px solid ${isGatewayConnected ? "rgba(141, 226, 242, 0.3)" : "rgba(198, 128, 103, 0.3)"}`,
                }}
              >
                {snapshot?.gateway.status ?? "Checking"}
              </span>
            </div>

            <dl style={dlStyle}>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Gateway Provider</dt>
                <dd style={ddStyle}>FreeLLMAPI (Self-Hosted)</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Base URL</dt>
                <dd style={ddStyle}>{snapshot?.gateway.baseUrl || "http://127.0.0.1:3001/v1"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Routing Policy</dt>
                <dd style={ddStyle}>{snapshot?.gateway.routingStrategy || "Automatic: Balanced"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Streaming</dt>
                <dd style={ddStyle}>{snapshot?.gateway.streamingSupported ? "Available" : "Unavailable"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Tool Calling</dt>
                <dd style={ddStyle}>{snapshot?.gateway.toolCallingSupported ? "Available" : "Unavailable"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Response Latency</dt>
                <dd style={ddStyle}>{snapshot?.gateway.latencyMs !== undefined ? `${snapshot.gateway.latencyMs}ms` : "N/A"}</dd>
              </div>
            </dl>

            <div style={buttonRowStyle}>
              <button
                type="button"
                style={actionBtnStyle}
                disabled={actionInProgress === "test_gateway"}
                onClick={handleTestGateway}
              >
                {actionInProgress === "test_gateway" ? "Testing..." : "Test Gateway"}
              </button>
              <button
                type="button"
                style={actionBtnStyle}
                disabled={actionInProgress === "test_streaming"}
                onClick={handleTestStreaming}
              >
                {actionInProgress === "test_streaming" ? "Testing..." : "Test Streaming"}
              </button>
              <button
                type="button"
                style={actionBtnStyle}
                disabled={actionInProgress === "test_tools"}
                onClick={handleTestTools}
              >
                {actionInProgress === "test_tools" ? "Testing..." : "Test Tool Calling"}
              </button>
              <button
                type="button"
                style={{
                  ...actionBtnStyle,
                  background: "rgba(141, 226, 242, 0.15)",
                  borderColor: "var(--cyan, #8de2f2)",
                  color: "var(--cyan, #8de2f2)",
                }}
                disabled={applyState === "applying"}
                onClick={handleApplyGateway}
              >
                Apply Gateway to Hermes
              </button>
            </div>
          </section>

          {/* CARD 3: Provider Credentials */}
          <section style={{ ...cardStyle, gridColumn: "1 / -1" }} aria-labelledby="providers-card-title">
            <div style={cardHeaderStyle}>
              <div>
                <h2 id="providers-card-title" style={cardTitleStyle}>
                  Provider Credentials & Upstream Keys
                </h2>
                <p style={cardSubtitleStyle}>
                  Keys are stored server-side in declarative configuration. Stored keys are never returned to the browser.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginBottom: "20px" }}>
              {snapshot?.providers.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "rgba(7, 12, 17, 0.5)",
                    border: "1px solid var(--line, rgba(187, 218, 233, 0.1))",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{p.name}</span>
                  <span
                    style={{
                      fontSize: "0.74rem",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: p.configured ? "rgba(141, 226, 242, 0.1)" : "rgba(96, 114, 122, 0.1)",
                      color: p.configured ? "var(--cyan, #8de2f2)" : "var(--text-muted, #60727a)",
                      border: `1px solid ${p.configured ? "rgba(141, 226, 242, 0.25)" : "transparent"}`,
                    }}
                  >
                    {p.configured ? "Configured" : "Not configured"}
                  </span>
                </div>
              ))}
            </div>

            {/* Save Key Form */}
            <form
              onSubmit={handleSaveKey}
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: "rgba(16, 25, 33, 0.6)",
                border: "1px solid var(--line, rgba(187, 218, 233, 0.12))",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--text, #edf5f7)" }}>
                Add or Update Provider API Key
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ flex: "1 1 180px" }}>
                  <label htmlFor="platform-select" style={labelStyle}>
                    Provider Platform
                  </label>
                  <select
                    id="platform-select"
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="groq">Groq</option>
                    <option value="google">Google Gemini</option>
                    <option value="mistral">Mistral AI</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>

                <div style={{ flex: "2 1 280px" }}>
                  <label htmlFor="key-input" style={labelStyle}>
                    API Key (Write-Only)
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="key-input"
                      type={showKey ? "text" : "password"}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Paste official API key here"
                      required
                      style={{ ...inputStyle, width: "100%", paddingRight: "70px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: 0,
                        color: "var(--text-soft, #9aabb2)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div style={{ flex: "1 1 140px" }}>
                  <label htmlFor="key-label" style={labelStyle}>
                    Label (Optional)
                  </label>
                  <input
                    id="key-label"
                    type="text"
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    placeholder="e.g. primary"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <span style={{ fontSize: "0.76rem", color: "var(--text-muted, #60727a)" }}>
                  Key will be injected into declarative config and verified.
                </span>
                <button
                  type="submit"
                  disabled={actionInProgress === "save_key" || !keyInput.trim()}
                  style={{
                    ...actionBtnStyle,
                    background: "var(--cyan, #8de2f2)",
                    color: "#05080b",
                    fontWeight: 600,
                  }}
                >
                  {actionInProgress === "save_key" ? "Saving..." : "Save Key Securely"}
                </button>
              </div>

              {keySaveMessage && (
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: keySaveMessage.startsWith("Failed") ? "var(--danger, #c68067)" : "var(--cyan, #8de2f2)",
                  }}
                >
                  {keySaveMessage}
                </div>
              )}
            </form>
          </section>

          {/* CARD 4: Obsidian Memory */}
          <section style={cardStyle} aria-labelledby="obsidian-card-title">
            <div style={cardHeaderStyle}>
              <div>
                <h2 id="obsidian-card-title" style={cardTitleStyle}>
                  Obsidian Memory
                </h2>
                <p style={cardSubtitleStyle}>Canonical durable storage (AI/Memory/)</p>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "12px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  background: "rgba(141, 226, 242, 0.15)",
                  color: "var(--cyan, #8de2f2)",
                  border: "1px solid rgba(141, 226, 242, 0.3)",
                }}
              >
                {snapshot?.obsidian.status ?? "Connected"}
              </span>
            </div>

            <dl style={dlStyle}>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Vault Target</dt>
                <dd style={ddStyle}>{snapshot?.obsidian.vaultLabel ?? "Configured Vault"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Memory Notes</dt>
                <dd style={ddStyle}>{snapshot?.obsidian.noteCount ?? 0} entries</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Secret Scanning</dt>
                <dd style={ddStyle}>Active (Fails closed on secrets)</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Context Window</dt>
                <dd style={ddStyle}>Bounded (Max 2,000 chars formatted)</dd>
              </div>
            </dl>
          </section>

          {/* CARD 5: Voice Subsystem */}
          <section style={cardStyle} aria-labelledby="voice-card-title">
            <div style={cardHeaderStyle}>
              <div>
                <h2 id="voice-card-title" style={cardTitleStyle}>
                  Voice Subsystem
                </h2>
                <p style={cardSubtitleStyle}>Local Whisper STT & Kokoro TTS</p>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "12px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  background: "rgba(141, 226, 242, 0.15)",
                  color: "var(--cyan, #8de2f2)",
                  border: "1px solid rgba(141, 226, 242, 0.3)",
                }}
              >
                Local Only
              </span>
            </div>

            <dl style={dlStyle}>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Speech-to-Text</dt>
                <dd style={ddStyle}>{snapshot?.voice.whisper ?? "Unavailable"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Text-to-Speech</dt>
                <dd style={ddStyle}>{snapshot?.voice.kokoro ?? "Unavailable"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Microphone</dt>
                <dd style={ddStyle}>{snapshot?.voice.microphone ?? "Available"}</dd>
              </div>
              <div style={fieldStyle}>
                <dt style={dtStyle}>Audio Privacy</dt>
                <dd style={ddStyle}>Ephemeral in-memory only (never stored)</dd>
              </div>
            </dl>
          </section>

          {/* CARD 6: Specialist Orchestration */}
          <section style={cardStyle} aria-labelledby="specialists-card-title">
            <div style={cardHeaderStyle}>
              <div>
                <h2 id="specialists-card-title" style={cardTitleStyle}>
                  Specialist Registry
                </h2>
                <p style={cardSubtitleStyle}>Declarative specialist roles for delegated subtasks</p>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 8px",
                  borderRadius: "999px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  background: "rgba(141, 226, 242, 0.12)",
                  color: "var(--cyan, #8de2f2)",
                  border: "1px solid rgba(141, 226, 242, 0.3)",
                }}
              >
                {snapshot?.specialists?.length ?? 5} Roles Active
              </span>
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              {(snapshot?.specialists ?? [
                { id: "research", displayName: "Research Specialist", preferredRoutingProfile: "reasoning", allowedCapabilities: ["search_vault", "read_note", "search_drive", "search_memory"] },
                { id: "coding", displayName: "Coding Specialist", preferredRoutingProfile: "coding", allowedCapabilities: ["search_vault", "read_note"] },
                { id: "productivity", displayName: "Productivity Specialist", preferredRoutingProfile: "fast", allowedCapabilities: ["get_calendar_events", "search_gmail"] },
                { id: "memory", displayName: "Memory Specialist", preferredRoutingProfile: "fast", allowedCapabilities: ["search_memory", "list_memory"] },
                { id: "communications", displayName: "Communications Specialist", preferredRoutingProfile: "fast", allowedCapabilities: ["search_gmail", "draft_email"] },
              ]).map((spec) => (
                <div
                  key={spec.id}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "rgba(7, 12, 17, 0.6)",
                    border: "1px solid rgba(187, 218, 233, 0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text, #edf5f7)" }}>
                      {spec.displayName}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted, #60727a)" }}>
                      Profile: <span style={{ color: "var(--cyan, #8de2f2)" }}>{spec.preferredRoutingProfile}</span> · {spec.allowedCapabilities.length} capabilities
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      color: "var(--cyan, #8de2f2)",
                      background: "rgba(141, 226, 242, 0.08)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    Active
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

// Styling Constants
const cardStyle: React.CSSProperties = {
  padding: "20px",
  borderRadius: "14px",
  background: "linear-gradient(145deg, rgba(16, 25, 33, 0.72), rgba(7, 12, 17, 0.6))",
  border: "1px solid var(--line, rgba(187, 218, 233, 0.12))",
  backdropFilter: "blur(20px)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "16px",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.05rem",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--text, #edf5f7)",
};

const cardSubtitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "0.76rem",
  color: "var(--text-soft, #9aabb2)",
};

const dlStyle: React.CSSProperties = {
  margin: 0,
  display: "grid",
  gap: "10px",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingBottom: "8px",
  borderBottom: "1px solid rgba(187, 218, 233, 0.06)",
};

const dtStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--text-muted, #60727a)",
};

const ddStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.82rem",
  fontWeight: 500,
  color: "var(--text, #edf5f7)",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  paddingTop: "8px",
};

const actionBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid var(--line, rgba(187, 218, 233, 0.2))",
  background: "rgba(16, 25, 33, 0.8)",
  color: "var(--text, #edf5f7)",
  fontSize: "0.78rem",
  cursor: "pointer",
  fontWeight: 500,
};

const pillStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "10px",
  background: "rgba(16, 25, 33, 0.6)",
  border: "1px solid var(--line, rgba(187, 218, 233, 0.12))",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const dotStyle = (active: boolean): React.CSSProperties => ({
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: active ? "var(--cyan, #8de2f2)" : "var(--text-muted, #60727a)",
  boxShadow: active ? "0 0 8px rgba(141, 226, 242, 0.5)" : "none",
});

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  color: "var(--text-muted, #60727a)",
  marginBottom: "4px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: "6px",
  border: "1px solid var(--line, rgba(187, 218, 233, 0.2))",
  background: "rgba(7, 12, 17, 0.8)",
  color: "var(--text, #edf5f7)",
  fontSize: "0.82rem",
};
