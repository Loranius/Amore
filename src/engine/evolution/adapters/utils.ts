import { parseCalendarDate, parseEvolutionInstant } from '../calendar';
import type { EvolutionEventInput, EvolutionPressureVector } from '../types';
import type {
  AdapterDiagnostic,
  EvolutionAdapterContext,
  EvolutionAdapterResult,
  EvolutionAdapterSource,
} from './types';

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

export function dateKeyInTimeZone(value: string, timeZone: string): string | null {
  const date = parseCalendarDate(value, timeZone);
  if (!date) return null;
  const year = String(date.year).padStart(4, '0');
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function withPressure(
  channels: Partial<EvolutionPressureVector>,
): Partial<EvolutionPressureVector> {
  return { ...channels };
}

export function compareAdapterDiagnostics(left: AdapterDiagnostic, right: AdapterDiagnostic): number {
  return left.source.localeCompare(right.source)
    || left.recordId.localeCompare(right.recordId)
    || left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message);
}

export function compareEvolutionInputs(left: EvolutionEventInput, right: EvolutionEventInput): number {
  return left.occurredAt.localeCompare(right.occurredAt)
    || left.source.localeCompare(right.source)
    || left.id.localeCompare(right.id);
}

export function mergeAdapterResults(results: readonly EvolutionAdapterResult[]): EvolutionAdapterResult {
  return {
    events: results.flatMap((result) => result.events).sort(compareEvolutionInputs),
    diagnostics: results
      .flatMap((result) => result.diagnostics)
      .sort(compareAdapterDiagnostics),
  };
}
