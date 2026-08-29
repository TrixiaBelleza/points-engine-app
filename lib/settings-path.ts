import path from "path";
import type { AppEnv } from "./env";

export function defaultSettingsRelPath(appEnv: AppEnv): string {
  if (appEnv === "production") return ".data/production/program-settings.json";
  if (appEnv === "staging") return ".data/staging/program-settings.json";
  return ".data/local/program-settings.json";
}

export function resolveSettingsFilePath(appEnv: AppEnv, settingsFile: string, cwd: string): string {
  const rel = settingsFile.trim() || defaultSettingsRelPath(appEnv);
  const resolved = path.resolve(cwd, rel);
  const posix = resolved.replace(/\\/g, "/");
  if (appEnv === "development" && /\/(production|staging)\//.test(posix)) {
    throw new Error("Refusing to use production or staging settings files when APP_ENV=development");
  }
  return resolved;
}

export function settingsSourceLabel(filePath: string, cwd: string): string {
  const rel = path.relative(cwd, filePath);
  const shown = rel && !rel.startsWith("..") ? rel : filePath;
  return `file://${shown.replace(/\\/g, "/")}`;
}
