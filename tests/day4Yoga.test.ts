import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { readPngDims, readWebpDims } from './helpers/plateGeometry.ts';

import {
  DAY4_DONE_LINES,
  DAY4_FAREWELL_LINES,
  DAY4_OPENING_LINE,
  DAY3_FAREWELL_LINES,
  pickIdleTeaseLine,
  pickStageTapLine,
} from '../src/domain/dialogue.ts';
import { createInitialState, isDay3FinaleReached, startDay4 } from '../src/domain/engine.ts';
import { DAY4_TAP_LINES, getStreamTitle } from '../src/domain/dialogue.ts';
import { STREAM_CHALLENGES, getStoryChapter } from '../src/domain/progression.ts';
import {
  AMBIENT_DAY4,
  AMBIENT_DAY4_BY_STAGE,
  DONATION_TTS_LINES_DAY4,
  VIRAL_CLIP_TITLES_DAY4,
  ZONE_CHAT_REACTIONS_DAY4,
} from '../src/chat/chatEngine.ts';
import {
  dayFinaleSubs,
  DAY4_FLASH_PLATE,
  DAY4_FINALE_SUBS,
  getGiftSubUnitCost,
  getShortStepLabelsForDay,
  getStepLabelsForDay,
  getSubGoalStageForSubs,
  getSubGoalStagesForDay,
  isDay4Unlocked,
} from '../src/domain/subGoals.ts';
import type { SubGoalStageIndex, TapZoneId } from '../src/domain/types.ts';
import { contradictsWardrobe, getWardrobe, WARDROBE_SAFE_LINES } from '../src/domain/wardrobe.ts';

/**
 * Day 4 = «Растяжка с Мией». The rules this file defends are the ones that make the day read as ONE
 * costume: nothing is taken off, so the ladder escalates the POSE only. That makes the copy guard the
 * whole test — a single line about "removed" clothing would promise a plate that will never be drawn.
 */

const ZONES: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];
const PLATE_DIR = fileURLToPath(new URL('../public/art/', import.meta.url));

test('Day 4 yoga ladder: one knit kit, four poses, 18000 / 22000 / 26000 on its own plates', () => {
  const stages = getSubGoalStagesForDay(4);
  assert.equal(stages.length, 4, 'the yoga day is four approved frames, no more');
  assert.deepEqual(
    stages.map((s) => s.subsRequired),
    [0, 18000, 22000, 26000],
  );

  // Heat still climbs — but through income and viewers, because the outfit is constant.
  const mults = stages.map((s) => s.incomeMultiplier);
  for (let i = 1; i < mults.length; i++) assert.ok(mults[i]! > mults[i - 1]!, 'income must rise');
  const viewers = stages.map((s) => s.viewersBonus);
  for (let i = 1; i < viewers.length; i++) assert.ok(viewers[i]! > viewers[i - 1]!, 'viewers must rise');
  // She performs on this day: no stage is allowed to open shy or flustered.
  assert.equal(
    stages.map((s) => s.unlockEmotion).join(','),
    'tease,tease,bold,bold',
  );
  for (const s of stages) assert.match(s.plateUrl, /^\/art\/heroine_t4_s[0-3]\.webp$/);

  // One costume for the whole day: no stage may name a garment from another day's wardrobe.
  for (const s of stages) {
    const texts = [
      s.shortGoalTitle,
      s.outfitName,
      s.storyDesc,
      s.removedItemLabel,
      s.unlockLine ?? '',
      ...s.shyApproachLines,
      ...s.chatCascade.map((c) => c.text),
    ];
    for (const text of texts) {
      const t = text.toLowerCase();
      for (const word of [
        'худи',
        'гольф',
        'простын',
        'сетк',
        'чулк',
        'боди',
        'легинс',
        'бралет',
        'бюстг',
        'юбк',
        'платье',
        'носочк с',
      ]) {
        assert.ok(!t.includes(word), `day 4 ladder copy mentions "${word}": ${text.slice(0, 80)}`);
      }
      // Nothing is removed, so no title or label may claim a removal happened either.
      assert.ok(!/снято|снят!|улетел!|снять шорты|шорты снят/i.test(text), `claims a removal: ${text}`);
    }
    // Every stage has to name what she is wearing (or say plainly that it is the same kit).
    assert.match(s.outfitName, /топ|шорт|комплект|костюм|тот же/i, 'every stage must name the kit it is wearing');
  }

  assert.equal(getSubGoalStageForSubs(17999, 4), 0);
  assert.equal(getSubGoalStageForSubs(18000, 4), 1);
  assert.equal(getSubGoalStageForSubs(25999, 4), 2);
  assert.equal(getSubGoalStageForSubs(26000, 4), 3);
  assert.equal(dayFinaleSubs(4), DAY4_FINALE_SUBS);
  assert.equal(getStepLabelsForDay(4).length, 3);
  assert.equal(getShortStepLabelsForDay(4)[2], '26000');
  assert.equal(DAY4_FLASH_PLATE, '/art/heroine_t4_flash.webp');
  // The title ladder must never show another day's numbers on the yoga day, and the finale card is the
  // stage-4 title (stage 3 is the "keep going" card that still counts up to 26000).
  assert.match(getStreamTitle(0, 100, 4), /РАСТЯЖКА С МИЕЙ.*18000$/s);
  assert.match(getStreamTitle(3, 24000, 4), /26000 — добьёте\?/);
  assert.match(getStreamTitle(4, 26000, 4), /ФИНАЛ ДНЯ 4/);
  for (const st of [0, 1, 2, 3, 4]) {
    assert.doesNotMatch(getStreamTitle(st as SubGoalStageIndex, 100, 4), /15000|5000 саб|косплей/);
  }
});

