import { describe, expect, it } from "vitest";
import { checkSiteverifyResult, checkSubmissionTiming } from "../lib/human-verification";

describe("human verification result handling", () => {
  it("accepts a realistic form completion and rejects too-fast or stale forms", () => {
    const now = 1_800_000_000_000;
    expect(checkSubmissionTiming(now - 5000, "", now)).toBeNull();
    expect(checkSubmissionTiming(now - 1000, "", now)).toMatchObject({ ok: false, reason: "too_fast", status: 400 });
    expect(checkSubmissionTiming(now - 86_400_001, "", now)).toMatchObject({ ok: false, reason: "form_expired" });
    expect(checkSubmissionTiming(now - 5000, "spam", now)).toMatchObject({ ok: false, reason: "suspicious_input" });
  });

  it("accepts only a successful verification from the configured hostname", () => {
    expect(checkSiteverifyResult({ success: true, hostname: "church.example" }, "church.example")).toEqual({ ok: true });
    expect(checkSiteverifyResult({ success: true, hostname: "other.example" }, "church.example"))
      .toMatchObject({ ok: false, reason: "hostname_mismatch", status: 503 });
    expect(checkSiteverifyResult({ success: true }, "church.example"))
      .toMatchObject({ ok: false, reason: "hostname_mismatch" });
  });

  it("explains expired single-use challenges without exposing tokens", () => {
    const expired = checkSiteverifyResult({ success: false, "error-codes": ["timeout-or-duplicate"] }, "church.example");
    expect(expired).toMatchObject({ ok: false, reason: "challenge_expired", status: 400 });
    if (!expired.ok) expect(expired.error).toContain("expired");
    expect(checkSiteverifyResult({ success: false, "error-codes": ["invalid-input-secret"] }, "church.example"))
      .toMatchObject({ ok: false, reason: "configuration", status: 503 });
    expect(checkSiteverifyResult({ success: false, "error-codes": ["invalid-input-response"] }, "church.example"))
      .toMatchObject({ ok: false, reason: "challenge_rejected", status: 400 });
  });
});
