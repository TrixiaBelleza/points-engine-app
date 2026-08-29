import path from "path";
import { env } from "./env";
import { resolveSettingsFilePath, settingsSourceLabel } from "./settings-path";
import {
  DEFAULT_PROGRAM_SETTINGS,
  type ProgramSettings,
  validateProgramSettings,
} from "./settings-types";

type Cache = { value: ProgramSettings; source: string; loadedAt: number };
const CACHE_MS = 5_000;
let cache: Cache | null = null;

function settingsFile(): string {
  const e = env();
  return resolveSettingsFilePath(e.appEnv, e.settingsFile, process.cwd());
}

export function settingsSourceLabelForEnv(): string {
  return settingsSourceLabel(settingsFile(), process.cwd());
}

async function fileGet(): Promise<ProgramSettings | null> {
  try {
    const { readFile } = await import("fs/promises");
    const text = await readFile(settingsFile(), "utf8");
    return validateProgramSettings(JSON.parse(text));
  } catch {
    return null;
  }
}

async function filePut(settings: ProgramSettings): Promise<void> {
  const { mkdir, writeFile } = await import("fs/promises");
  const p = settingsFile();
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(settings, null, 2), "utf8");
}

export async function getProgramSettings(opts?: { bypassCache?: boolean }): Promise<ProgramSettings> {
  if (!opts?.bypassCache && cache && Date.now() - cache.loadedAt < CACHE_MS) {
    return cache.value;
  }
  let settings = await fileGet();
  if (!settings) {
    settings = DEFAULT_PROGRAM_SETTINGS;
    await persistSettings(settings);
  }
  cache = { value: settings, source: settingsSourceLabelForEnv(), loadedAt: Date.now() };
  return settings;
}

export async function putProgramSettings(input: unknown): Promise<ProgramSettings> {
  const settings = validateProgramSettings(input);
  await persistSettings(settings);
  cache = { value: settings, source: settingsSourceLabelForEnv(), loadedAt: Date.now() };
  return settings;
}

async function persistSettings(settings: ProgramSettings): Promise<void> {
  await filePut(settings);
}

export function clearSettingsCache(): void {
  cache = null;
}
