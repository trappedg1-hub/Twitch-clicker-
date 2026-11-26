import { Application, Assets, MeshPlane, Sprite } from 'pixi.js';
const texture = await Assets.load('./pose.webp');
const w=1024,h=1526;
async function setup(id,animated){
 const host=document.getElementById(id),app=new Application();
 await app.init({resizeTo:host,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio||1,2),autoDensity:true,preference:'webgl'});host.appendChild(app.canvas);
 const item=animated?new MeshPlane({texture,verticesX:80,verticesY:120}):new Sprite(texture);
 app.stage.addChild(item);
 const fit=()=>{const s=Math.min(app.screen.width/w,app.screen.height/h)*.98; item.scale.set(s);item.position.set((app.screen.width-w*s)/2,(app.screen.height-h*s)/2)};
 new ResizeObserver(fit).observe(host);fit();return {app,item};
}
await setup('original',false);const {app,item}=await setup('animated',true);
const buffer=item.geometry.getAttribute('aPosition').buffer,rest=new Float32Array(buffer.data);let started=-10000, zone='chest', repeating=false,lastRepeat=0;
const strength=document.querySelector('#strength'),val=document.querySelector('#value'),breathe=document.querySelector('#breathe');
strength.oninput=()=>val.textContent=Number(strength.value).toFixed(1)+'×';
function tap(z){zone=z;started=performance.now();}document.querySelector('#chest').onclick=()=>tap('chest');document.querySelector('#leg').onclick=()=>tap('leg');
const repeat=document.querySelector('#repeat'); repeat.onclick=()=>{repeating=!repeating;repeat.setAttribute('aria-pressed',String(repeating));repeat.textContent='Повтор: '+(repeating?'вкл.':'выкл.');lastRepeat=0};
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
function influence(x,y,cx,cy,rx,ry){let d=((x-cx)/rx)**2+((y-cy)/ry)**2;return d<1?(1-d)**2:0}
app.ticker.add(()=>{let now=performance.now();if(repeating&&now-lastRepeat>1800){tap(zone);lastRepeat=now}const t=(now-started)/1000;const pulse=(!reduce.matches && t>=0&&t<1.2)?Math.sin(t*15)*Math.exp(-t*4):0;const breath=(!reduce.matches&&breathe.checked)?Math.sin(now/1200):0;let p=buffer.data;const amp=+strength.value;let max=0;
 for(let i=0;i<rest.length;i+=2){const x=rest[i],y=rest[i+1],torso=influence(x,y,530,545,135,95),leg=influence(x,y,410,865,110,90);const v=zone==='chest'?torso:leg;const dx=(x-530)/135*torso*breath*3 + v*pulse*amp*(zone==='leg'?14:8);const dy=-torso*breath*3-v*pulse*amp*(zone==='leg'?7:10);p[i]=x+dx;p[i+1]=y+dy;max=Math.max(max,Math.abs(dx),Math.abs(dy));}buffer.update();window.labState={zone,pulse,breath,max};
});
