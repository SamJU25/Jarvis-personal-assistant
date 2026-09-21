import { describe, expect, it } from "vitest";
import { containsSecret } from "@/lib/memory/secrets";

describe("Memory Secret Rejection", () => {
  it("rejects OpenAI and model service API keys", () => {
    expect(containsSecret("Remember my API key: sk-abcdef1234567890abcdef1234567890").hasSecret).toBe(true);
    expect(containsSecret("Use sk-proj-12345678901234567890 for testing").hasSecret).toBe(true);
  });

  it("rejects GitHub personal access tokens", () => {
    expect(containsSecret("Here is my token: ghp_123456789012345678901234567890123456").hasSecret).toBe(true);
    expect(containsSecret("GitHub auth gho_123456789012345678901234567890123456").hasSecret).toBe(true);
  });

  it("rejects AWS and Google API keys", () => {
    expect(containsSecret("AWS access: AKIAIOSFODNN7EXAMPLE").hasSecret).toBe(true);
    expect(containsSecret("Google maps AIzaSyD12345678901234567890123456789012").hasSecret).toBe(true);
  });

  it("rejects private cryptographic keys and certificates", () => {
    expect(containsSecret("-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC5\n-----END PRIVATE KEY-----").hasSecret).toBe(true);
    expect(containsSecret("-----BEGIN RSA PRIVATE KEY-----").hasSecret).toBe(true);
    expect(containsSecret("-----BEGIN CERTIFICATE-----").hasSecret).toBe(true);
  });

  it("rejects JWT and Bearer tokens", () => {
    expect(containsSecret("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozG6P1P_E1qV1234567890").hasSecret).toBe(true);
  });

  it("rejects explicit passwords and credential statements", () => {
    expect(containsSecret("My password is supersecret123").hasSecret).toBe(true);
    expect(containsSecret("password: secretPassword456").hasSecret).toBe(true);
    expect(containsSecret("api_key = 'abcdef1234567890'").hasSecret).toBe(true);
    expect(containsSecret("recovery code: 1234-5678-9012").hasSecret).toBe(true);
  });

  it("permits safe user preferences, instructions, and facts", () => {
    expect(containsSecret("I prefer concise answers.").hasSecret).toBe(false);
    expect(containsSecret("Remember that Yusuf prefers morning meetings.").hasSecret).toBe(false);
    expect(containsSecret("Start video recordings with the end result first.").hasSecret).toBe(false);
    expect(containsSecret("DeepSeek models require 16GB VRAM for 14B Q4.").hasSecret).toBe(false);
    expect(containsSecret("Never schedule meetings on Friday afternoon.").hasSecret).toBe(false);
  });
});
