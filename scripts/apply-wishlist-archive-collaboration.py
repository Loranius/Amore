from __future__ import annotations

from pathlib import Path
import shutil
import textwrap

ROOT = Path(__file__).resolve().parents[1]
WISHLIST = ROOT / "src/features/wishlist"
WORKFLOW = ROOT / ".github/workflows/apply-wishlist-archive-collaboration.yml"
SCRIPT = ROOT / "scripts/apply-wishlist-archive-collaboration.py"


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")


archive_source = WISHLIST / "WishArchive.tsx"
archive_base = WISHLIST / "WishArchiveBase.tsx"
page_source = WISHLIST / "WishlistPage.tsx"
page_base = WISHLIST / "WishlistPageBase.tsx"

if not archive_source.exists() or not page_source.exists():
    raise SystemExit("Wishlist sources were not found")
if archive_base.exists() or page_base.exists():
    raise SystemExit("Collaborative archive base files already exist; refusing to overwrite")

shutil.copy2(archive_source, archive_base)
shutil.copy2(page_source, page_base)

write(
    WISHLIST / "WishArchive.tsx",
    r'''
    import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
    import { createPortal } from 'react-dom';
    import { WishArchive as WishArchiveBase } from './WishArchiveBase';
    import { ArchiveWishEditModal } from './ArchiveWishEditModal';
    import type { WishlistArchiveScope } from './wishlistRpc';
    import './wishlistArchiveCollaborative.css';

    interface WishArchiveProps {
      scope: WishlistArchiveScope;
      ownerId?: number | null;
      onPhotoClick: (src: string) => void;
      openRequested?: boolean;
      openRequestKey?: string | null;
      focusWishId?: number | null;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }

    function ArchiveEditAction({ onEdit }: { onEdit: () => void }) {
      const [target, setTarget] = useState<HTMLElement | null>(null);

      useEffect(() => {
        const findTarget = () => {
          const next = document.querySelector<HTMLElement>('.wl-archive-cloud-sheet-content');
          setTarget((current) => current === next ? current : next);
        };

        findTarget();
        const observer = new MutationObserver(findTarget);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
      }, []);

      if (!target) return null;

      return createPortal(
        <button type="button" className="wl-archive-edit-completed" onClick={onEdit}>
          <span aria-hidden="true">✎</span>
          Редагувати бажання
        </button>,
        target,
      );
    }

    export function WishArchive(props: WishArchiveProps) {
      const [selectedWishId, setSelectedWishId] = useState<number | null>(null);
      const [editingWishId, setEditingWishId] = useState<number | null>(null);

      const captureArchiveSelection = (event: ReactMouseEvent<HTMLDivElement>) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const card = target.closest('[data-wish-id]') as HTMLElement | null;
        const value = card?.dataset.wishId;
        if (value) {
          const parsed = Number(value);
          if (Number.isSafeInteger(parsed) && parsed > 0) setSelectedWishId(parsed);
        }

        if (target.closest('.wl-cloud-sheet-close')) setSelectedWishId(null);
      };

      const beginEditing = () => {
        if (!selectedWishId) return;
        document.querySelector<HTMLButtonElement>('.wl-archive-cloud-sheet-close')?.click();
        setEditingWishId(selectedWishId);
        setSelectedWishId(null);
      };

      return (
        <>
          <div className="wl-archive-enhancer" onClickCapture={captureArchiveSelection}>
            <WishArchiveBase {...props} />
          </div>

          {selectedWishId && <ArchiveEditAction onEdit={beginEditing} />}

          {editingWishId && (
            <ArchiveWishEditModal
              wishId={editingWishId}
              ownerId={props.ownerId ?? null}
              shared={props.scope === 'shared'}
              onClose={() => setEditingWishId(null)}
              onPhotoClick={props.onPhotoClick}
            />
          )}
        </>
      );
    }
    ''',
)

