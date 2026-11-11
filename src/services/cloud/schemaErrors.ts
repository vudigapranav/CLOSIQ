/**
 * Detects PostgREST / Postgres errors that mean "this column or function
 * doesn't exist (yet)". The 2026-11-11 wardrobe-intelligence migration may
 * not be applied on every database, so writes retry without the new fields
 * and wear tracking falls back to per-row updates. Pure — shared web/mobile.
 */
type ErrLike = { code?: string; message?: string; details?: string | null } | null | undefined;

export function isMissingColumnError(err: ErrLike): boolean {
  if (!err) return false;
  if (err.code === 'PGRST204' || err.code === '42703') return true;
  const msg = `${err.message || ''} ${err.details || ''}`.toLowerCase();
  return (msg.includes('column') && msg.includes('does not exist')) || (msg.includes('could not find') && msg.includes('column'));
}

export function isMissingFunctionError(err: ErrLike): boolean {
  if (!err) return false;
  if (err.code === 'PGRST202' || err.code === '42883') return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('could not find the function') || (msg.includes('function') && msg.includes('does not exist'));
}

/**
 * Thrown when an edit touches ONLY fields whose columns aren't deployed yet
 * (availability, purchase date, pattern, collections) — nothing could be
 * saved, so the caller must say so instead of showing a change that will
 * vanish on the next load.
 */
export class SchemaNotReadyError extends Error {
  constructor() {
    super('This detail can’t be saved to your account yet — the database update for it hasn’t been applied.');
    this.name = 'SchemaNotReadyError';
  }
}
