import "server-only";
import { getPublicEvent } from "@/lib/event-server";
import { isSundayInPhilippines, QR_REQUIRED_MESSAGE, SUNDAY_CLOSED_MESSAGE } from "@/lib/submission-policy";

export async function submissionAccess(kind: "arc" | "prayer", token: string) {
  if (kind === "arc" && !isSundayInPhilippines()) return SUNDAY_CLOSED_MESSAGE;
  if (token.length < 24 || token.length > 160) return QR_REQUIRED_MESSAGE;
  const event = await getPublicEvent(token);
  if (!event || event.event_type !== "sunday_service") return QR_REQUIRED_MESSAGE;
  return null;
}
