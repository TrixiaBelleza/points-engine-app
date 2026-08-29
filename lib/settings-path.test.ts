import path from "path";
import { describe, expect, it } from "vitest";
import { defaultSettingsRelPath, resolveSettingsFilePath, settingsSourceLabel } from "./settings-path";

describe("settings file path", () => {
  const cwd = "/app";

  it("defaults to a distinct file per APP_ENV", () => {
    expect(defaultSettingsRelPath("development")).toBe(".data/local/program-settings.json");
    expect(defaultSettingsRelPath("staging")).toBe(".data/staging/program-settings.json");
    expect(defaultSettingsRelPath("production")).toBe(".data/production/program-settings.json");
  });

  it("resolves SETTINGS_FILE relative to cwd", () => {
    expect(resolveSettingsFilePath("staging", "custom/staging.json", cwd)).toBe(
      path.resolve(cwd, "custom/staging.json"),
    );
  });

  it("refuses production/staging files on the laptop", () => {
    expect(() => resolveSettingsFilePath("development", ".data/production/program-settings.json", cwd)).toThrow(
      /production or staging/,
    );
    expect(() => resolveSettingsFilePath("development", ".data/staging/program-settings.json", cwd)).toThrow(
      /production or staging/,
    );
  });

  it("labels the source as a file URL", () => {
    const abs = path.resolve(cwd, ".data/production/program-settings.json");
    expect(settingsSourceLabel(abs, cwd)).toBe("file://.data/production/program-settings.json");
  });
});
