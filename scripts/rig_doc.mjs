// Read a published rig the way the game does.
//
// `public/rigs` ships OpenBone **binary** documents (`.obonb`), which the runtime detects from the
// bytes. The lab still keeps pretty JSON (`.obone`), and a review copy of a document may be either,
// so every node tool goes through here instead of `JSON.parse(readFileSync(...))`.
import { readFileSync } from 'node:fs';
import { parseDocument } from '@openbone/core';

export function readRigDoc(path) {
  const bytes = new Uint8Array(readFileSync(path));
  // '{' = a JSON document, 'O' = the OBNB header. Anything else is not a rig at all.
  if (bytes[0] === 0x7b) return JSON.parse(Buffer.from(bytes).toString('utf8'));
  return parseDocument(bytes);
}

/** `t1_s0` → the document the game loads for it. */
export function readPublishedRig(art, dir = 'public/rigs') {
  return readRigDoc(`${dir}/${art}.obonb`);
}
