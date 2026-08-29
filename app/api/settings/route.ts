import { handle } from "@/lib/handle";
import { json, readJson } from "@/lib/http";
import { requireSession } from "@/lib/session";
import { getProgramSettings, putProgramSettings } from "@/lib/settings";
import { HttpError } from "@/lib/http";

export const GET = handle(async () => {
  await requireSession();
  const settings = await getProgramSettings({ bypassCache: true });
  return json({ settings });
});

export const PUT = handle(async (req) => {
  await requireSession();
  const body = await readJson<unknown>(req);
  try {
    const settings = await putProgramSettings(body);
    return json({ settings });
  } catch (err) {
    if (err instanceof Error && !(err instanceof HttpError)) {
      throw new HttpError(400, err.message);
    }
    throw err;
  }
});
