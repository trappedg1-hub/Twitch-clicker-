import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { readPngDims, readWebpDims } from './helpers/plateGeometry.ts';

import {
  DAY4_FAREWELL_LINES,
  DAY5_FAREWELL_LINES,
  DAY5_OPENING_LINE,
  DAY5_TAP_LINES,
  pickIdleTeaseLine,
  pickStageTapLine,
  getStreamTitle,
} from '../src/domain/dialogue.ts';
import { createInitialState, isDay4FinaleReached, startDay5 } from '../src/domain/engine.ts';
import { STREAM_CHALLENGES, getStoryChapter } from '../src/domain/progression.ts';
import {
  AMBIENT_DAY5,
  AMBIENT_DAY5_BY_STAGE,
  DONATION_TTS_LINES_DAY5,
  VIRAL_CLIP_TITLES_DAY5,
  ZONE_CHAT_REACTIONS_DAY5,
} from '../src/chat/chatEngine.ts';
import {
  dayFinaleSubs,
  DAY5_FINALE_SUBS,
  DAY5_FLASH_PLATE,
  getGiftSubUnitCost,
  getShortStepLabelsForDay,
  getStepLabelsForDay,
  getSubGoalStageForSubs,
  getSubGoalStagesForDay,
  isDay5Unlocked,
} from '../src/domain/subGoals.ts';
import type { SubGoalStageIndex, TapZoneId } from '../src/domain/types.ts';
import { contradictsWardrobe, getWardrobe, WARDROBE_SAFE_LINES } from '../src/domain/wardrobe.ts';

/**
 * Day 5 = «5 бикини стрим». Four rules hold this day together, and each one is a rule the art director
 * actually gave: the ladder is made of HIS approved frames, the sub-goals step by exactly 7000, the
 * micro bikini is the entire costume for every stage (so heat moves into the pose and the camera, never
 * into a removal), and her voice is the opposite of the Day-1 blush — she wants more subs and donations
 * and says so while the chat pushes her further.
 *
 * A fifth rule is structural and belongs to the game, not to the art: these plates are composed for the
 * stream camera. `public/art/heroine_t5_s*` are cut so the head sits on row 88 and the chair base ends
 * behind the foreground desk plank (plate row 1489), which is what `scripts/process_day5_frames.py` and
 * `scripts/day5_plate_proof.py` measure. The geometry test below is the last line of defence for that.
 */

const ZONES: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];
const PLATE_DIR = fileURLToPath(new URL('../public/art/', import.meta.url));

test('Day 5 bikini ladder: one micro bikini, four poses, +7000 per step, on its own plates', () => {
  const stages = getSubGoalStagesForDay(5);
  assert.equal(stages.length, 4, 'the bikini day is four approved frames, no more');
  const targets = stages.map((s) => s.subsRequired);
  assert.deepEqual(targets, [0, 33000, 40000, 47000]);
  // His dial: «продолжай градацию на увеличение по 7000 сабов» — the paid steps are exactly 7000 apart.
  for (let i = 2; i < targets.length; i++) {
    assert.equal(targets[i]! - targets[i - 1]!, 7000, `step ${i} is not a 7000 stride`);
  }

  // Heat climbs through income, viewers and boldness, because the outfit is constant.
  const mults = stages.map((s) => s.incomeMultiplier);
  for (let i = 1; i < mults.length; i++) assert.ok(mults[i]! > mults[i - 1]!, 'income must rise');
  const viewers = stages.map((s) => s.viewersBonus);
  for (let i = 1; i < viewers.length; i++) assert.ok(viewers[i]! > viewers[i - 1]!, 'viewers must rise');
  // She is past shy on this day: no stage opens flustered or shy.
  assert.equal(stages.map((s) => s.unlockEmotion).join(','), 'tease,bold,bold,bold');
  for (const s of stages) assert.match(s.plateUrl, /^\/art\/heroine_t5_s[0-3]\.webp$/);

  assert.equal(getSubGoalStageForSubs(32999, 5), 0);
  assert.equal(getSubGoalStageForSubs(33000, 5), 1);
  assert.equal(getSubGoalStageForSubs(39999, 5), 1);
  assert.equal(getSubGoalStageForSubs(40000, 5), 2);
  assert.equal(getSubGoalStageForSubs(47000, 5), 3);
  assert.equal(dayFinaleSubs(5), DAY5_FINALE_SUBS);
  assert.equal(getStepLabelsForDay(5).length, 3);
  assert.equal(getShortStepLabelsForDay(5)[2], '47000');

  // The title ladder follows the day, and never leaks another day's numbers into the stream banner.
  assert.match(getStreamTitle(0, 100, 5), /БИКИНИ СТРИМ.*33000$/s);
  assert.match(getStreamTitle(3, 44000, 5), /47000 — финал дня/);
  assert.match(getStreamTitle(4, 47000, 5), /ФИНАЛ ДНЯ 5/);
  for (const st of [0, 1, 2, 3, 4]) {
    assert.doesNotMatch(
      getStreamTitle(st as SubGoalStageIndex, 100, 5),
      /26000|18000|15000 саб|5000 саб|косплей|йога/,
      `day 5 title ${st} recites another day`,
    );
  }
});

