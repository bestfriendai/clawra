export interface RollingRelationshipState {
  currentVibe: string;
  recentTopic: string;
  openThread: string;
  currentBit: string;
  moodPattern: string;
}

export function buildRelationshipStateBlock(state: RollingRelationshipState): string {
  return `## CURRENT STATE OF YOUR RELATIONSHIP
- Vibe between you two: ${state.currentVibe}
- Recent shared topic: ${state.recentTopic}
- Unresolved thread: ${state.openThread}
- Current inside joke/bit: ${state.currentBit}
- His current mood pattern: ${state.moodPattern}`;
}
