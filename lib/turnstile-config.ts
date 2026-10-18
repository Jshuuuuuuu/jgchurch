// Cloudflare Turnstile site keys are public. The matching secret must stay in
// the Vercel server environment as TURNSTILE_SECRET_KEY, never in this repository.
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFVrQ-Iv92fvLjz1";

export const TURNSTILE_ACTIONS = {
  arc: "arc",
  prayer: "prayer",
  registration: "registration",
} as const;

export type TurnstileAction = typeof TURNSTILE_ACTIONS[keyof typeof TURNSTILE_ACTIONS];
