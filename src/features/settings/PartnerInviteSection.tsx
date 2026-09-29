// ============================================================
// PartnerInviteSection — «Партнер» у налаштуваннях (ADR-0232)
// ------------------------------------------------------------
// Видно лише парі з однієї людини: коли партнер приєднався, запрошувати
// нікого, і розділ зникає сам.
//
// Код видає база (`create_couple_invite`) — клієнт не вигадує жодного
// знака. Новий код гасить попередній: якщо старий пішов не туди, його
// досить створити знову.
// ============================================================
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { usePartnerQuery } from '@/features/_shared/useUsers';
import { COUPLE_TIME_ZONE } from '@/features/world/coupleEngine';
import { formatInviteCode, inviteExpiryText } from '@/features/auth/inviteCode';

interface Invite { code: string; expires_at: string }

function isInvite(row: unknown): row is Invite {
  return typeof row === 'object' && row !== null
    && typeof (row as Invite).code === 'string'
    && typeof (row as Invite).expires_at === 'string';
}

export function PartnerInviteSection() {
  const { partner, isPending, isError, refetch } = usePartnerQuery();
  const solo = !isPending && !isError && partner === null;

  // Список людей кешується на всю сесію; партнер міг приєднатися, поки
  // налаштування були закриті, — тож відкриття перепитує.
  useEffect(() => { void refetch(); }, [refetch]);

  if (!solo) return null;
  return (
    <>
      <InviteBody />
      <div className="settings-divider" />
    </>
  );
}

function InviteBody() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const active = useQuery({
    queryKey: qk.coupleInvite(),
    queryFn: async (): Promise<Invite | null> => {
      const { data, error } = await supabase
        .from('couple_invites')
        .select('code, expires_at')
        .is('used_at', null)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = (data ?? [])[0];
      return isInvite(row) ? row : null;
    },
  });

  const create = useMutation({
    mutationFn: async (): Promise<Invite> => {
      const { data, error } = await supabase.rpc('create_couple_invite');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!isInvite(row)) throw new Error('create_couple_invite: неочікувана відповідь');
      return row;
    },
    onSuccess: (invite) => {
      setCopied(false);
      queryClient.setQueryData(qk.coupleInvite(), invite);
    },
    onError: (error) => console.error('create_couple_invite:', error),
  });

  const invite = active.data ?? null;
  const shown = invite ? formatInviteCode(invite.code) : null;

  const share = async () => {
    if (!shown) return;
    const text = `Код для нашого порталу: ${shown}. Відкрий ${window.location.origin}, зареєструйся поштою й обери «Увійти за кодом».`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        // Людина закрила вікно «Поділитися» — це не помилка.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.warn('navigator.share:', error);
      }
    }
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
    } catch (error) {
      console.warn('clipboard:', error);
    }
  };

  return (
    <section className="settings-section partner-invite" aria-labelledby="partner-invite-title">
      <div className="settings-section-title" id="partner-invite-title">Партнер</div>
      <p className="settings-section-desc">
        Портал поки що лише твій. Дай партнерові код — з ним він чи вона приєднається до вашої пари з усім, що тут уже є.
      </p>

      {active.isError && <p className="partner-invite-problem" role="alert">Не вдалося перевірити код. Спробуй пізніше.</p>}

      {shown !== null && invite !== null && (
        <div className="partner-invite-card">
          <output className="partner-invite-code" aria-label={`Код запрошення ${shown}`}>{shown}</output>
          <span className="partner-invite-expiry">
            Діє {inviteExpiryText(invite.expires_at, COUPLE_TIME_ZONE)}, підходить один раз
          </span>
        </div>
      )}

      {create.isError && <p className="partner-invite-problem" role="alert">Не вдалося створити код. Спробуй ще раз.</p>}

      <div className="partner-invite-actions">
        {shown !== null && (
          <button type="button" className="btn partner-invite-share" onClick={() => void share()}>
            {copied ? 'Скопійовано' : 'Поділитися кодом'}
          </button>
        )}
        <button
          type="button"
          className={shown !== null ? 'btn btn-ghost' : 'btn'}
          disabled={create.isPending || active.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Створюємо…' : shown !== null ? 'Новий код' : 'Створити код'}
        </button>
      </div>
    </section>
  );
}
