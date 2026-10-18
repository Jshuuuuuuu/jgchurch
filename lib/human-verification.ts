// Keep this module free of secrets so verification outcomes can be unit-tested.
export type HumanFailureReason =
  | "suspicious_input"
  | "too_fast"
  | "form_expired"
  | "challenge_missing"
  | "challenge_expired"
  | "challenge_rejected"
  | "configuration"
  | "hostname_mismatch"
  | "verification_unavailable";

export type HumanVerificationResult =
  | { ok: true }
  | { ok: false; reason: HumanFailureReason; status: 400 | 503; error: string };

const messages: Record<HumanFailureReason, { status: 400 | 503; error: string }> = {
  suspicious_input: { status: 400, error: "Bot verification could not be completed. Please try again." },
  too_fast: { status: 400, error: "Please wait a few seconds before submitting, then complete verification again." },
  form_expired: { status: 400, error: "This form has been open too long. Refresh the page and submit again." },
  challenge_missing: { status: 400, error: "Please complete bot verification before submitting." },
  challenge_expired: { status: 400, error: "Bot verification expired or was already used. Complete the refreshed challenge and try again." },
  challenge_rejected: { status: 400, error: "Bot verification was not accepted. Complete the refreshed challenge and try again." },
  configuration: { status: 503, error: "Bot verification is not configured correctly for this site. Please notify the church administrator." },
  hostname_mismatch: { status: 503, error: "This website's bot verification domain does not match its configuration. Please notify the church administrator." },
  verification_unavailable: { status: 503, error: "Bot verification is temporarily unavailable. Please try again later." },
};

export function verificationFailure(reason: HumanFailureReason): HumanVerificationResult {
  return { ok: false, reason, ...messages[reason] };
}

export function checkSubmissionTiming(startedAt: number, honeypot: string, now = Date.now()): HumanVerificationResult | null {
  if (honeypot || !Number.isSafeInteger(startedAt) || startedAt <= 0) return verificationFailure("suspicious_input");
  const age = now - startedAt;
  if (age < 2500) return verificationFailure("too_fast");
  if (age > 86_400_000) return verificationFailure("form_expired");
  return null;
}

export function checkSiteverifyResult(
  result: { success?: boolean; hostname?: string; action?: string; "error-codes"?: string[] },
  expectedHostname: string | null,
  expectedAction?: string,
): HumanVerificationResult {
  if (result.success !== true) {
    const codes = result["error-codes"] ?? [];
    if (codes.includes("timeout-or-duplicate")) return verificationFailure("challenge_expired");
    if (codes.includes("missing-input-secret") || codes.includes("invalid-input-secret")) return verificationFailure("configuration");
    return verificationFailure("challenge_rejected");
  }
  if (expectedHostname && result.hostname !== expectedHostname) return verificationFailure("hostname_mismatch");
  if (expectedAction && result.action !== expectedAction) return verificationFailure("challenge_rejected");
  return { ok: true };
}
