// ============================================================
// EvolutionTreePreviewScene — дерево у власному світі.
// ------------------------------------------------------------
// Production-дерево й далі приходить з того самого Evolution/tree pipeline:
// ті самі персоналізовані гілки, корені, листя, матеріали, сезонність і вітер.
// Змінюється лише renderer environment. Храм кристала сюди більше не
// монтується: дерево має власний пагорб, денне небо та сонячне освітлення.
// ============================================================
import { useEffect, useMemo } from 'react';
import { useWorldGrowthReporter } from '@/features/world/growthChannel';
import { useGrowthSinceLastVisit } from '@/features/home/useGrowthSinceLastVisit';
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

  /*
   * ПРИРІСТ — ТЕПЕР І В ДЕРЕВА (ADR-0189).
   *
   * Дерево лишалось останнім видом, над яким пара не бачила жодної
   * відповіді на питання «чи змінилось наше життя з минулого разу», хоча
   * канал давно стояв готовий. Події тут уже зібрані — конвеєр будує з
   * них саму крону — і просто викидались.
   *
   * ГАКИ СТОЯТЬ ДО РАННІХ ВИХОДІВ: нижче два `return`, і гак під ними на
   * частині рендерів не викликався б зовсім. На екрані це виглядає не як
   * помилка, а як «дерево сьогодні чомусь простіше».
   */
  const growth = useGrowthSinceLastVisit(preview?.growthEvents ?? null, 'tree');
  const reportGrowth = useWorldGrowthReporter();
  useEffect(() => {
    reportGrowth(growth === null ? null : { species: 'tree', summary: growth });
    // Знімаємо за собою: перемикання виду не має лишати чужий підпис.
    return () => reportGrowth(null);
  }, [growth, reportGrowth]);

  if (isPending) return <CrystalPlaceholder />;
  if (error || !preview) return <CrystalPlaceholder />;
  return <TreeInWorld build={preview.build} theme={theme} />;
}
