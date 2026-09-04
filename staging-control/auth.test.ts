import { describe, expect, it } from "vitest";
import { readBearerToken, tokensMatch } from "./auth";

describe("control auth", () => {
  it("parses a bearer token", () => {
    expect(readBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(readBearerToken("bearer abc.def")).toBe("abc.def");
    expect(readBearerToken("Basic abc")).toBeNull();
    expect(readBearerToken(undefined)).toBeNull();
  });

  it("matches equal tokens and rejects mismatches", () => {
    expect(tokensMatch("super-secret-token", "super-secret-token")).toBe(true);
    expect(tokensMatch("super-secret-token", "other-secret-token")).toBe(false);
    expect(tokensMatch("", "super-secret-token")).toBe(false);
  });
});
