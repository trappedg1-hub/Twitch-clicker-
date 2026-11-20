# Character animation: research and current limitations

## Sources reviewed

- [OpenBone](https://github.com/UXCentury/open-bone): MIT-licensed editor and runtimes; documents weighted meshes, physics constraints, layers, and a PixiJS integration. It requires an authored rig and assets; it does not turn a flattened pose into separate limbs or faces automatically. Its suitability and runtime compatibility with this game remain untested.
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