test('Day 5 has no flash plate, and nothing fakes one to satisfy a gate', () => {
  // Days 3 and 4 each own a «Бу!»/«Готово?» reveal frame. Day 5's reveal is the ladder itself, and we
  // ship only approved art, so the day must openly have NO flash file rather than a placeholder that a
  // plate-existence probe would then force us to draw without a grade.
  assert.equal(DAY5_FLASH_PLATE, null);
  assert.ok(!existsSync(`${PLATE_DIR}heroine_t5_flash.webp`), 'a Day-5 flash plate would be unapproved art');
  // The gate therefore reads exactly four files; if a fifth ever appears, this test is where we notice
  // that `probeDay5Art` and the ladder no longer agree.
  assert.equal(getSubGoalStagesForDay(5).filter((s) => s.plateUrl.includes('heroine_t5_s')).length, 4);
});

test('the bikini price curve keeps climbing past the yoga finale', () => {
  assert.ok(getGiftSubUnitCost(25999) < getGiftSubUnitCost(26000));
  assert.ok(getGiftSubUnitCost(32999) < getGiftSubUnitCost(33000));
  assert.ok(getGiftSubUnitCost(39999) < getGiftSubUnitCost(40000));
  assert.ok(getGiftSubUnitCost(46999) < getGiftSubUnitCost(47000));
  assert.ok(getGiftSubUnitCost(47000) > getGiftSubUnitCost(33000), 'the top of the day must cost more');
});

test('Day 5 wardrobe: the micro bikini is the whole costume, bare legs, heeled feet, nothing comes off', () => {
  for (let stage = 0; stage <= 4; stage++) {
    const w = getWardrobe(5, stage);
    assert.equal(w.day, 5);
    assert.equal(w.top, 'bikini', 'a micro bikini is the entire outfit on every frame');
    assert.equal(w.hoodie, 'off', 'there is nothing over it');
    assert.equal(w.leggings, false, 'bare legs — his standing rule for this costume');
    assert.equal(w.socks, 'gone', 'no legwear of any kind on a bikini frame');
    assert.ok(w.midriff, 'the two panels leave her torso open in every frame');
    assert.ok(w.bikiniKit, 'the day-5 guard switches on only for day 5');

    // Claims the plates contradict: legwear, bare feet, a panel that moved.
    assert.ok(contradictsWardrobe('Чулки на месте, чат, не просите', w), 'there are no stockings');
    assert.ok(contradictsWardrobe('Гольфы натянуты до колена', w), 'there are no knee-highs');
    assert.ok(contradictsWardrobe('Я стою босиком у кресла', w), 'she is in the clear vinyl heels');
    assert.ok(contradictsWardrobe('Сетка бежит по бедру', w), 'no fishnets on this day');
    assert.ok(contradictsWardrobe('Я стянула лиф и осталась в белье', w), 'nothing leaves her body');
    assert.ok(contradictsWardrobe('Бретелька соскользнула с плеча', w), 'the shoulder ties are tied');
    // The one legitimate "носок" is the toe of a shoe — that IS on the plate at the finale.
    assert.equal(
      contradictsWardrobe('Одна шпилька висит на носке, держась на ремешке', w),
      null,
      'the toe of a heel is not a sock',
    );

    // Her own true sentences must pass, including the negations the day is built on.
    assert.equal(contradictsWardrobe('Снимать нечего, чат, поэтому двигаем позу', w), null);
    assert.equal(contradictsWardrobe('Ни одной детали не сдвинулось за весь эфир', w), null);
    assert.equal(contradictsWardrobe('Узелки затянуты, неон натянут', w), null);
    assert.equal(contradictsWardrobe('На ногах только прозрачные шпильки, ничего больше', w), null);

    for (const line of WARDROBE_SAFE_LINES[5][stage as SubGoalStageIndex]!) {
      assert.equal(contradictsWardrobe(line, w), null, `safe s${stage}: ${line}`);
    }
    for (const zone of ZONES) {
      for (let seed = 0; seed < 80; seed++) {
        const line = pickStageTapLine(zone, seed, stage as SubGoalStageIndex, 5);
        assert.equal(contradictsWardrobe(line, w, zone), null, `s${stage} ${zone}#${seed}: ${line}`);
      }
      for (let seed = 0; seed < 40; seed++) {
        const idle = pickIdleTeaseLine(stage as SubGoalStageIndex, seed, 5);
        assert.equal(contradictsWardrobe(idle, w), null, `s${stage} idle#${seed}: ${idle}`);
      }
    }
  }
});

