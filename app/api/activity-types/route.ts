import { handle } from "@/lib/handle";
import { json } from "@/lib/http";
import { listActivityTypes } from "@/lib/members";
import { requireSession } from "@/lib/session";

export const GET = handle(async () => {
  await requireSession();
  return json({ activityTypes: await listActivityTypes() });
});
