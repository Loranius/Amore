import { parseEvolutionInstant } from '../calendar';
import type { EvolutionEventInput, EvolutionPressureVector } from '../types';
import type {
  AdapterDiagnostic,
  EvolutionAdapterContext,
  EvolutionAdapterResult,
  EvolutionAdapterSource,
} from './types';
import { byCodePoint, byNormalizedText } from '../../ordering';

export function emptyAdapterResult(): EvolutionAdapterResult {
  return { events: [], diagnostics: [] };
}

export function diagnostic(
  source: EvolutionAdapterSource | 'snapshot',
  code: AdapterDiagnostic['code'],
  recordId: string | number,
  message: string,
): AdapterDiagnostic {
  return { source, code, recordId: String(recordId), message };
}

export function validateAdapterContext(context: EvolutionAdapterContext): number {
  const asOfEpoch = parseEvolutionInstant(context.asOf);
  if (asOfEpoch === null) throw new Error(`Invalid adapter asOf: "${context.asOf}".`);
  return asOfEpoch;
}

export function eventOccursBy(
  occurredAt: string,
  asOfEpoch: number,
): boolean | null {
  const epoch = parseEvolutionInstant(occurredAt);
  return epoch === null ? null : epoch <= asOfEpoch;
}

export function withPressure(
  channels: Partial<EvolutionPressureVector>,
): Partial<EvolutionPressureVector> {
  return { ...channels };
}

function compareAdapterDiagnostics(left: AdapterDiagnostic, right: AdapterDiagnostic): number {
  return byCodePoint(left.source, right.source)
    || byCodePoint(left.recordId, right.recordId)
    || byCodePoint(left.code, right.code)
    /*
     * ПОВІДОМЛЕННЯ — ЛЮДСЬКИЙ ТЕКСТ, а не ключ: діагностика пишеться
     * українською й приходить із чужих адаптерів. Решта трьох полів —
     * ідентифікатори, які склав сам портал, тож їм вистачає кодових точок.
     */
    || byNormalizedText(left.message, right.message);
}

function compareEvolutionInputs(left: EvolutionEventInput, right: EvolutionEventInput): number {
  return byCodePoint(left.occurredAt, right.occurredAt)
    || byCodePoint(left.source, right.source)
    || byCodePoint(left.id, right.id);
}

export function mergeAdapterResults(results: readonly EvolutionAdapterResult[]): EvolutionAdapterResult {
  return {
    events: results.flatMap((result) => result.events).sort(compareEvolutionInputs),
    diagnostics: results
      .flatMap((result) => result.diagnostics)
      .sort(compareAdapterDiagnostics),
  };
}
