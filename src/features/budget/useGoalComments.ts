import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

const commentsKey = (goalId: string) => ['savingsGoalComments', goalId] as const;

async function callFinanceRpc(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export interface GoalComment {
  id: string;
  goalId: string;
  body: string;
  authorId: number;
  authorName: string;
  createdAt: string;
}

function normalizeGoalComment(value: unknown): GoalComment {
  if (!value || typeof value !== 'object') {
    throw new Error('Finance comment RPC returned an invalid row');
  }

  const row = value as Record<string, unknown>;
  const id = row.id;
  const goalId = row.goal_id;
  const body = row.body;
  const authorId = Number(row.author_id);
  const authorName = row.author_name;
  const createdAt = row.created_at;

  if (
    typeof id !== 'string'
    || typeof goalId !== 'string'
    || typeof body !== 'string'
    || !Number.isSafeInteger(authorId)
    || typeof authorName !== 'string'
    || typeof createdAt !== 'string'
  ) {
    throw new Error('Finance comment RPC returned an invalid payload');
  }

  return { id, goalId, body, authorId, authorName, createdAt };
}

export function useGoalComments(goalId: string | null) {
  const client = useQueryClient();

  useEffect(() => {
    if (!goalId) return undefined;

    const invalidate = () => {
      void client.invalidateQueries({ queryKey: commentsKey(goalId) });
    };

    const channel = supabase
      .channel(`finance-goal-comments-${goalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'savings_goal_comments',
          filter: `goal_id=eq.${goalId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client, goalId]);

  return useQuery({
    queryKey: commentsKey(goalId ?? 'closed'),
    enabled: goalId !== null,
    queryFn: async (): Promise<GoalComment[]> => {
      if (!goalId) return [];
      const data = await callFinanceRpc('finance_get_savings_goal_comments_v1', {
        p_goal_id: goalId,
      });
      if (!Array.isArray(data)) {
        throw new Error('Finance comments returned an invalid result');
      }
      return data.map(normalizeGoalComment);
    },
  });
}

function commentErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('finance_goal_comment_delete_not_allowed')) {
    return 'Можна видалити лише власний коментар.';
  }
  if (message.includes('finance_stale_goal_comment')) {
    return 'Цей коментар уже видалено. Обговорення оновлено.';
  }
  if (message.includes('finance_goal_comment_too_long')) {
    return 'Коментар має бути коротшим за 500 символів.';
  }
  if (message.includes('finance_goal_comment_required')) {
    return 'Напиши хоча б кілька слів.';
  }
  return 'Не вдалося оновити обговорення. Спробуй ще.';
}

export function useGoalCommentMutations(goalId: string) {
  const client = useQueryClient();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: commentsKey(goalId) });
  const onError = (error: unknown) => {
    console.error('Finance goal comment mutation failed:', error);
    toast.show(commentErrorText(error));
  };

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      await callFinanceRpc('finance_add_savings_goal_comment_v1', {
        p_goal_id: goalId,
        p_body: body,
      });
    },
    onError,
    onSettled: invalidate,
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      await callFinanceRpc('finance_delete_savings_goal_comment_v1', {
        p_comment_id: commentId,
      });
    },
    onError,
    onSettled: invalidate,
  });

  return { addComment, deleteComment };
}
