import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { applyStagingChanges } from "./apply";
import { writeAudit } from "./audit";
import { describeAuthHeader, loadControlToken, readBearerToken, tokenFingerprint, tokensMatch } from "./auth";
import { CONTROL_HOST, CONTROL_PORT, MAX_BODY_BYTES } from "./config";
import { allowRequest } from "./rate-limit";
import { fetchStagingMeta, restartStagingAndVerify, StagingUnavailableError } from "./restart";
import { parseSetupBody, type AppliedChanges } from "./validate";

type Json = Record<string, unknown>;

class SafeHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "SafeHttpError";
  }
}

let expectedToken = "";
let setupLock: Promise<unknown> = Promise.resolve();

function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? "127.0.0.1";
}

function send(res: ServerResponse, status: number, body: Json): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  send(res, status, { error: message });
}

class UnauthorizedError extends SafeHttpError {
  constructor(public shape: Record<string, unknown>) {
    super(401, "Unauthorized");
  }
}

function requireAuth(req: IncomingMessage): void {
  const provided = readBearerToken(req.headers.authorization);
  if (!provided || !tokensMatch(provided, expectedToken)) {
    throw new UnauthorizedError({
      ...describeAuthHeader(req.headers.authorization),
      expected_fingerprint: tokenFingerprint(expectedToken),
      expected_length: expectedToken.length,
    });
  }
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new SafeHttpError(413, "Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (size === 0) {
        reject(new SafeHttpError(400, "Invalid JSON body."));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new SafeHttpError(400, "Invalid JSON body."));
      }
    });
    req.on("error", () => reject(new SafeHttpError(400, "Invalid JSON body.")));
  });
}

function withSetupLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = setupLock.then(fn, fn);
  setupLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function handleHealth(): Promise<Json> {
  return { service: "staging-control", status: "ok" };
}

async function handleStatus(): Promise<Json> {
  const meta = await fetchStagingMeta();
  if (!meta || typeof meta !== "object") {
    throw new SafeHttpError(502, "Staging is unavailable.");
  }
  return meta as Json;
}

async function handleSetup(req: IncomingMessage): Promise<{ body: Json; requestId: string; changes: AppliedChanges }> {
  const raw = await readBody(req);
  const parsed = parseSetupBody(raw);
  if (!parsed.ok) {
    throw new SafeHttpError(400, parsed.error);
  }
  try {
    return await withSetupLock(async () => {
      if (parsed.value.dry_run) {
        return {
          body: {
            request_id: parsed.value.request_id,
            environment: "staging",
            dry_run: true,
            applied_changes: parsed.value.changes,
            restart_completed: false,
            health: "skipped",
            verified_metadata: {},
          },
          requestId: parsed.value.request_id,
          changes: parsed.value.changes,
        };
      }

      const changes = await applyStagingChanges(parsed.value);
      const verify = await restartStagingAndVerify();
      return {
        body: {
          request_id: parsed.value.request_id,
          environment: "staging",
          dry_run: false,
          applied_changes: changes,
          restart_completed: verify.restart_completed,
          health: verify.health,
          verified_metadata: verify.verified_metadata,
        },
        requestId: parsed.value.request_id,
        changes,
      };
    });
  } catch (err) {
    if (err instanceof SafeHttpError) throw err;
    throw new SafeHttpError(500, "Could not apply staging changes.");
  }
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${CONTROL_HOST}:${CONTROL_PORT}`);
  const pathname = url.pathname;
  const isSetup = method === "POST" && pathname === "/setup";

  if (!allowRequest(clientIp(req), isSetup)) {
    res.setHeader("retry-after", "60");
    sendError(res, 429, "Too many requests.");
    return;
  }

  requireAuth(req);

  if (method === "GET" && pathname === "/health") {
    send(res, 200, await handleHealth());
    await writeAudit({
      timestamp: new Date().toISOString(),
      request_id: null,
      path: pathname,
      method,
      requested_changes: null,
      result: "ok",
    });
    return;
  }

  if (method === "GET" && pathname === "/status") {
    send(res, 200, await handleStatus());
    await writeAudit({
      timestamp: new Date().toISOString(),
      request_id: null,
      path: pathname,
      method,
      requested_changes: null,
      result: "ok",
    });
    return;
  }

  if (isSetup) {
    const result = await handleSetup(req);
    send(res, 200, result.body);
    await writeAudit({
      timestamp: new Date().toISOString(),
      request_id: result.requestId,
      path: pathname,
      method,
      requested_changes: result.changes,
      result: result.body.dry_run ? "dry_run" : result.body.health === "healthy" ? "ok" : "unhealthy",
    });
    return;
  }

  if (pathname === "/health" || pathname === "/status" || pathname === "/setup") {
    throw new SafeHttpError(405, "Method not allowed.");
  }
  throw new SafeHttpError(404, "Not found.");
}

function onRequest(req: IncomingMessage, res: ServerResponse): void {
  route(req, res).catch(async (err: unknown) => {
    const status = err instanceof SafeHttpError ? err.status : err instanceof StagingUnavailableError ? 502 : 500;
    const message =
      err instanceof SafeHttpError
        ? err.message
        : err instanceof StagingUnavailableError
          ? err.message
          : "Something went wrong.";
    if (!res.headersSent) sendError(res, status, message);
    const url = new URL(req.url ?? "/", `http://${CONTROL_HOST}:${CONTROL_PORT}`);
    await writeAudit({
      timestamp: new Date().toISOString(),
      request_id: null,
      path: url.pathname,
      method: req.method ?? "GET",
      requested_changes: null,
      result: `error:${status}`,
      ...(err instanceof UnauthorizedError ? { auth: err.shape } : {}),
    }).catch(() => undefined);
  });
}

expectedToken = loadControlToken();

const server = createServer(onRequest);
server.listen(CONTROL_PORT, CONTROL_HOST, () => {
  console.log(`staging-control listening on http://${CONTROL_HOST}:${CONTROL_PORT}`);
  console.log(`token fingerprint ${tokenFingerprint(expectedToken)} (length ${expectedToken.length})`);
});

server.on("error", (err) => {
  console.error("staging-control failed to bind to 127.0.0.1:3100");
  console.error(err.message);
  process.exit(1);
});
