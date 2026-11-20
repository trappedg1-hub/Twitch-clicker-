const canvas=document.querySelector('#hero'),fallback=document.querySelector('#fallback'),status=document.querySelector('#status');
const gl=canvas.getContext('webgl',{alpha:false,antialias:true});const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let zone=0,start=-1e6,loop=false,last=0,power=1,breath=true,ready=false;
const statusText=()=>reduce.matches?'Анимация отключена настройками устройства.':'Нажми кнопку или коснись персонажа.';
function trigger(z){zone=z;start=performance.now();status.textContent=reduce.matches?statusText():z===1?'Реакция груди':'Реакция ступней'}
document.querySelector('#chest').addEventListener('click',()=>trigger(1));document.querySelector('#feet').addEventListener('click',()=>trigger(2));
const repeat=document.querySelector('#replay');repeat.addEventListener('click',()=>{loop=!loop;repeat.setAttribute('aria-pressed',String(loop));repeat.textContent='↻   Автоповтор: '+(loop?'вкл.':'выкл.');last=0});
document.querySelector('#power').addEventListener('input',e=>{power=Number(e.target.value);document.querySelector('#power-value').value=power.toFixed(1)+'×'});
document.querySelector('#breath').addEventListener('change',e=>{breath=e.target.checked});reduce.addEventListener?.('change',()=>status.textContent=statusText());
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();trigger((e.clientY-r.top)/r.height>.7?2:1)});
if(!gl){canvas.hidden=true;fallback.hidden=false;status.textContent='WebGL недоступен: показан неподвижный кадр.'}else{
 canvas.width=843;canvas.height=1264;
 const vertex=`attribute vec2 a; varying vec2 uv; void main(){gl_Position=vec4(a,0.,1.);uv=vec2((a.x+1.)*.5,(1.-a.y)*.5);}`;
 const fragment=`precision highp float; varying vec2 uv; uniform sampler2D image; uniform float breathWave; uniform float tapWave; uniform float target; uniform float intensity;
 float area(vec2 p,vec2 c,vec2 r){vec2 q=(p-c)/r;float t=max(0.,1.-dot(q,q));return t*t;}
 void main(){vec2 q=uv;float chest=area(uv,vec2(.505,.315),vec2(.145,.061));float foot1=area(uv,vec2(.40,.844),vec2(.082,.10));float foot2=area(uv,vec2(.61,.844),vec2(.082,.10));
 q.y+=chest*breathWave*.0020; q.x+=(uv.x-.505)*chest*breathWave*.005;
 if(target<1.5){q.y+=chest*tapWave*intensity*.007;q.x+=(uv.x-.505)*chest*tapWave*intensity*.018;}else{q.y+=(foot1+foot2)*tapWave*intensity*.005;q.x+=(foot1-foot2)*tapWave*intensity*.004;}
 gl_FragColor=texture2D(image,q);}`;
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 try{const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 let imageVersion=0;function setImage(high){const image=new Image(),version=++imageVersion;image.onload=()=>{if(version!==imageVersion)return;gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);ready=true;status.textContent=statusText()};image.onerror=()=>status.textContent='Не удалось загрузить изображение.';image.src=high?'./enhanced.webp':'./original.webp'}setImage(true);document.querySelector('#quality').addEventListener('change',e=>setImage(e.target.checked));
 const u=['breathWave','tapWave','target','intensity'].map(n=>gl.getUniformLocation(p,n));function draw(now){if(loop&&now-last>1900&&!reduce.matches){trigger(zone||1);last=now}const t=(now-start)/1000;const wave=!reduce.matches&&t>=0&&t<1.1?Math.sin(t*13)*Math.exp(-t*3):0;const breathing=breath&&!reduce.matches?Math.sin(now/1300):0;gl.viewport(0,0,canvas.width,canvas.height);gl.uniform1f(u[0],breathing);gl.uniform1f(u[1],wave);gl.uniform1f(u[2],zone||1);gl.uniform1f(u[3],power);if(ready)gl.drawArrays(gl.TRIANGLE_STRIP,0,4);window.characterLab={ready,zone,wave,breathing,reduced:reduce.matches};requestAnimationFrame(draw)}requestAnimationFrame(draw);
 }catch(e){canvas.hidden=true;fallback.hidden=false;status.textContent='Анимация недоступна, показан неподвижный кадр.';console.error(e)}
}
