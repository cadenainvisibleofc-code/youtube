import { describe, expect, it } from "vitest";
import { ChannelSelectionError, resolveChannelConnection, type ChannelConnectionCandidate } from "./channel-selection";

const channelA: ChannelConnectionCandidate = { id: 1, channelId: "channel-a", channelName: "Canal A", status: "connected" };
const channelB: ChannelConnectionCandidate = { id: 2, channelId: "channel-b", channelName: "Canal B", status: "connected" };

describe("resolveChannelConnection", () => {
  it("resolves the only connected channel when no target is supplied", () => {
    expect(resolveChannelConnection([channelA])).toEqual(channelA);
  });

  it("rejects an ambiguous selection when multiple channels are connected", () => {
    expect(() => resolveChannelConnection([channelA, channelB])).toThrowError(new ChannelSelectionError("É necessário informar o canal quando há múltiplas conexões"));
  });

  it("resolves the explicitly requested channel", () => {
    expect(resolveChannelConnection([channelA, channelB], "channel-b")).toEqual(channelB);
  });

  it("rejects a requested channel that is not connected", () => {
    expect(() => resolveChannelConnection([channelA], "channel-b")).toThrow("Canal solicitado não está conectado");
  });

  it("ignores reauthorization-required connections", () => {
    expect(() => resolveChannelConnection([{ ...channelA, status: "reauthorization_required" }])).toThrow(/Nenhum canal conectado/);
  });
});
