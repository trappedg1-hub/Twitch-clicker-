# Character animation: research and current limitations

## Sources reviewed

- [OpenBone](https://github.com/UXCentury/open-bone): MIT-licensed editor and runtimes; documents weighted meshes, physics constraints, layers, and a PixiJS integration. It requires an authored rig and assets; it does not turn a flattened pose into separate limbs or faces automatically. A standalone browser smoke test with its sample Button document and the game’s PixiJS 8.23.0 rendered one draw call successfully; actual character rigs, physics, mobile performance and integration remain untested.
- [Untitled Pixi Live2D Engine](https://github.com/Untitled-Story/untitled-pixi-live2d-engine): an MIT PixiJS v8 integration for Cubism models, requiring the separate Cubism runtime and a prepared model. Check Cubism's own licensing before distribution; the plugin's MIT license is not a license for Cubism Core or third-party models.
- [DragonBones Pixi runtime](https://github.com/FlySkyPie/dragonbones-pixi): MIT, but its README targets PixiJS 4, not this game's PixiJS 8. It would need compatibility work and an authored rig.
- [wobble](https://github.com/skevy/wobble): describes a closed-form damped harmonic oscillator for spring animation. An exponentially damped sine can serve as an art-directed secondary response; it is not a biomedical model of anatomy.

## Current implementation

All 30 currently shipped plates have hand-located torso and leg regions in `src/heroine/poseAnatomy.ts`, measured against the actual game assets. The two rear-view bikini poses use hips rather than a front chest region. A short damped response follows the target region after a tap, with intensity increasing across days. Breathing uses the torso, except for rear-facing poses where it uses the back. The chair remains part of the same flattened texture: conservative interior meshes reduce collateral motion, but are not a proof that every chair pixel is unaffected. The movement is a localized deformation, not independently articulated body parts, true limb movement or frame-by-frame animation.

First- and second-day facial patches exist. Most later plates deliberately suppress those patches because their painted faces, angles, costumes and occlusions do not match the first-day overlays. True per-pose expression/blink layers and premium articulation need authored, registered assets and occlusion handling. In particular the approved static originals must be retained and any reconstruction of hidden body/chair portions needs visual review and approval.

## Next steps for premium animation

1. Prototype one representative pose as a layered rig, including separate chair, hair, body, outfit, limbs, eyes and mouth; reconstruct only occluded backing pixels on working copies, keeping approved originals intact.
2. Validate import and PixiJS 8 playback, asset and runtime licenses, mobile performance, reduced motion, repeat taps and layer seams before choosing a runtime.
3. Have the user evaluate a visual playback before producing the other 29 rigs; author actual pose-specific joint and secondary motion, and expression shapes separately rather than pasting the Day-1 face onto different art.
4. Check chair response only when physically justified by contact, and inspect actual chair pixels, not merely a bounding-box proxy. Avoid assigning physics to objects held in fixed hands unless the pose provides appropriately rigged hand/prop layers.

## Further investigation: from a flat image to an animated character

These are separate steps: (1) extract and complete overlapping artwork layers, (2) author a rig and motions, and (3) play it inside the game. None of these sources proves that a complex seated pose will work automatically or preserve the approved image pixel-for-pixel.

### Layer extraction and occluded areas

- [See-through](https://github.com/shitagaki-lab/see-through) is a SIGGRAPH 2026 research project for decomposing one anime illustration into depth-ordered, inpainted semantic layers and exporting PSD; it reports up to 23 layers. It is the most relevant starting point, not a finished animation or guaranteed separation of chair, hands, props and individual limbs. Inspect the flattened PSD against the source, and manually repair seams and reconstructed areas. Its repository describes roughly 12–16 GB VRAM at 1280 resolution by default, or around 10 GB with group offload. A [hands-on setup article](https://lilting.ch/en/articles/see-through-anime-layer-decomposition) reports roughly 14 GB of model downloads. This sandbox has no visible NVIDIA GPU and lacks the required PyTorch runtime; no inference on the user’s artwork has been performed.
- The [public demo](https://24yearsold-see-through-demo.hf.space/) runs on a third-party service, with lower suggested resolution and quotas/timeouts. Do not upload the user's art without explicit permission; review its privacy and output terms first.
- See-through's code is Apache-2.0, but model weights have additional upstream terms. The maintainer's [license clarification](https://github.com/shitagaki-lab/see-through/issues/43) says commercial use is permitted, while LayerDiff and depth models carry Open RAIL restrictions, including terms-of-use obligations for services; body-parsing weights are Apache-2.0. Check the current model cards, licenses and intended usage independently before production; the issue remains open.
- [Anime Face Segmentation](https://github.com/siyeong0/Anime-Face-Segmentation) can assist with visible facial masks, not reconstruct hidden regions or create new expressions.
- [anime-part-split](https://huggingface.co/tsunehimatoi/anime-part-split) restricts usage to research/personal non-commercial use; unsuitable for commercial release without separate permission.

### Rigging and playback

- [Stretchy Studio](https://github.com/MangoLion/stretchystudio) (MIT) advertises See-through PSD import, automated rigging via DWPose or heuristics, meshes and shape keys. Promising for a first editable rig, but its export and interoperability with a chosen game runtime need verification, as do separately distributed model dependencies.
- [2DAutoRigger](https://github.com/matbn/2DAutoRigger) describes slicing, refinement, rigging and export. Core code is Apache-2.0, but plugins/models have separate licenses. Its quality and handling of overlapping seated poses are unverified.
- [image2live2d](https://github.com/Wzhang3912/image2live2d) converts already separated PSD/PNG layers into rigs; a flat input still requires the decomposition stage. Check each output/runtime and dependency license, especially for Cubism.
- [Rigby2D](https://github.com/jaisurya-dev-art/rigby2d) describes PSD import, weighted meshes, IK, physics and a Pixi 8 runtime; promising but early-stage and not tested here.
- [OpenBone Pixi](https://github.com/UXCentury/open-bone/tree/main/packages/pixi) publishes `@openbone/pixi` with PixiJS `^8.0.0` as a peer dependency. An isolated, non-production Playwright smoke test loaded and rendered its sample `button.obone` with `@openbone/pixi` 0.4.6 and PixiJS 8.23.0. This establishes only basic sample loading/rendering, not a successful PSD import, character animation, physics, or performance in this game. No dependency was added to the project.
- [Live2D physics tutorial](https://www.youtube.com/watch?v=kTbhZQ7AVwg) is a practical rigging reference; authored layers, motion tuning and runtime rights remain separate considerations.

### Recommended experiment

Try one representative pose on a working copy: See-through extraction on a suitable GPU (or a privacy-approved service), manually correct chair/body/limb/prop separation and hidden pixels; evaluate Stretchy Studio and whether its export can actually be brought into OpenBone or Rigby2D. If not, author/import the corrected layers directly in the selected rig editor. Test idle breathing, tap, expression and hand/prop/foot motion visually against the original, including chair contact and seams. Only after a successful sample should the remaining 29 poses be costed and built. The current mesh approach is still in place; none of these external tools has been integrated into the game.

### Additional lead: Mesh Avatar Studio

[Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) is an MIT-licensed editor and mesh-avatar workflow that documents agent-assisted manual layer cutting, coordinate checks and visual motion review. It recommends transparent, front-facing head-and-shoulders art; full-body seated characters and integration into Pixi have not been validated. Its optional expression-generation workflow sends art to an external provider and requires consent. Its documented agent recommendations do not mean those other agents or models are available in this session. This is a lead to test rather than a proven automatic conversion.

### Isolated motion lab

`experiments/animation-lab` is a separate preview for one copy of the approved day-six starting plate. It compares still and moving art and offers breathing, torso/leg impulses, repeat and a strength control. It uses a fine Pixi mesh, not See-through, OpenBone or a real layered rig; the chair is baked into the source so isolation is not guaranteed. No game code or original artwork was changed. A browser smoke test checked both impulses and reduced motion; subjective visual quality and chair edges still require review. Run with `cd experiments/animation-lab && ../../node_modules/.bin/vite --host 0.0.0.0 --port 5186` after installing the project's dependencies.

### GitHub tooling investigation and local tests

- [Anime2.5DRig](https://github.com/852wa/Anime2.5DRig) is MIT-licensed and describes client-side PSD parsing, automatic rigging, mesh warp and spring motion. See-through lists it as a community tool compatible with its layer naming. Cloned separately under ignored `.qa-out`, ran `npm test`: its Node rigger/runtime/face/PSD suites passed (including its own 17- and 20-part example PSDs) and 9 Python tests passed. This does not test our art, Pixi integration, or Safari/iPhone; it requires pre-separated PSD. Check third-party dependencies and any external network calls before deploying.
- [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) was cloned separately and `npm ci --ignore-scripts` completed. Its `npm run doctor` reported Node and packages present, but `uv` and its own Playwright Chromium missing; rig generation and motion-review workflow not run. npm reported 12 dependency vulnerabilities (8 moderate, 2 high, 2 critical); audit remediation and security review required before deployment. Its workflow requires careful manual facial coordinate placement and is optimised for head-and-shoulders, so chair/legs/props are not demonstrated.
- The interactive motion lab is served as an Arena preview with an iPhone-sized layout; it uses the actual approved image copy and does not use or demonstrate either GitHub tool. Browser checks used desktop Chromium and an emulated mobile viewport, not actual iPhone Safari. The preserved game baseline is commit `1009a58`; subsequent changes are isolated to the experimental lab and research notes.
