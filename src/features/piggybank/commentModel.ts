export const GOAL_COMMENT_MAX = 500;

export function normalizeGoalComment(value: string): string {
  return value.trim();
}

export function isValidGoalComment(value: string): boolean {
  const normalized = normalizeGoalComment(value);
  return normalized.length > 0 && normalized.length <= GOAL_COMMENT_MAX;
}

export function canDeleteGoalComment(authorId: number, currentUserId: number): boolean {
  return authorId === currentUserId;
}
