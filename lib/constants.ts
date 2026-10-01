export const DEFAULT_MINISTRIES = ["Worship", "Multimedia", "Ushering", "Preaching / Teaching", "Youth Ministry", "Prayer Ministry", "Program Flow", "Facilities", "Communications", "Leadership", "Others"] as const;
export const PRAYER_CATEGORIES = ["Personal / Spiritual Growth", "Family", "Health and Healing", "Financial Provision", "Academics / Career", "Thanksgiving", "Others"] as const;
export const PRAYER_VISIBILITIES = [{ value: "prayer_team", label: "Prayer Team Only" }, { value: "leader_only", label: "Pastor / Designated Leader Only" }, { value: "congregation_review", label: "May Be Shared With the Congregation" }] as const;
export const MEMBER_STATUSES = ["regular", "new", "visitor", "inactive"] as const;
export const ARC_TYPES = ["affirmation", "recommendation", "correction"] as const;
export const ARC_LABELS = { affirmation: "Affirmation", recommendation: "Recommendation", correction: "Correction" } as const;
