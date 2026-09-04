import { createHash, timingSafeEqual } from "node:crypto";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time compare of bearer tokens. Never log `provided` or the expected token. */
export function tokensMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  return timingSafeEqual(sha256(provided), sha256(expected));
}

export function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

/**
 * Non-reversible 8-hex-char fingerprint, used to compare a rejected credential
 * against the expected one in the audit log without recording either value.
 */
export function tokenFingerprint(value: string): string {
  if (!value) return "empty";
  return sha256(value).toString("hex").slice(0, 8);
}

export type AuthShape = {
  header: "missing" | "present";
  scheme: string | null;
  parts: number;
  header_length: number;
  credential_length: number;
  credential_fingerprint: string;
  parsed: boolean;
};

/** Shape-only description of an Authorization header. Contains no secret material. */
export function describeAuthHeader(authorization: string | undefined): AuthShape {
  if (!authorization) {
    return {
      header: "missing",
      scheme: null,
      parts: 0,
      header_length: 0,
      credential_length: 0,
      credential_fingerprint: "empty",
      parsed: false,
    };
  }
  const trimmed = authorization.trim();
  const parts = trimmed.split(/\s+/);
  const credential = parts.slice(1).join(" ");
  return {
    header: "present",
    scheme: parts[0]?.slice(0, 12) ?? null,
    parts: parts.length,
    header_length: trimmed.length,
    credential_length: credential.length,
    credential_fingerprint: tokenFingerprint(credential),
    parsed: readBearerToken(authorization) !== null,
  };
}

export function loadControlToken(): string {
  const token = (process.env.STAGING_CONTROL_TOKEN ?? "").trim();
  if (!token || token.length < 16) {
    throw new Error("STAGING_CONTROL_TOKEN must be set to a string of at least 16 characters");
  }
  return token;
}
