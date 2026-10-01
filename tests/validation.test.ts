import { describe, expect, it } from "vitest";
import { arcSubmissionSchema, prayerRequestSchema } from "../lib/validation";
const ids = ["00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003"];
const types = ["affirmation","recommendation","correction"] as const;
describe("ARC submission validation", () => {
  it("accepts all seven non-empty ARC combinations", () => { for (let mask = 1; mask < 8; mask++) { const entries = types.filter((_, index) => mask & (1 << index)).map((type, index) => ({ type, ministryAreaId: ids[index], content: "A thoughtful response for the church." })); expect(arcSubmissionSchema.safeParse({ entries, startedAt: Date.now() - 5000, website: "" }).success).toBe(true); } });
  it("rejects duplicate categories", () => { expect(arcSubmissionSchema.safeParse({ startedAt: Date.now(), entries: [{ type: "affirmation", ministryAreaId: ids[0], content: "This response is long enough." }, { type: "affirmation", ministryAreaId: ids[1], content: "This response is also long enough." }] }).success).toBe(false); });
});
describe("prayer request consent", () => {
  const base = { startedAt: Date.now() - 5000, anonymous: true, name: "", request: "Please pray for wisdom and peace.", category: "Family", visibility: "prayer_team", contactConsent: false, contact: "", shareConsent: false };
  it("accepts a private anonymous request", () => expect(prayerRequestSchema.safeParse(base).success).toBe(true));
  it("requires consent for congregational review", () => expect(prayerRequestSchema.safeParse({ ...base, visibility: "congregation_review" }).success).toBe(false));
  it("requires consent before collecting contact details", () => expect(prayerRequestSchema.safeParse({ ...base, contact: "person@example.com" }).success).toBe(false));
});