test('the yoga sub price curve keeps climbing past the ghost ladder', () => {
  assert.ok(getGiftSubUnitCost(15000) < getGiftSubUnitCost(18000));
  assert.ok(getGiftSubUnitCost(17999) < getGiftSubUnitCost(18000));
  assert.ok(getGiftSubUnitCost(21999) < getGiftSubUnitCost(22000));
  assert.ok(getGiftSubUnitCost(25999) < getGiftSubUnitCost(26000));
});

test('Day 4 wardrobe: the kit is strapless, socked and permanent, and the guard says so', () => {
  for (let stage = 0; stage <= 4; stage++) {
    const w = getWardrobe(4, stage);
    assert.equal(w.day, 4);
    assert.equal(w.top, 'tube', 'a strapless knit tube top, all day');
    assert.equal(w.hoodie, 'off', 'there is no hoodie in this costume');
    assert.equal(w.socks, 'up', 'the ankle socks stay on for the whole stream');
    assert.equal(w.leggings, false);
    assert.ok(w.midriff, 'the rolled knit leaves her belly open in every frame');
    assert.ok(w.yogaKit, 'the day-4 guard switches on only for day 4');

    // False claims about this plate must be rejected...
    assert.ok(contradictsWardrobe('Я стянула шорты и осталась в белье', w), 'shorts never leave');
    assert.ok(contradictsWardrobe('Простыня сползла с плеча', w), 'no sheet on this day');
    assert.ok(contradictsWardrobe('Гольфы натянуты до колена', w), 'no knee-highs on this day');
    assert.ok(contradictsWardrobe('Сетка на ногах до самых пальцев', w), 'no fishnets on this day');
    assert.ok(contradictsWardrobe('Я стою босиком на коврике', w), 'she is in socks');
    assert.ok(contradictsWardrobe('Топ держится на тонких бретелях', w), 'the top has no straps');

    // ...and her own true sentences must pass, including the joke about what is NOT there.
    assert.equal(contradictsWardrobe('Топ без бретелей, и он держится', w), null);
    assert.equal(contradictsWardrobe('Шорты сядут ещё ниже, если добьёте 30000', w), null);
    assert.equal(contradictsWardrobe('Носочки с красной резинкой натянуты', w), null);

    for (const line of WARDROBE_SAFE_LINES[4][stage as SubGoalStageIndex]!) {
      assert.equal(contradictsWardrobe(line, w), null, `safe s${stage}: ${line}`);
    }
    for (const zone of ZONES) {
      for (let seed = 0; seed < 80; seed++) {
        const line = pickStageTapLine(zone, seed, stage as SubGoalStageIndex, 4);
        assert.equal(contradictsWardrobe(line, w, zone), null, `s${stage} ${zone}#${seed}: ${line}`);
      }
      for (let seed = 0; seed < 40; seed++) {
        const idle = pickIdleTeaseLine(stage as SubGoalStageIndex, seed, 4);
        assert.equal(contradictsWardrobe(idle, w), null, `s${stage} idle#${seed}: ${idle}`);
      }
    }
  }
});

