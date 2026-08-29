import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";
import {
  DEFAULT_PROGRAM_SETTINGS,
  type ProgramSettings,
  validateProgramSettings,
} from "./settings-types";

type Cache = { value: ProgramSettings; source: string; loadedAt: number };
const CACHE_MS = 5_000;
let cache: Cache | null = null;

function s3Client(): S3Client | null {
  const e = env();
  if (!e.awsS3Bucket) return null;
  if (!e.awsAccessKeyId || !e.awsSecretAccessKey) return null;
  return new S3Client({
    region: e.awsRegion,
    credentials: {
      accessKeyId: e.awsAccessKeyId,
      secretAccessKey: e.awsSecretAccessKey,
    },
    ...(e.awsS3Endpoint
      ? { endpoint: e.awsS3Endpoint, forcePathStyle: true }
      : {}),
  });
}

function fallbackPath(): string {
  return `${process.cwd()}/.data/program-settings.json`;
}

export function settingsSourceLabel(): string {
  const e = env();
  if (e.awsS3Bucket) return `s3://${e.awsS3Bucket}/${e.settingsS3Key}`;
  return "file://.data/program-settings.json (S3 last resort — set AWS_S3_BUCKET)";
}

async function s3Get(): Promise<ProgramSettings | null> {
  const e = env();
  const client = s3Client();
  if (!client || !e.awsS3Bucket) return null;
  try {
    const out = await client.send(
      new GetObjectCommand({ Bucket: e.awsS3Bucket, Key: e.settingsS3Key }),
    );
    const text = await out.Body?.transformToString();
    if (!text) return null;
    return validateProgramSettings(JSON.parse(text));
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (name === "NoSuchKey" || name === "NotFound" || status === 404) return null;
    console.error("S3 GetObject failed for program settings:", err);
    throw err;
  }
}

async function s3Put(settings: ProgramSettings): Promise<boolean> {
  const e = env();
  const client = s3Client();
  if (!client || !e.awsS3Bucket) return false;
  await client.send(
    new PutObjectCommand({
      Bucket: e.awsS3Bucket,
      Key: e.settingsS3Key,
      Body: JSON.stringify(settings, null, 2),
      ContentType: "application/json",
      CacheControl: "no-store",
    }),
  );
  return true;
}

async function fileGet(): Promise<ProgramSettings | null> {
  try {
    const { readFile } = await import("fs/promises");
    const text = await readFile(fallbackPath(), "utf8");
    return validateProgramSettings(JSON.parse(text));
  } catch {
    return null;
  }
}

async function filePut(settings: ProgramSettings): Promise<void> {
  const { mkdir, writeFile } = await import("fs/promises");
  const p = fallbackPath();
  await mkdir(`${process.cwd()}/.data`, { recursive: true });
  await writeFile(p, JSON.stringify(settings, null, 2), "utf8");
}

export async function getProgramSettings(opts?: { bypassCache?: boolean }): Promise<ProgramSettings> {
  if (!opts?.bypassCache && cache && Date.now() - cache.loadedAt < CACHE_MS) {
    return cache.value;
  }
  let settings: ProgramSettings | null = null;
  const client = s3Client();
  if (client) {
    try {
      settings = await s3Get();
    } catch {
      settings = await fileGet();
    }
  } else {
    settings = await fileGet();
  }
  if (!settings) {
    settings = DEFAULT_PROGRAM_SETTINGS;
    await persistSettings(settings);
  }
  cache = { value: settings, source: settingsSourceLabel(), loadedAt: Date.now() };
  return settings;
}

export async function putProgramSettings(input: unknown): Promise<ProgramSettings> {
  const settings = validateProgramSettings(input);
  await persistSettings(settings);
  cache = { value: settings, source: settingsSourceLabel(), loadedAt: Date.now() };
  return settings;
}

async function persistSettings(settings: ProgramSettings): Promise<void> {
  const wroteS3 = await s3Put(settings).catch((err) => {
    console.error("S3 PutObject failed; writing last-resort local file:", err);
    return false;
  });
  if (!wroteS3) {
    if (env().awsS3Bucket) {
      console.warn("Program settings saved locally because S3 PutObject did not succeed.");
    } else {
      console.warn("AWS_S3_BUCKET is unset. Program settings stored in .data/ (SPEC last resort).");
    }
    await filePut(settings);
  }
}

export function clearSettingsCache(): void {
  cache = null;
}
