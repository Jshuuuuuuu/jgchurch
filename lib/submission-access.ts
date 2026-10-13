import "server-only";
import { getPublicEvent } from "@/lib/event-server";
import { QR_REQUIRED_MESSAGE } from "@/lib/submission-policy";

export async function submissionAccess(token: string) {
  if (token.length < 24 || token.length > 160) return QR_REQUIRED_MESSAGE;
  const event = await getPublicEvent(token);
  if (!event || event.event_type !== "sunday_service") return QR_REQUIRED_MESSAGE;
  return null;
}