test('the yoga farewell and the «Готово?» beat stay true on every yoga frame', () => {
  for (let stage = 0; stage <= 4; stage++) {
    const w = getWardrobe(4, stage);
    for (const line of [...DAY4_FAREWELL_LINES, ...DAY4_DONE_LINES, DAY4_OPENING_LINE]) {
      assert.equal(contradictsWardrobe(line, w), null, `s${stage}: ${line}`);
    }
  }
  assert.ok(DAY4_FAREWELL_LINES.length >= 5, 'the yoga day needs a real goodbye');
  assert.match(DAY4_OPENING_LINE, /кресло|растяж/i, 'the opening must name the day');
  // The yoga flash pool runs on ANY stage, so it must never mention a garment leaving. A negation is
  // allowed - the whole joke of the day is "nothing came off", and the copy has to be able to say that.
  const NEGA = /(ни одной|ни единой|ни одна|ноль снят|без единой|ничего не|не снят|не улетел|не съехал)/i;
  for (const line of [...DAY4_DONE_LINES, ...DAY4_FAREWELL_LINES]) {
    const claim = line
      .split(/(?<=[.!?])/)
      .filter((c) => /снят|улетел|осталась в|раздева/i.test(c) && !NEGA.test(c));
    assert.deepEqual(claim, [], `line claims a removal: ${line}`);
  }
  // Day 3's goodbye is what advertises this day - if that ever stops mentioning yoga, the player
  // arrives at Day 4 with no idea what they bought.
  assert.match(DAY3_FAREWELL_LINES.join(' '), /йога|растяж/i, 'the ghost farewell must announce yoga');
});

test('Day 4 is gated: no yoga plates in the build means no yoga day, and only Day 3 opens it', () => {
  // Node has no window, so the HEAD probe of heroine_t4_* cannot run from a test.
  assert.equal(isDay4Unlocked(), false);
  const day1 = createInitialState(1000);
  assert.equal(startDay4(day1).ok, false, 'Day 4 cannot start on Day 1');
  const day3Done = { ...day1, streamDay: 3, subscribers: DAY4_FINALE_SUBS };
  assert.equal(isDay3FinaleReached(day3Done), true, 'the yoga day opens the moment the ghost ladder is paid');
  assert.equal(startDay4(day3Done).ok, false, 'locked while the heroine_t4_* probe cannot run in node');
});

/**
 * The plate gate reads the SHIPPED webp: the geometry every other day obeys (1024x1526), an alpha layer
 * (a "floating heroine" bug looks exactly like a plate that lost its keying) and, when the local master is
 * around, that the keyer wrote RGBA. `public/art/*.png` is gitignored on purpose, so the PNG half is a
 * bonus check that silently steps aside in a fresh clone.
 */
