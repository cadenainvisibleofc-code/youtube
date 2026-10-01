export type ChannelConnectionCandidate = {
  id: number;
  channelId: string;
  channelName: string;
  status: "connected" | "reauthorization_required";
};

export class ChannelSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelSelectionError";
  }
}

/**
 * Resolve a connection only when the requested channel is unambiguous.
 * This helper is intentionally pure so it can be adopted by OAuth, publisher
 * and automation code without making the current single-channel schema unsafe.
 */
export function resolveChannelConnection(
  connections: readonly ChannelConnectionCandidate[],
  requestedChannelId?: string,
) {
  const connected = connections.filter(connection => connection.status === "connected");
  if (requestedChannelId) {
    const matches = connected.filter(connection => connection.channelId === requestedChannelId);
    if (matches.length === 0) throw new ChannelSelectionError("Canal solicitado não está conectado");
    if (matches.length > 1) throw new ChannelSelectionError("Canal solicitado possui conexões duplicadas");
    return matches[0];
  }
  if (connected.length === 0) throw new ChannelSelectionError("Nenhum canal conectado está disponível");
  if (connected.length > 1) throw new ChannelSelectionError("É necessário informar o canal quando há múltiplas conexões");
  return connected[0];
}
