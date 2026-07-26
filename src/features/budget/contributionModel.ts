export const CONTRIBUTION_NOTE_MAX = 240;

/** Finance currently stores and displays whole hryvnias. */
export function isValidContributionAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function normalizeContributionNote(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function canCancelContribution(contributedBy: number, currentUserId: number): boolean {
  return contributedBy === currentUserId;
}