write(
    WISHLIST / "ArchiveWishEditModal.tsx",
    r'''
    import { useQuery, useQueryClient } from '@tanstack/react-query';
    import { useCurrentUser } from '@/providers/AuthProvider';
    import { useToast } from '@/providers/ToastProvider';
    import { usePartnerQuery } from '@/features/_shared/useUsers';
    import { WishFormModal } from './WishFormModal';
    import type { WishFormPayload } from './useWishlist';
    import {
      fetchWishlistV3,
      updateWishlistItem,
      type WishlistItemV3,
    } from './wishlistRpc';

    interface ArchiveWishEditModalProps {
      wishId: number;
      ownerId: number | null;
      shared: boolean;
      onClose: () => void;
      onPhotoClick: (src: string) => void;
    }

    export function ArchiveWishEditModal({
      wishId,
      ownerId,
      shared,
      onClose,
      onPhotoClick,
    }: ArchiveWishEditModalProps) {
      const me = useCurrentUser();
      const toast = useToast();
      const queryClient = useQueryClient();
      const { partner } = usePartnerQuery();

      const query = useQuery({
        queryKey: ['wishlist', 'archive-edit', shared ? 'shared' : ownerId, wishId],
        enabled: shared || ownerId !== null,
        queryFn: async (): Promise<WishlistItemV3> => {
          const rows = await fetchWishlistV3({
            ownerId: shared ? null : ownerId,
            shared,
            includeArchived: true,
          });
          const item = rows.find((row) => row.id === wishId && row.fulfilled);
          if (!item) throw new Error('archive_wish_not_found');
          return item;
        },
      });

      if (query.isPending) {
        return (
          <div className="modal-overlay wl-archive-edit-overlay">
            <div className="modal-sheet wl-archive-edit-state" role="status">
              <strong>Відкриваємо виконане бажання…</strong>
              <p>Завантажуємо актуальні дані перед редагуванням.</p>
            </div>
          </div>
        );
      }

      if (query.isError || !query.data) {
        return (
          <div
            className="modal-overlay wl-archive-edit-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
          >
            <div className="modal-sheet wl-archive-edit-state" role="alert">
              <button type="button" className="gift-memory-close" aria-label="Закрити" onClick={onClose}>
                ×
              </button>
              <strong>Не вдалося відкрити бажання</strong>
              <p>Онови архів і спробуй ще раз.</p>
              <button type="button" className="btn-secondary" onClick={() => void query.refetch()}>
                Спробувати ще
              </button>
            </div>
          </div>
        );
      }

      const item = query.data;
      const defaultScope = item.is_shared
        ? 'shared'
        : item.owner === me.id
          ? 'me'
          : 'partner';

      const submit = async (
        id: number | null,
        payload: WishFormPayload,
      ): Promise<void> => {
        if (id !== item.id) throw new Error('archive_wish_id_mismatch');

        try {
          await updateWishlistItem(item.id, item.version, payload);
          await queryClient.invalidateQueries({ queryKey: ['wishlist'] });
          toast.show('Виконане бажання оновлено.');
        } catch (error) {
          const message = (error as Error).message;
          if (message.includes('wish_version_conflict')) {
            await query.refetch();
            toast.show('Партнер щойно змінив це бажання. Ми завантажили актуальну версію.');
          } else if (message.includes('wish_not_editable')) {
            toast.show('Це бажання більше не доступне для редагування.');
          } else {
            toast.show('Не вдалося зберегти виконане бажання. Спробуй ще.');
          }
          throw error;
        }
      };

      return (
        <WishFormModal
          key={`archive-edit-${item.id}-${item.version}`}
          item={item}
          partner={partner ?? null}
          defaultScope={defaultScope}
          onClose={onClose}
          onSubmit={submit}
          onPhotoClick={onPhotoClick}
        />
      );
    }
    ''',
)

