import { handle } from "@/lib/handle";
import { json, readJson, HttpError } from "@/lib/http";
import { createMember, listMembers } from "@/lib/members";
import { requireSession } from "@/lib/session";

export const GET = handle(async (req) => {
  await requireSession();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return json({ members: await listMembers(q) });
});

export const POST = handle(async (req) => {
  await requireSession();
  const body = await readJson<{ name?: string; contactNumber?: string }>(req);
  try {
    const member = await createMember(body.name ?? "", body.contactNumber ?? "");
    return json({ member }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && !(err instanceof HttpError) && err.message.includes("2–80")) {
      throw new HttpError(400, err.message);
    }
    throw err;
  }
});
