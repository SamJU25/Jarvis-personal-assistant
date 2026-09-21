"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useProviderStatus } from "@/lib/agent/use-provider-status";

export function SettingsShell() {
  const provider = useProviderStatus();
  const [switching, setSwitching] = useState(false);

  const switchProvider = async (nextProvider: "command-code" | "ollama") => {
    try {
      setSwitching(true);
      await fetch("/api/agent/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: nextProvider }),
      });
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  };

  const switchModel = async (model: string) => {
    try {
      setSwitching(true);
      await fetch("/api/agent/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "ollama", model }),
      });
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  };

  const sections = [
    {
      title: "Agent",
      description: "Server-side reasoning provider: Command Code or local Ollama (Phase 7.5).",
      fields: [
        ["Active provider", provider.provider],
        ["Provider status", provider.authenticated ? "Authenticated" : provider.available ? "Authentication required" : "Not configured"],
        ["Active model", provider.model],
        ["Ollama status", provider.ollama?.status ?? "Unavailable"],
        [
          "Ollama local models",
          provider.ollama?.availableModels?.length
            ? provider.ollama.availableModels.join(", ")
            : "None detected",
        ],
        ["Timeout", "Server environment configuration"],
      ],
      interactive: (
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Select provider:</span>
          <button
            type="button"
            disabled={switching || provider.provider === "Command Code"}
            onClick={() => switchProvider("command-code")}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "4px",
              border: "1px solid var(--border-color, #444)",
              background: provider.provider === "Command Code" ? "var(--accent-color, #0ea5e9)" : "transparent",
              color: "#fff",
              cursor: provider.provider === "Command Code" ? "default" : "pointer",
            }}
          >
            Command Code
          </button>
          <button
            type="button"
            disabled={switching || provider.provider === "Ollama"}
            onClick={() => switchProvider("ollama")}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "4px",
              border: "1px solid var(--border-color, #444)",
              background: provider.provider === "Ollama" ? "var(--accent-color, #0ea5e9)" : "transparent",
              color: "#fff",
              cursor: provider.provider === "Ollama" ? "default" : "pointer",
            }}
          >
            Ollama
          </button>
          {provider.provider === "Ollama" && provider.ollama?.availableModels && provider.ollama.availableModels.length > 0 && (
            <select
              aria-label="Select Ollama model"
              value={provider.model}
              disabled={switching}
              onChange={(e) => switchModel(e.target.value)}
              style={{
                marginLeft: "0.5rem",
                padding: "0.35rem 0.5rem",
                borderRadius: "4px",
                border: "1px solid var(--border-color, #444)",
                background: "var(--bg-secondary, #222)",
                color: "#fff",
              }}
            >
              {provider.ollama.availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
      ),
    },
    {
      title: "Knowledge",
      description: "Local Obsidian vault and Google Workspace integrations (Phase 6).",
      fields: [
        ["Obsidian vault status", provider.obsidian?.status ?? "Not configured"],
        ["Google Workspace status", provider.google?.status ?? "Not configured"],
      ],
    },
    {
      title: "Memory",
      description: "Local SQLite persistent memory for preferences, facts, and instructions (Phase 7).",
      fields: [
        ["Memory store status", provider.memory?.status ?? "Not configured"],
        ["Stored memories count", provider.memory?.count !== undefined ? String(provider.memory.count) : "0"],
        ["Persistence engine", "Node native SQLite (local-first)"],
        ["Authorization policy", "Explicit intent required"],
      ],
    },
    {
      title: "Voice",
      description: "Local Whisper speech-to-text and local Kokoro text-to-speech (Phase 8). Fully offline-capable; zero cloud dependencies.",
      fields: [
        ["Speech-to-text (Whisper)", provider.voice?.whisper.status ?? "Not configured"],
        ["Whisper language", provider.voice?.whisper.language ?? "en"],
        ["Text-to-speech (Kokoro)", provider.voice?.kokoro.status ?? "Not configured"],
        ["Kokoro voice", provider.voice?.kokoro.voice ?? "af_heart"],
        ["Microphone", provider.voice?.microphone.status ?? "Available"],
        ["Speaker / Audio output", provider.voice?.speaker.status ?? "Available"],
        ["Audio privacy", "Ephemeral in-memory only (never persisted)"],
      ],
    },
    {
      title: "Interface",
      description: "Local preview controls only; values are not saved.",
      fields: [
        ["Animation intensity", "Standard preview"],
        ["Debug mode", "Development route only"],
      ],
    },
  ];

  return (
    <main className="settings-page">
      <header className="subpage-header">
        <Link href="/" aria-label="Return to JARVIS">
          <Icon name="arrow" />
        </Link>
        <div>
          <p className="section-label">JARVIS configuration</p>
          <h1>Settings</h1>
          <p>Phase 7.5 runtime status · Secrets and absolute paths are never shown.</p>
        </div>
      </header>
      <div className="settings-layout">
        <nav aria-label="Settings sections">
          {sections.map((section) => (
            <a key={section.title} href={`#${section.title.toLowerCase()}`}>
              {section.title}
            </a>
          ))}
        </nav>
        <div className="settings-content">
          {sections.map((section) => (
            <section key={section.title} id={section.title.toLowerCase()}>
              <div className="settings-intro">
                <h2>{section.title}</h2>
                <p>{section.description}</p>
              </div>
              <dl>
                {section.fields.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <input aria-label={label} value={value} disabled suppressHydrationWarning />
                      <span>Read only</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {"interactive" in section && section.interactive}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
