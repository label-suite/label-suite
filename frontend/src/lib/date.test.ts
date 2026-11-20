import { afterEach, describe, expect, it, vi } from "vitest";

import * as dateModule from "./date";
import { formatDevCheckTime } from "./date";

const INSTANT = "2026-11-20T08:15:30.123Z";

describe("formatDevCheckTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the same instant in each device's local time (Taipei and New York)", () => {
    expect(formatDevCheckTime(INSTANT, "Asia/Taipei")).toBe("2026-11-20 16:15:30（UTC+8）");
    expect(formatDevCheckTime(INSTANT, "America/New_York")).toBe("2026-11-20 03:15:30（UTC-5）");
  });

  it("moves the date forward when the conversion crosses midnight", () => {
    expect(formatDevCheckTime("2026-11-20T17:30:00Z", "Asia/Taipei")).toBe(
      "2026-11-21 01:30:00（UTC+8）",
    );
  });

  it("shows the offset in effect at that instant during daylight saving time", () => {
    expect(formatDevCheckTime("2026-07-01T12:00:00Z", "America/New_York")).toBe(
      "2026-07-01 08:00:00（UTC-4）",
    );
  });

  it("shows a zero offset as UTC+0", () => {
    expect(formatDevCheckTime(INSTANT, "UTC")).toBe("2026-11-20 08:15:30（UTC+0）");
  });

  it("shows a non-whole-hour offset with minutes", () => {
    expect(formatDevCheckTime(INSTANT, "Asia/Kolkata")).toBe("2026-11-20 13:45:30（UTC+5:30）");
  });

  it("uses the time zone the device reports when none is given", () => {
    // Override only the reported time zone; the real Intl.DateTimeFormat stays
    // in place because day.js converts through its formatToParts.
    const reported = new Intl.DateTimeFormat().resolvedOptions();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      ...reported,
      timeZone: "America/New_York",
    });

    expect(formatDevCheckTime(INSTANT)).toBe("2026-11-20 03:15:30（UTC-5）");
  });

  it("exports only formatDevCheckTime", () => {
    expect(Object.keys(dateModule)).toEqual(["formatDevCheckTime"]);
  });
});