write(
    WISHLIST / "WishlistPage.tsx",
    r'''
    import { useEffect, useState } from 'react';
    import { createPortal } from 'react-dom';
    import { Lightbox } from '@/components/ui/Lightbox';
    import { usePartnerQuery } from '@/features/_shared/useUsers';
    import { WishlistPage as WishlistPageBase } from './WishlistPageBase';
    import { WishArchive } from './WishArchive';
    import './wishlistArchiveCollaborative.css';

    function PartnerArchiveLauncher({
      partnerName,
      onOpen,
    }: {
      partnerName: string;
      onOpen: () => void;
    }) {
      const [target, setTarget] = useState<HTMLElement | null>(null);

      useEffect(() => {
        const findTarget = () => {
          const next = document.querySelector<HTMLElement>('.wl-wishlist-controls');
          setTarget((current) => current === next ? current : next);
        };
        findTarget();
        const observer = new MutationObserver(findTarget);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
      }, []);

      if (!target) return null;
      return createPortal(
        <button type="button" className="wl-partner-archive-trigger" onClick={onOpen}>
          <span aria-hidden="true">✓</span>
          Виконані бажання: {partnerName}
        </button>,
        target,
      );
    }

    export function WishlistPage() {
      const { partner } = usePartnerQuery();
      const [partnerArchiveOpen, setPartnerArchiveOpen] = useState(false);
      const [lightbox, setLightbox] = useState<string | null>(null);

      useEffect(() => {
        if (!partnerArchiveOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Escape') setPartnerArchiveOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
          window.removeEventListener('keydown', onKeyDown);
          document.body.style.overflow = previousOverflow;
        };
      }, [partnerArchiveOpen]);

      return (
        <>
          <WishlistPageBase />

          {partner && (
            <PartnerArchiveLauncher
              partnerName={partner.name}
              onOpen={() => setPartnerArchiveOpen(true)}
            />
          )}

          {partnerArchiveOpen && partner && (
            <div
              className="wl-partner-archive-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={`Виконані бажання: ${partner.name}`}
              onClick={(event) => {
                if (event.target === event.currentTarget) setPartnerArchiveOpen(false);
              }}
            >
              <div className="wl-partner-archive-shell" onClick={(event) => event.stopPropagation()}>
                <WishArchive
                  scope="personal"
                  ownerId={partner.id}
                  onPhotoClick={setLightbox}
                  open
                  onOpenChange={(open) => {
                    if (!open) setPartnerArchiveOpen(false);
                  }}
                />
              </div>
            </div>
          )}

          <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
        </>
      );
    }
    ''',
)

write(
    WISHLIST / "wishlistArchiveCollaborative.css",
    r'''
    .wl-archive-enhancer {
      display: contents;
    }

    .wl-archive-edit-completed {
      width: 100%;
      min-height: 46px;
      margin-top: 14px;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      border-radius: 16px;
      background: color-mix(in srgb, var(--card, #fff) 92%, transparent);
      color: inherit;
      font: inherit;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
    }

    .wl-partner-archive-trigger {
      min-height: 40px;
      padding: 8px 13px;
      border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--card, #fff) 90%, transparent);
      color: inherit;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      cursor: pointer;
      white-space: nowrap;
    }

    .wl-partner-archive-overlay {
      position: fixed;
      inset: 0;
      z-index: 1200;
      padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom));
      background: color-mix(in srgb, #111 52%, transparent);
      backdrop-filter: blur(12px);
      display: grid;
      place-items: center;
    }

    .wl-partner-archive-shell {
      width: min(100%, 980px);
      max-height: 100%;
      overflow: auto;
      overscroll-behavior: contain;
      border-radius: 26px;
      background: var(--page-bg, var(--background, #fff8fb));
      box-shadow: 0 24px 80px rgb(0 0 0 / 0.28);
    }

    .wl-partner-archive-shell .wl-archive-wrap--page {
      margin: 0;
      min-height: min(760px, calc(100dvh - 20px));
    }

    .wl-archive-edit-state {
      position: relative;
      width: min(92vw, 440px);
      padding: 30px 24px;
      text-align: center;
      display: grid;
      gap: 12px;
    }

    .wl-archive-edit-state p {
      margin: 0;
      opacity: 0.72;
    }

    @media (max-width: 640px) {
      .wl-partner-archive-overlay {
        padding: 0;
        place-items: stretch;
      }

      .wl-partner-archive-shell {
        width: 100%;
        max-height: 100dvh;
        border-radius: 0;
      }

      .wl-partner-archive-shell .wl-archive-wrap--page {
        min-height: 100dvh;
      }
    }
    ''',
)

