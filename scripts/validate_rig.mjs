#!/usr/bin/env node
/**
 * Structural validation of an OpenBone document — headless, no textures, no browser.
 * Fails the command (exit 1) on any issue the runtime would complain about.
 */
import { readFileSync } from "node:fs";
import { validate } from "@openbone/core";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/validate_rig.mjs <file.obone>");
  process.exit(2);
}
const doc = JSON.parse(readFileSync(file, "utf8"));
const issues = validate(doc);
if (!issues.length) {
  const mesh = doc.skeleton?.skins?.[0]?.attachments?.slot_body?.miya_body;
  console.log(`OK ${file}`);
  console.log(`   bones: ${doc.skeleton.bones.length}, slots: ${doc.skeleton.slots.length}`);
  if (mesh) {
    console.log(`   mesh: ${mesh.vertices.length / 2} vertices, ${mesh.triangles.length / 3} triangles, weighted: ${Boolean(mesh.weights)}`);
  }
  console.log(`   animations: ${doc.animations.map((a) => a.name).join(", ")}`);
  process.exit(0);
}
console.error(`INVALID ${file}`);
for (const i of issues.slice(0, 12)) console.error(`   [${i.level ?? i.severity ?? "error"}] ${i.path ?? ""} ${i.message}`);
if (issues.length > 12) console.error(`   … and ${issues.length - 12} more`);
process.exit(1);
