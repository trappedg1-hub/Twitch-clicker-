/**
 * Two failures that look alike in a catch block and must be treated differently.
 *
 * `show(art)` asks `/rigs/<art>.obonb` for a document. Most plates have one; the four `skip` plates
 * and every art that never got a rig do not, and that is normal — the flat plate is the intended
 * picture there. But a missing document throws the same way a corrupt one does, and the old code
 * sent both through `fail()`, which is a one-way door: the first `skip` plate on day 3 (the scare
 * frame) turned the heroine flat for the rest of the run, and the stage remembered it in
 * localStorage, so the next session started flat too.
 *
 * The message is all we get to tell them apart, so this is a deliberate whitelist: an error that
 * says "there is no document here" is a gap, anything else is a document that exists and would not
 * build. A gap is remembered per art; only a real fault is worth a console line.
 */
export function isMissingDocumentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /404|not found|unexpected token|doctype|failed to fetch|networkerror|load failed/i.test(message);
}
