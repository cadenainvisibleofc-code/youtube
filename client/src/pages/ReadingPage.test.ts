import { describe, expect, it } from "vitest";
import { parseReadingAttribution } from "@/lib/reading-attribution";

describe("reading attribution contract", () => {
  it("reads UTM and video identifiers from the real search string", () => {
    expect(parseReadingAttribution("?utm_source=youtube&utm_campaign=cadena&video=abc123")).toEqual({
      source: "youtube",
      campaign: "cadena",
      video: "abc123",
    });
  });

  it("falls back to direct attribution", () => {
    expect(parseReadingAttribution("")).toEqual({
      source: "direct",
      campaign: "none",
      video: "unknown",
    });
  });
});