write(
    ROOT / "supabase/migrations/20260804_wishlist_collaborative_completed_editing.sql",
    r'''
    -- Both members of a couple may browse each other's completed personal wishes
    -- and collaboratively correct the details of visible or completed wishes.
    begin;

    create or replace function public.get_fulfilled_wishlist_items_v3(p_owner_id integer)
    returns table(
      id bigint,
      title text,
      description text,
      link text,
      image_url text,
      price numeric,
      priority text,
      fulfilled_at timestamptz,
      fulfilled_by integer,
      completion_id bigint,
      completed_at timestamptz,
      reaction_photo_path text,
      reaction_video_path text,
      memory_comment text
    )
    language plpgsql
    stable
    security definer
    set search_path = public, app_private
    as $$
    declare
      v_actor integer := app_private.current_app_user_id();
      v_couple_id bigint := app_private.current_couple_id();
    begin
      if v_actor is null then
        raise exception 'not_authenticated' using errcode = '28000';
      end if;
      if v_couple_id is null then
        raise exception 'couple_membership_required' using errcode = '42501';
      end if;
      if not exists (
        select 1
        from public.couple_members cm
        where cm.couple_id = v_couple_id
          and cm.user_id = p_owner_id
      ) then
        raise exception 'archive_not_allowed' using errcode = '42501';
      end if;

      return query
      select
        wi.id::bigint,
        wi.title,
        wi.description,
        wi.link,
        wi.image_url,
        wi.price,
        wi.priority::text,
        wi.fulfilled_at,
        wi.fulfilled_by,
        wgc.id::bigint,
        wgc.completed_at,
        wgc.reaction_photo,
        wgc.reaction_video,
        wgc.comment
      from public.wishlist_items wi
      left join public.wishlist_gift_completions wgc on wgc.wish_id = wi.id
      where wi.couple_id = v_couple_id
        and wi.owner = p_owner_id
        and not wi.is_shared
        and wi.fulfilled
        and wi.deleted_at is null
      order by coalesce(wgc.completed_at, wi.fulfilled_at) desc nulls last, wi.id desc;
    end;
    $$;

    create or replace function public.update_wishlist_item_collaborative_v3(
      p_wish_id bigint,
      p_expected_version bigint,
      p_title text,
      p_description text default null,
      p_link text default null,
      p_image_url text default null,
      p_price numeric default null,
      p_priority text default null
    )
    returns bigint
    language plpgsql
    security definer
    set search_path = public, app_private
    as $$
    declare
      v_actor integer := app_private.current_app_user_id();
      v_couple_id bigint := app_private.current_couple_id();
      v_new_version bigint;
      v_status public.wishlist_status;
      v_is_shared boolean;
      v_image_url text := nullif(btrim(p_image_url), '');
    begin
      if v_actor is null then
        raise exception 'not_authenticated' using errcode = '28000';
      end if;
      if v_couple_id is null then
        raise exception 'couple_membership_required' using errcode = '42501';
      end if;

      perform app_private.validate_wishlist_payload(
        p_title, p_description, p_link, p_image_url, p_price, p_priority
      );

      update public.wishlist_items wi
      set title = btrim(p_title),
          description = nullif(btrim(p_description), ''),
          link = nullif(btrim(p_link), ''),
          processed_image_url = case
            when wi.image_url is distinct from v_image_url then null
            else wi.processed_image_url
          end,
          image_mode = case
            when wi.image_url is distinct from v_image_url then null
            else wi.image_mode
          end,
          image_url = v_image_url,
          price = p_price,
          priority = p_priority,
          version = wi.version + 1,
          updated_at = now()
      where wi.id = p_wish_id
        and wi.couple_id = v_couple_id
        and wi.status in ('visible', 'gifted', 'archived')
        and wi.deleted_at is null
        and wi.version = p_expected_version
      returning wi.version, wi.status, wi.is_shared
      into v_new_version, v_status, v_is_shared;

      if not found then
        if exists (
          select 1
          from public.wishlist_items wi
          where wi.id = p_wish_id
            and wi.couple_id = v_couple_id
            and wi.status in ('visible', 'gifted', 'archived')
            and wi.deleted_at is null
        ) then
          raise exception 'wish_version_conflict' using errcode = '40001';
        end if;
        raise exception 'wish_not_editable' using errcode = '42501';
      end if;

      insert into public.wishlist_history (
        wish_id,
        actor_id,
        event_type,
        from_status,
        to_status,
        metadata,
        is_private
      ) values (
        p_wish_id,
        v_actor,
        'wish_updated',
        v_status,
        v_status,
        jsonb_build_object(
          'version', v_new_version,
          'shared', v_is_shared,
          'collaborative', true,
          'completed', v_status in ('gifted', 'archived')
        ),
        false
      );

      return v_new_version;
    end;
    $$;

    comment on function public.get_fulfilled_wishlist_items_v3(integer)
      is 'Returns completed personal wishes for either member of the current couple.';

    comment on function public.update_wishlist_item_collaborative_v3(
      bigint, bigint, text, text, text, text, numeric, text
    ) is 'Collaboratively edits visible or completed wishes with optimistic version checks.';

    commit;
    ''',
)

# The bootstrap workflow and this script are deliberately one-shot.
WORKFLOW.unlink(missing_ok=True)
SCRIPT.unlink(missing_ok=True)
