import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { boot } from "@/lib/boot";
import { getProgramSettings, settingsSourceLabel } from "@/lib/settings";

export const dynamic = "force-dynamic";

function corsHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  await boot();
  const e = env();
  const settings = await getProgramSettings({ bypassCache: true });
  return json(
    {
      app: "points-engine",
      environment: e.appEnv,
      version: e.version,
      gitTag: e.gitTag,
      gitSha: e.gitSha,
      deployedAt: e.deployedAt,
      publicUrl: e.publicUrl,
      settingsSource: settingsSourceLabel(),
      settings,
    },
    { headers: corsHeaders() },
  );
}
