# Prompt lab — offline ComfyUI graph builder

A small, local **prompt and API-graph builder**, not an image generator. Inspired by the structured quality/identity/action/background/camera prompt design in [comfyui-auto-anime-prompts](https://github.com/jluo-github/comfyui-auto-anime-prompts); the implementation is original and uses only the Python standard library. Choose adult characters only. Text is editable; it does not override any model/provider rules or guarantee any subject, anatomy, quality, identity, or output dimensions.

## Usage

1. Separately install [ComfyUI](https://github.com/Comfy-Org/ComfyUI) and an SDXL-compatible anime checkpoint, checking each checkpoint's license and use restrictions. No model, GPU, LoRA, pose conditioning, identity reference, or generator is bundled here. This sandbox has no GPU and generation has **not been tested**.
2. Put the checkpoint under ComfyUI's `models/checkpoints` and run:

```sh
python3 experiments/prompt-lab/build_workflow.py \
  --checkpoint 'your-installed-model.safetensors' \
  --identity 'adult woman, long black hair, violet eyes' \
  --pose 'sitting in an office chair, feet towards camera' \
  --wardrobe 'pink bikini' --scene 'streaming room' \
  --extra 'confident expression, detailed face' --seed 42 --output workflow-api.json
```

`workflow-api.json` is **API format**, not a ComfyUI canvas/UI workflow. Use it as the value of `prompt` in a `/prompt` API request to your own ComfyUI installation (or load it via a compatible client). The graph is a text-to-image starting point; it does not reproduce an existing character or use image references. Model-specific tag syntax and settings vary. Lock a seed and compare before changing prompts; record checkpoint version, seed, sampler and size. Anatomy and identity require human review. GPU/VRAM and dependencies depend on model/backend; CPU generation may be prohibitively slow.

References: [ComfyUI](https://github.com/Comfy-Org/ComfyUI), [auto anime prompts](https://github.com/jluo-github/comfyui-auto-anime-prompts), [Animagine prompt examples](https://cagliostrolab.net/posts/animagine-xl-v3-release), [Ultimate SD Upscale](https://github.com/ssitu/ComfyUI_UltimateSDUpscale). These are research references, not packages installed or evaluated in this tool. Check each code and model license independently before use.

A browser-only equivalent is available at `public/character-lab/prompt-lab.html`. It produces the same basic API graph locally; no prompt or file leaves the browser. This output is a template and has not been tested with an actual ComfyUI server.
