#!/usr/bin/env python3
"""Build a local ComfyUI API-format SDXL text-to-image graph, without network calls.
This is a template, not a generator; install ComfyUI and a compatible checkpoint.
"""
import argparse, json
from pathlib import Path

def build(checkpoint, positive, negative, width, height, seed, steps, cfg):
    if not checkpoint.strip(): raise ValueError('checkpoint name is required')
    if not positive.strip(): raise ValueError('positive prompt is required')
    if width < 64 or height < 64 or width % 64 or height % 64: raise ValueError('width and height must be positive multiples of 64')
    if not 1 <= steps <= 100 or not 0 < cfg <= 30 or not 0 <= seed <= 2**53-1: raise ValueError('steps, cfg or seed out of range')
    return {
        '1': {'class_type':'CheckpointLoaderSimple','inputs':{'ckpt_name':checkpoint}},
        '2': {'class_type':'CLIPTextEncode','inputs':{'clip':['1',1],'text':positive}},
        '3': {'class_type':'CLIPTextEncode','inputs':{'clip':['1',1],'text':negative}},
        '4': {'class_type':'EmptyLatentImage','inputs':{'width':width,'height':height,'batch_size':1}},
        '5': {'class_type':'KSampler','inputs':{'model':['1',0],'positive':['2',0],'negative':['3',0],'latent_image':['4',0],'seed':seed,'steps':steps,'cfg':cfg,'sampler_name':'euler','scheduler':'normal','denoise':1.0}},
        '6': {'class_type':'VAEDecode','inputs':{'samples':['5',0],'vae':['1',2]}},
        '7': {'class_type':'SaveImage','inputs':{'images':['6',0],'filename_prefix':'miya_experiment'}},
    }

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--checkpoint',required=True,help='Exact checkpoint filename already installed in ComfyUI');p.add_argument('--identity',default='adult woman, long black hair, violet eyes');p.add_argument('--pose',default='seated in gaming chair, feet towards camera');p.add_argument('--wardrobe',default='pink bikini');p.add_argument('--scene',default='streaming room, soft studio light');p.add_argument('--extra',default='');p.add_argument('--negative',default='low quality, blurry, extra fingers, deformed hands, malformed feet');p.add_argument('--width',type=int,default=832);p.add_argument('--height',type=int,default=1216);p.add_argument('--seed',type=int,default=42);p.add_argument('--steps',type=int,default=28);p.add_argument('--cfg',type=float,default=6);p.add_argument('--output',default='workflow-api.json');args=p.parse_args()
    positive=', '.join(x.strip() for x in ['masterpiece, detailed anime illustration',args.identity,args.pose,args.wardrobe,args.scene,args.extra] if x.strip())
    try: graph=build(args.checkpoint,positive,args.negative,args.width,args.height,args.seed,args.steps,args.cfg)
    except ValueError as e: p.error(str(e))
    Path(args.output).write_text(json.dumps(graph,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('API graph saved:',args.output,'\nPositive:',positive,'\nNegative:',args.negative)
if __name__=='__main__':main()
