import { afterEach, describe, expect, it } from "vitest";
import { appDocumentTitle, cancelEarnEnabled, cancelRedeemEnabled } from "./env";

describe("appDocumentTitle", () => {
  const original = process.env.APP_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = original;
  });

  it("uses LOCAL for development", () => {
    process.env.APP_ENV = "development";
    expect(appDocumentTitle()).toBe("LOCAL - Points Engine");
  });

  it("uses STG for staging", () => {
    process.env.APP_ENV = "staging";
    expect(appDocumentTitle()).toBe("STG - Points Engine");
  });

  it("uses PROD for production", () => {
    process.env.APP_ENV = "production";
    expect(appDocumentTitle()).toBe("PROD - Points Engine");
  });
});

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

describe("ENABLE_CANCEL_REDEEM", () => {
  const original = process.env.ENABLE_CANCEL_REDEEM;

  afterEach(() => {
    if (original === undefined) delete process.env.ENABLE_CANCEL_REDEEM;
    else process.env.ENABLE_CANCEL_REDEEM = original;
  });

  it("defaults to enabled when unset", () => {
    delete process.env.ENABLE_CANCEL_REDEEM;
    expect(cancelRedeemEnabled()).toBe(true);
  });

  it("can be turned off per instance", () => {
    process.env.ENABLE_CANCEL_REDEEM = "false";
    expect(cancelRedeemEnabled()).toBe(false);
  });
});