/**
 * The plate gate reads the SHIPPED webp: 1024x1526 with an alpha layer (a plate that lost its keying is
 * exactly the "plum matte floating over the bedroom" bug), and the local master is RGBA when present.
 * `public/art/*.png` is gitignored, so the PNG half quietly steps aside in a fresh clone.
 */
test('the four bikini plates shipped on the canonical 1024x1526 keyed box', () => {
  for (const name of ['s0', 's1', 's2', 's3']) {
    const webp = `${PLATE_DIR}heroine_t5_${name}.webp`;
    assert.ok(existsSync(webp), `${webp} is missing — the game loads the webp plate, not the master`);
    const plate = readWebpDims(readFileSync(webp));
    assert.ok(plate, `${name}: unreadable webp container`);
    assert.equal(plate.width, 1024, `${name}: plate width must match the stage box`);
    assert.equal(plate.height, 1526, `${name}: plate height must match the stage box`);
    assert.equal(plate.alpha, true, `${name}: the plate has no alpha layer, so the plum matte will show`);
    assert.ok(readFileSync(webp).byteLength > 40_000, `${name}: webp plate looks empty`);

    const png = `${PLATE_DIR}heroine_t5_${name}.png`;
    if (existsSync(png)) {
      const master = readPngDims(readFileSync(png));
      assert.equal(master?.width, 1024, `${name}: master width drifted from the shipped plate`);
      assert.equal(master?.height, 1526, `${name}: master height drifted from the shipped plate`);
      assert.equal(master?.colorType, 6, `${name}: master must be RGBA (colour type 6)`);
    }
  }
});

test('Day 5 is gated: no bikini plates in the build means no bikini day, and only Day 4 opens it', () => {
  // Node has no window, so the HEAD probe of heroine_t5_* cannot run from a test.
  assert.equal(isDay5Unlocked(), false);
  const day1 = createInitialState(1000);
  assert.equal(startDay5(day1).ok, false, 'Day 5 cannot start on Day 1');
  const day4Done = { ...day1, streamDay: 4, subscribers: DAY5_FINALE_SUBS };
  assert.equal(isDay4FinaleReached(day4Done), true, 'the bikini day opens the moment the yoga ladder is paid');
  assert.equal(startDay5(day4Done).ok, false, 'locked while the heroine_t5_* probe cannot run in node');
});

