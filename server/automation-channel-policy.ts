export function candidateMatchesAutomationChannel(candidateChannelId: string, selectedChannelId: string | undefined) {
  return selectedChannelId === undefined || candidateChannelId === selectedChannelId;
}

export function automationScopeKey(ownerId: number, projectChannelId: number | undefined) {
  return `${ownerId}:${projectChannelId ?? "legacy"}`;
}

export function automationDedupeKey(input: { ownerId: number; projectChannelId?: number; videoId: string; parentCommentId?: string | null; day: string }) {
  return `${automationScopeKey(input.ownerId, input.projectChannelId)}:${input.videoId}:${input.parentCommentId ?? "video"}:${input.day}`;
}
