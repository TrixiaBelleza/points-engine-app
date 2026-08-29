export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(body, { ...init, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json({ error: err.message, ...err.extra }, { status: err.status });
  }
  console.error(err);
  return json({ error: "Something went wrong." }, { status: 500 });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}