test('her Day 5 voice is a seller, not a blusher: prices out loud, zero shame loops', () => {
  const stages = getSubGoalStagesForDay(5);
  const lines = [
    DAY5_OPENING_LINE,
    ...DAY5_FAREWELL_LINES,
    ...Object.values(DAY5_TAP_LINES).flatMap((pool) => pool ?? []),
    ...stages.flatMap((s) => [s.unlockLine, s.storyDesc, ...s.shyApproachLines]),
  ];
  // She is the one naming the price now, so the day has to talk money more than it talks nerves.
  let priceTalk = 0;
  for (const line of lines) {
    if (/саб|донат|подписк|цен|прайс|торгу|платит|набивает|легон|легион/i.test(line)) priceTalk++;
    // The Day-1 reflex must not reappear on this day: no pleading to be left alone.
    assert.ok(
      !/не снимите с меня|пожалейте|я не могу так|уберите глаза|спрячусь/i.test(line),
      `she is shy again: ${line.slice(0, 80)}`,
    );
  }
  assert.ok(priceTalk >= 10, `the bikini day barely talks about the deal (${priceTalk} price lines)`);
  assert.match(DAY5_OPENING_LINE, /бикини|нечего/i, 'the opening must name what the day is');
  assert.ok(DAY5_FAREWELL_LINES.length >= 5, 'the day needs a real goodbye');
  // Day 4's goodbye is what advertises this day; if it stops mentioning it, the player arrives blind.
  assert.match(DAY4_FAREWELL_LINES.join(' '), /купальник|бикини/i, 'the yoga farewell must announce the bikini stream');
  // The story panel follows the day instead of reciting Day 1.
  assert.match(getStoryChapter(0, 5).badgeTitle, /^День 5/);
  assert.notEqual(getStoryChapter(90, 5).diaryThought, getStoryChapter(90, 4).diaryThought);
});

test('the Day 5 chat begs for a closer angle, never for fewer clothes', () => {
  const STRIP_BEG =
    /(раздевай|раздень|снимай|скинь|скидывай|покажи без|голые ступн|голые пальц|голые ножк|босиком|босые|останься в|topless|без лифа)/i;
  const NEGA =
    /(ни одного|ни одной|ни единой|ни одна|ничего не|не снят|не надо|не нужно|не просим|не ждём|нечего|ноль снят)/i;
  const pools: [string, readonly string[]][] = [
    ['ambient day5', AMBIENT_DAY5],
    ['tts day5', DONATION_TTS_LINES_DAY5],
    ...Object.entries(AMBIENT_DAY5_BY_STAGE).flatMap(([st, pool]) =>
      pool.map((_, i) => [`ambient s${st}[${i}]`, [pool[i]!]] as [string, readonly string[]]),
    ),
    ...Object.entries(ZONE_CHAT_REACTIONS_DAY5).map(
      ([z, pool]) => [`burst ${z}`, pool] as [string, readonly string[]],
    ),
    ...Object.entries(VIRAL_CLIP_TITLES_DAY5).map(
      ([z, pool]) => [`clip ${z}`, pool] as [string, readonly string[]],
    ),
    ...getSubGoalStagesForDay(5).map(
      (st) => [`ladder s${st.stage}`, st.chatCascade.map((c) => c.text)] as [string, readonly string[]],
    ),
    ['her own day5 lines', [...Object.values(DAY5_TAP_LINES).flat(), DAY5_OPENING_LINE]],
  ];

  let angleTalk = 0;
  for (const [where, pool] of pools) {
    for (const line of pool) {
      assert.ok(
        !STRIP_BEG.test(line) || NEGA.test(line),
        `${where} asks her to undress: ${line.slice(0, 90)}`,
      );
      // His framing rule, tested from the viewers' side: the chat wants the pose and the near frame.
      if (/ракурс|ближе|кадр|поз|ступн|носк|нога|бедр|спин|кресл|разворот|линз|камер/i.test(line)) angleTalk++;
    }
  }
  assert.ok(angleTalk >= 25, `the bikini day barely talks about the frame (${angleTalk} angle lines)`);

  // And the shop's day-5 variants must not promise a strip either — there is nothing to strip.
  for (const ch of STREAM_CHALLENGES) {
    assert.ok(ch.reactionLineDay5, `${ch.id} speaks Day-1 strip talk on the bikini day`);
    assert.ok(ch.chatBurstDay5, `${ch.id} sends the Day-1 chat burst on the bikini day`);
    assert.ok(!STRIP_BEG.test(ch.reactionLineDay5!), `${ch.id} day-5 line undresses her`);
    assert.ok(!STRIP_BEG.test(ch.chatBurstDay5!), `${ch.id} day-5 chat burst undresses her`);
  }
});
