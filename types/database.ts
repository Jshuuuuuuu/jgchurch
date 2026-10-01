export type ArcType = "affirmation" | "recommendation" | "correction";
export type ArcStatus = "unread" | "reviewed" | "in_progress" | "resolved";
export type PrayerStatus = "new" | "being_prayed_for" | "followup_requested" | "closed";
export interface MinistryArea { id: string; name: string; active: boolean; }
