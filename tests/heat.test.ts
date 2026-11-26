import assert from "node:assert/strict";
import test from "node:test";

import {
  DAY1_DARES,
  HEAT_MAX,
  advanceHeat,
  createHeatState,
  currentPressure,
  pickDare,
  resolveDare,
} from "../src/domain/heat.ts";

test("a fresh heat state is idle with no pressure banked", () => {
  const s = createHeatState();
  assert.equal(s.phase, "idle");
  assert.equal(s.activeDareId, null);
  assert.equal(s.heat, 0);
  assert.equal(currentPressure(s), 0);
});

test("heat cools down while nothing happens", () => {
  const hot = { ...createHeatState(), heat: 40 };
  const { state } = advanceHeat(hot, { day: 1, stage: 0, votes: 0, donations: 0, dtSec: 20 });
  assert.ok(state.heat < 40, `expected decay, got ${state.heat}`);
  assert.ok(state.heat >= 0);
});

test("heat never drops below zero or above the cap", () => {
  const cold = advanceHeat({ ...createHeatState(), heat: 1 }, {
    day: 1, stage: 0, votes: 0, donations: 0, dtSec: 600,
  }).state;
  assert.equal(cold.heat, 0);

  const hot = advanceHeat({ ...createHeatState(), heat: HEAT_MAX }, {
    day: 1, stage: 4, votes: 999, donations: 9999, dtSec: 0,
  }).state;
  assert.equal(hot.heat, HEAT_MAX);
});

test("a dare only opens once the vote gate is actually crossed", () => {
  const quiet = advanceHeat(createHeatState(), {
    day: 1, stage: 0, votes: 1, donations: 0, dtSec: 1,
  });
  assert.equal(quiet.opened, null, "one vote must not open the first dare");

  const loud = advanceHeat(createHeatState(), {
    day: 1, stage: 0, votes: 3, donations: 0, dtSec: 1,
  });
  assert.ok(loud.opened, "three votes must open d1_lean_in");
  assert.equal(loud.opened!.id, "d1_lean_in");
  assert.equal(loud.state.phase, "proposed");
});

test("pickDare never offers a dare the outfit cannot honestly show", () => {
  // d1_stretch needs stage 2, d1_cross_legs needs stage 3: at stage 0 only the first dare qualifies.
  const stage0 = pickDare(1, 0, 999, []);
  assert.equal(stage0!.id, "d1_show_socks", "at stage 0 the highest already-voted dare wins");
  assert.ok(!DAY1_DARES.some((d) => d.id === "d1_stretch" && d.requiresStage <= 0));

  const stage3 = pickDare(1, 3, 999, []);
  assert.equal(stage3!.id, "d1_name_price", "the highest unlocked dare wins at max votes");
});

test("a dare is never re-offered once it has been served", () => {
  const served = DAY1_DARES.slice(0, 3).map((d) => d.id);
  const next = pickDare(1, 4, 999, served);
  assert.ok(next);
  assert.ok(!served.includes(next!.id));
});

test("dare ids are unique and every dare declares a positive resist", () => {
  const ids = new Set(DAY1_DARES.map((d) => d.id));
  assert.equal(ids.size, DAY1_DARES.length);
  for (const d of DAY1_DARES) {
    assert.ok(d.resist > 0, `${d.id}: resist must be positive`);
    assert.ok(d.voteGate > 0, `${d.id}: voteGate must be positive`);
    assert.ok(d.refusePressure > 0, `${d.id}: a refusal must still move the loop`);
    assert.ok(d.complyLine.length > 0 && d.refuseLine.length > 0);
  }
});

test("enough boldness plus pressure makes her comply and pays the dare out once", () => {
  const opened = advanceHeat(createHeatState(), {
    day: 1, stage: 0, votes: 3, donations: 0, dtSec: 0,
  }).state;

  const done = resolveDare(opened, { boldness: 60 });
  assert.equal(done.outcome, "comply");
  assert.equal(done.payout.hype, 8 - 2, "the lean-in dare pays 6 hype");
  assert.ok(done.state.served.includes("d1_lean_in"));
  assert.equal(done.state.phase, "idle");

  const again = resolveDare(done.state, { boldness: 60 });
  assert.equal(again.dare, null, "a resolved dare cannot pay twice");
  assert.equal(again.payout.hype, 0);
});

test("too little boldness means a refusal, which raises pressure instead of paying out", () => {
  const opened = advanceHeat(createHeatState(), {
    day: 1, stage: 0, votes: 3, donations: 0, dtSec: 0,
  }).state;
  const before = opened.heat;
  assert.equal(currentPressure(opened), 0, "opening the dare spends the gate, so pressure restarts at zero");

  const refused = resolveDare(opened, { boldness: 0 });
  assert.equal(refused.outcome, "refuse");
  assert.ok(!refused.state.served.includes("d1_lean_in"), "a refusal must not burn the dare");
  assert.ok(refused.state.heat > before, "a refusal must leave the room hotter");
  assert.equal(refused.payout.hype, 2, "a refusal is content, but a small one");
  assert.ok(refused.line.length > 0);
});

test("donations are pressure just like votes", () => {
  const voted = { ...createHeatState(), votes: 0, donations: 0 };
  const donated = { ...createHeatState(), votes: 0, donations: 20 };
  assert.ok(currentPressure(donated) > currentPressure(voted));
  assert.ok(currentPressure(donated) > 0);
});

test("resolving without an open dare is a safe no-op", () => {
  const idle = createHeatState();
  const res = resolveDare(idle, { boldness: 100 });
  assert.equal(res.dare, null);
  assert.equal(res.payout.hype, 0);
  assert.equal(res.state, idle, "state must be returned untouched");
});
