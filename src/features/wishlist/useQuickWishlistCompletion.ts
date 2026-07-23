import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeFn } from '@/lib/supabase';
import { burstConfetti } from '@/lib/confetti';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { completeWishlistGiftWithoutMemory, type WishlistItemV3 } from './wishlistRpc';
import { isAmbiguousWishlistTransportError } from './wishlistFailurePolicy';

export function useQuickWishlistCompletion() {
  const client = useQueryClient();
  const me = useCurrentUser();
  const toast = useToast();
  const { data: users } = useUsers();

  return useMutation({
    mutationFn: async (item: WishlistItemV3) => {
      if (item.completion_mode !== 'gift') throw new Error('quick_completion_personal_only');

      await completeWishlistGiftWithoutMemory(item.id);

      const owner = (users ?? []).find((user) => user.id === item.owner);
      try {
        await invokeFn('db-notify', {
          type: 'wish_fulfilled',
          itemTitle: item.title,
          ownerId: owner?.id,
          buyerId: me.id,
        });
      } catch (error) {
        console.warn('[Wishlist] db-notify error:', error);
      }
    },
    onSuccess: () => {
      burstConfetti();
      toast.show('Подарунок вручено — бажання перенесено у спогади ♡');
    },
    onError: (error) => {
      const message = (error as Error).message;
      toast.show(
        isAmbiguousWishlistTransportError(error)
          ? 'Не вдалося підтвердити завершення. Натисни «Подарунок вручено» ще раз — дубліката не буде.'
          : message.includes('wish_not_completable')
            ? 'Стан подарунка вже змінився. Оновлюємо список.'
            : 'Не вдалося завершити подарунок. Спробуй ще.',
      );
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
}
