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
