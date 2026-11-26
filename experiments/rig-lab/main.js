/**
 * OpenBone smoke test in the game's own renderer (PixiJS 8).
 *
 * The only thing this page proves: the runtime loads a real .obone document, uploads its
 * textures, runs its state machine and reacts to inputs — inside Pixi 8, which is what
 * StreamStage already uses. Nothing is wired into the game here.
 */
import { Application } from "pixi.js";
import { OpenBone } from "@openbone/pixi";

const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const stageEl = document.getElementById("stage");

const log = (line) => {
  logEl.textContent += `${new Date().toLocaleTimeString()}  ${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
};
const setStatus = (text) => {
  statusEl.textContent = text;
};

async function boot() {
  const rect = stageEl.getBoundingClientRect();
  const app = new Application();
  await app.init({
    preference: "webgl",
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    background: "#131318",
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  stageEl.appendChild(app.canvas);
  log(`pixi ${app.renderer.type === 1 ? "webgl" : "type:" + app.renderer.type} init ok ${app.screen.width}×${app.screen.height}`);

  // The real target: the approved day-1 plate driven by a weighted spine rig.
  const miya = await OpenBone.from("./miya_day1.obone", { autoUpdate: true });
  const mdoc = miya.asset.doc;
  const mscale = Math.min(app.screen.width / mdoc.width, app.screen.height / mdoc.height);
  miya.scale.set(mscale);
  miya.position.set(
    (app.screen.width - mdoc.width * mscale) / 2,
    (app.screen.height - mdoc.height * mscale) / 2,
  );
  app.stage.addChild(miya);
  log(`Miya rig: ${mdoc.skeleton.bones.length} bones, ${mdoc.animations.length} animations, scale ${mscale.toFixed(3)}`);
  setStatus(`OK · Miya rig · ${mdoc.skeleton.bones.length} костей · breathing`);

  document.getElementById("btn-miya-breath").onclick = () => {
    miya.play("breath", true);
    log("miya.play breath");
  };
  document.getElementById("btn-miya-sway").onclick = () => {
    miya.play("sway", true);
    log("miya.play sway");
  };
  document.getElementById("btn-miya-turn").onclick = () => {
    miya.play("turn", true);
    log("miya.play turn");
  };
  // Blink is not a loop: it plays once on top of whatever is running, then the face returns to
  // the open state on its own.
  document.getElementById("btn-miya-blink").onclick = () => {
    miya.play("blink", false);
    log("miya.play blink");
  };
  document.getElementById("btn-miya-talk").onclick = () => {
    miya.play("talk", true);
    log("miya.play talk");
  };
  document.getElementById("btn-miya-smile").onclick = () => {
    miya.play("smile", false);
    log("miya.play smile");
  };

  // The upstream sample stays as a runtime sanity check, parked small in the corner.
  const bone = await OpenBone.from("./button.obone", { autoUpdate: true });
  const doc = bone.asset.doc;
  log(`document "${doc.name}" ${doc.width}×${doc.height}, images: ${doc.images.length}`);
  log(`animations: ${(doc.animations ?? []).length}, state machines: ${(doc.stateMachines ?? []).length}`);
  log(`textures loaded: ${Object.keys(bone.asset.textures ?? {}).length}`);

  const scale = 0.34;
  bone.scale.set(scale);
  bone.position.set(12 + doc.originX * scale, 12 + doc.originY * scale);
  bone.alpha = 0.55;
  app.stage.addChild(bone);
  bone.autoUpdate = true;

  bone.onOpenBone?.("stateChange", (e) => log(`stateChange ${e.layer}: ${e.from} -> ${e.to}`));
  bone.onOpenBone?.("event", (e) => log(`event ${e.name}`));



  document.getElementById("btn-hover").onclick = () => {
    bone.setInput("hover", true);
    log("setInput hover=true");
  };
  document.getElementById("btn-press").onclick = () => {
    bone.fire("press");
    log("fire press");
  };
  document.getElementById("btn-update").onclick = () => {
    bone.update(1 / 30);
    log("manual update(1/30)");
  };

  window.addEventListener("resize", () => {
    const r = stageEl.getBoundingClientRect();
    app.renderer.resize(Math.round(r.width), Math.round(r.height));
  });

  // Report the real frame rate after a second — a dead runtime shows up here, not in a screenshot.
  let frames = 0;
  const started = performance.now();
  app.ticker.add(() => {
    frames += 1;
    if (frames === 60) {
      const fps = 60000 / (performance.now() - started);
      log(`~${fps.toFixed(1)} fps over the first ${frames} frames`);
    }
  });
}

boot().catch((err) => {
  setStatus(`FAIL: ${err?.message ?? err}`);
  log(`ERROR ${err?.stack ?? err}`);
  console.error(err);
});
