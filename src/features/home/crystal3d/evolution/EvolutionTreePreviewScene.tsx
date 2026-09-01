// ============================================================
// EvolutionTreePreviewScene — дерево у власному світі.
// ------------------------------------------------------------
// Production-дерево й далі приходить з того самого Evolution/tree pipeline:
// ті самі персоналізовані гілки, корені, листя, матеріали, сезонність і вітер.
// Змінюється лише renderer environment. Храм кристала сюди більше не
// монтується: дерево має власний пагорб, денне небо та сонячне освітлення.
// ============================================================
import { useMemo } from 'react';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { resolveTreeLabLod } from '../treeLab/featureFlag';
import { useTreeLabPortalPreview } from '../treeLab/useTreeLabPortalPreview';
import { TreeInWorld } from './TreeInWorld';


export default function EvolutionTreePreviewScene({ theme = 'dark' }: { theme?: 'light' | 'dark' }) {
  const lod = useMemo(
    () => resolveTreeLabLod(typeof window === 'undefined' ? '' : window.location.search),
    [],
  );
  const { preview, isPending, error } = useTreeLabPortalPreview(lod);

  if (isPending) return <CrystalPlaceholder />;
  if (error || !preview) return <CrystalPlaceholder />;
  return <TreeInWorld build={preview.build} theme={theme} />;
}