test('the four yoga plates shipped on the canonical 1024x1526 keyed box', () => {
  for (const name of ['s0', 's1', 's2', 's3', 'flash']) {
    const webp = `${PLATE_DIR}heroine_t4_${name}.webp`;
    assert.ok(existsSync(webp), `${webp} is missing — the game loads the webp plate, not the master`);
    const plate = readWebpDims(readFileSync(webp));
    assert.ok(plate, `${name}: unreadable webp container`);
    assert.equal(plate.width, 1024, `${name}: plate width must match the stage box`);
    assert.equal(plate.height, 1526, `${name}: plate height must match the stage box`);
    assert.equal(plate.alpha, true, `${name}: the plate has no alpha layer, so the plum matte will show`);
    assert.ok(readFileSync(webp).byteLength > 40_000, `${name}: webp plate looks empty`);

    const png = `${PLATE_DIR}heroine_t4_${name}.png`;
    if (existsSync(png)) {
      const master = readPngDims(readFileSync(png));
      assert.equal(master?.width, 1024, `${name}: master width drifted from the shipped plate`);
      assert.equal(master?.height, 1526, `${name}: master height drifted from the shipped plate`);
      assert.equal(master?.colorType, 6, `${name}: master must be RGBA (colour type 6)`);
    }
  }
});

test('the yoga chat begs for POSES, never for fewer clothes', () => {
  // The premise of the day, tested from the viewers' side: any line that reads as a strip request -
  // in her pools or in the chat pools - would sell a plate that does not exist.
  const STRIP_BEG =
    /(раздевай|раздень|снимай|скинь|скидывай|покажи без|голые ступн|голые пальц|голые ножк|босиком|босые|останься в|topless)/i;
  const NEGA =
    /(ни одного|ни одной|ни единой|ни одна|ничего не|не снят|не надо|не нужно|не просим|не ждём|а не стриптиз|ноль снят)/i;
  const pools: [string, readonly string[]][] = [
    ['ambient day4', AMBIENT_DAY4],
    ['tts day4', DONATION_TTS_LINES_DAY4],
    ...Object.entries(AMBIENT_DAY4_BY_STAGE).flatMap(([st, pool]) =>
      pool.map((_, i) => [`ambient s${st}[${i}]`, [pool[i]!]] as [string, readonly string[]]),
    ),
    ...Object.entries(ZONE_CHAT_REACTIONS_DAY4).map(
      ([z, pool]) => [`burst ${z}`, pool] as [string, readonly string[]],
    ),
    ...Object.entries(VIRAL_CLIP_TITLES_DAY4).map(
      ([z, pool]) => [`clip ${z}`, pool] as [string, readonly string[]],
    ),
    ...getSubGoalStagesForDay(4).map(
      (st) => [`ladder s${st.stage}`, st.chatCascade.map((c) => c.text)] as [string, readonly string[]],
    ),
    ['her own day4 lines', [...Object.values(DAY4_TAP_LINES).flat(), ...DAY4_DONE_LINES]],
  ];

  let poseTalk = 0;
  for (const [where, pool] of pools) {
    for (const line of pool) {
      assert.ok(
        !STRIP_BEG.test(line) || NEGA.test(line),
        `${where} asks her to undress: ${line.slice(0, 90)}`,
      );
      if (/поз|наклон|растяж|шпагат|удержан|выдох|вдох|гибк|кресл|техник/i.test(line)) poseTalk++;
    }
  }
  assert.ok(poseTalk >= 25, `the yoga day barely talks about yoga (${poseTalk} pose lines)`);

  // And the shop's day-4 variants must not promise a strip either.
  for (const ch of STREAM_CHALLENGES) {
    assert.ok(ch.reactionLineDay4, `${ch.id} speaks Day-1 strip talk on the yoga day`);
    assert.ok(!STRIP_BEG.test(ch.reactionLineDay4!), `${ch.id} day-4 line undresses her`);
    assert.ok(!STRIP_BEG.test(ch.chatBurstDay4 ?? ''), `${ch.id} day-4 chat burst undresses her`);
    // She is in socks all day: the feet challenge may not show bare toes.
    if (ch.zoneFocus === 'feet') assert.match(ch.reactionLineDay4!, /носочк|вязк/i);
  }

  // The story panel must follow the day instead of reciting Day 1.
  assert.match(getStoryChapter(0, 4).badgeTitle, /^День 4/);
  assert.notEqual(getStoryChapter(90, 4).diaryThought, getStoryChapter(90, 1).diaryThought);
  assert.match(getStoryChapter(0, 3).badgeTitle, /^День 3/);
});
