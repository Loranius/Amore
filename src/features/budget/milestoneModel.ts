export const GOAL_MILESTONES = [25, 50, 75, 100] as const;

export type GoalMilestoneLevel = (typeof GOAL_MILESTONES)[number];

const MILESTONE_MESSAGES: Record<GoalMilestoneLevel, string> = {
  25: 'Чверть шляху вже позаду ✨',
  50: 'Половина шляху вже пройдена 🤍',
  75: 'Більша частина шляху вже позаду 🌿',
  100: 'Сума зібрана — цей шлях ви пройшли разом ✨',
};

export interface GoalMilestoneState {
  progress: number;
  displayProgress: number;
  reached: GoalMilestoneLevel[];
  current: GoalMilestoneLevel | null;
  message: string;
}

export function calculateGoalProgress(savedAmount: number, targetAmount: number): number {
  if (!Number.isFinite(savedAmount) || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (savedAmount / targetAmount) * 100));
}

export function getGoalMilestoneState(
  savedAmount: number,
  targetAmount: number,
): GoalMilestoneState {
  const progress = calculateGoalProgress(savedAmount, targetAmount);
  const reached = GOAL_MILESTONES.filter((level) => progress >= level);
  const current: GoalMilestoneLevel | null = reached.length > 0
    ? reached[reached.length - 1]!
    : null;

  return {
    progress,
    displayProgress: Math.round(progress),
    reached,
    current,
    message: current
      ? MILESTONE_MESSAGES[current]
      : 'Кожен внесок — ще один спільний крок.',
  };
}
