import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { AUDIT_LOG_FILE } from "./config";

export type AuditEntry = {
  timestamp: string;
  request_id: string | null;
  path: string;
  method: string;
  requested_changes: Record<string, unknown> | null;
  result: string;
  /** Shape-only credential description on auth failures. Never contains the token. */
  auth?: Record<string, unknown>;
};

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const line = JSON.stringify(entry) + "\n";
  await mkdir(path.dirname(AUDIT_LOG_FILE), { recursive: true });
  await appendFile(AUDIT_LOG_FILE, line, "utf8");
}
