import { afterEach, describe, expect, it } from "vitest";
import { cancelEarnEnabled } from "./env";

describe("ENABLE_CANCEL_EARN", () => {
  const original = process.env.ENABLE_CANCEL_EARN;

  afterEach(() => {
    if (original === undefined) delete process.env.ENABLE_CANCEL_EARN;
    else process.env.ENABLE_CANCEL_EARN = original;
  });

  it("defaults to enabled when unset", () => {
    delete process.env.ENABLE_CANCEL_EARN;
    expect(cancelEarnEnabled()).toBe(true);
  });

  it("can be turned off per instance", () => {
    process.env.ENABLE_CANCEL_EARN = "false";
    expect(cancelEarnEnabled()).toBe(false);
  });
});
