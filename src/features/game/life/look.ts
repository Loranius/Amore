// ============================================================
// Як виглядає Лєна сьогодні (ADR-0239): вік — від тижня життя, одяг —
// з шафи. Куплене в крамниці одразу видно і в місті, і в міні-іграх.
// ============================================================
import { itemById } from './sim/content';
import { today, type LifeState } from './sim/life';
import { LENA_ADULT, LENA_KID, LENA_TEEN, type Look } from './render/people';

/** До 6 класу Лєна — дитина (менший спрайт). */
export const KID_UNTIL_WEEK = 6;

export function lenaLook(state: LifeState): Look {
  const week = today(state).week;
  const base = week <= KID_UNTIL_WEEK ? LENA_KID : week < 12 ? LENA_TEEN : LENA_ADULT;
  if (!state.outfit) return base;
  const outfit = itemById(state.outfit).outfit;
  if (!outfit) return base;
  const { accent: _ownAccent, ...rest } = base;
  return {
    ...rest,
    top: outfit.top,
    bottom: outfit.bottom,
    dress: outfit.dress ?? false,
    ...(outfit.accent ? { accent: outfit.accent } : {}),
  };
}
