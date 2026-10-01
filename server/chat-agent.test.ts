import { describe, expect, it } from "vitest";
import { chatAttachmentKind, explicitlyRequestsMemoryLearning } from "./chat-agent";

describe("chatAttachmentKind", () => {
  it.each([
    ["image/png", "image"],
    ["image/jpeg", "image"],
    ["application/pdf", "pdf"],
    ["audio/webm", "audio"],
    ["audio/webm;codecs=opus", "audio"],
    ["audio/mpeg", "audio"],
  ])("accepts %s as %s", (mimeType, expected) => {
    expect(chatAttachmentKind(mimeType)).toBe(expected);
  });

  it.each(["text/html", "application/zip", "video/mp4", "image/svg+xml", "audio/flac"])("rejects unsafe or unsupported type %s", mimeType => {
    expect(chatAttachmentKind(mimeType)).toBeNull();
  });
});

describe("explicitlyRequestsMemoryLearning", () => {
  it("accepts an explicit request to remember a project rule", () => {
    expect(explicitlyRequestsMemoryLearning("Registre este aprendizado para o projeto daqui pra frente.")).toBe(true);
  });

  it("does not infer permission from ordinary feedback", () => {
    expect(explicitlyRequestsMemoryLearning("Esse comentário ficou robótico e pouco humano.")).toBe(false);
  });
});
