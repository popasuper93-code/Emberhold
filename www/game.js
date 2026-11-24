import * as THREE from 'three';
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const rand = (a,b) => a+Math.random()*(b-a);
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints>1 && innerWidth<900);
function noise2D(x,y){const s=Math.sin(x*12.9898+y*78.233)*43758.5453;return s-Math.floor(s);}
function fbm(x,y,oct=4){let v=0,a=0.5,f=1;for(let i=0;i<oct;i++){v+=a*noise2D(x*f,y*f);a*=0.5;f*=2;}return v;}
function makeTex(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');const img=ctx.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const [r,g,b,a]=fn(x,y,w,h);img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=a??255;}ctx.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
const memoryStore={};
const SafeStorage={getItem(k){try{return localStorage.getItem(k);}catch(e){return memoryStore[k]??null;}},setItem(k,v){try{localStorage.setItem(k,v);}catch(e){memoryStore[k]=v;}},removeItem(k){try{localStorage.removeItem(k);}catch(e){delete memoryStore[k];}}};
const AudioSys={ctx:null,master:null,unlocked:false,init(){this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=0.7;this.master.connect(this.ctx.destination);},unlock(){if(this.ctx?.state==='suspended')this.ctx.resume();this.unlocked=true;},setVol(v){if(this.master)this.master.gain.value=v;},beep(f=440,d=0.08,type='square',vol=0.12){if(!this.unlocked)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=f;g.gain.value=vol;o.connect(g);g.connect(this.master);o.start();g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+d);o.stop(this.ctx.currentTime+d);},tick(){this.beep(780,0.035,'square',0.07);},hit(){this.beep(160,0.1,'sawtooth',0.18);},craft(){this.beep(500,0.12,'triangle',0.1);},shoot(){this.beep(85,0.15,'sawtooth',0.22);},foot(){this.beep(70+Math.random()*30,0.04,'triangle',0.03);},ui(){this.beep(580,0.04,'sine',0.07);}};
const Save={data:{coins:150,embers:0,skins:[],settings:{quality:'Medium',fov:75,sens:1.2,vol:0.7,showFps:true},daily:''},load(){try{const s=SafeStorage.getItem('emberhold_v2');if(s)Object.assign(this.data,JSON.parse(s));}catch(e){}this.apply();},save(){try{SafeStorage.setItem('emberhold_v2',JSON.stringify(this.data));}catch(e){}},apply(){const s=this.data.settings;try{$('setQuality').value=s.quality;$('setFov').value=s.fov;$('setSens').value=s.sens;$('setVol').value=s.vol;$('setFps').checked=s.showFps;}catch(e){}AudioSys.setVol(s.vol);try{$('coins').textContent=this.data.coins;$('embers').textContent=this.data.embers;}catch(e){}}};
// Minimal working core for APK - full features in next update
console.log('Emberhold game.js loaded');
const G={state:'LOADING'};
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x1a1520);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.1,500);
const lobbyCam=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,0.1,200);
const sun=new THREE.DirectionalLight(0xffe8c0,1.2);sun.position.set(30,50,20);scene.add(sun);
scene.add(new THREE.AmbientLight(0x405060,0.5));
// Character
const charGroup=new THREE.Group();
const bodyMat=new THREE.MeshStandardMaterial({color:0xc0a080});
const clothMat=new THREE.MeshStandardMaterial({color:0x4a3a28});
charGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.7,0.9,0.4),clothMat).translateY(1.15));
charGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.38,0.42,0.38),bodyMat).translateY(1.85));
charGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.42,0.28,0.42),new THREE.MeshStandardMaterial({color:0x8a6a40})).translateY(2.0));
scene.add(charGroup);
const ground=new THREE.Mesh(new THREE.CircleGeometry(20,32),new THREE.MeshStandardMaterial({color:0x2a2218}));
ground.rotation.x=-Math.PI/2;scene.add(ground);
function setProgress(p){const el=$('loadProgress');if(el)el.style.width=p+'%';}
async function init(){
  Save.load();AudioSys.init();setProgress(50);
  setTimeout(()=>{
    setProgress(100);
    $('loading').classList.add('hide');
    $('lobby').classList.add('show');
    G.state='LOBBY';
    $('onlineCount').textContent='Онлайн: '+(80000+Math.random()*20000|0);
  },400);
  $('btnPlay').onclick=()=>{AudioSys.unlock();AudioSys.ui();$('lobby').classList.remove('show');$('hud').classList.add('show');if(isMobile)$('mobileControls').style.display='block';G.state='GAME';camera.position.set(0,2,5);};
  $('btnSettings').onclick=$('btnSettingsTop').onclick=()=>$('settingsPanel').classList.add('show');
  $('btnCases').onclick=()=>$('roulettePanel').classList.add('show');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).classList.remove('show'));
  $('btnExit').onclick=()=>{if(confirm('Выйти?'))window.close();};
  requestAnimationFrame(loop);
}
let last=performance.now();
function loop(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(G.state==='LOBBY'||G.state==='LOADING'){
    const t=now*0.0002;
    lobbyCam.position.set(Math.sin(t)*5,2.2,Math.cos(t)*5+1);
    lobbyCam.lookAt(0,1.3,0);
    charGroup.rotation.y=Math.sin(now*0.0005)*0.2;
    renderer.render(scene,lobbyCam);
  }else{
    renderer.render(scene,camera);
  }
  requestAnimationFrame(loop);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();lobbyCam.aspect=innerWidth/innerHeight;lobbyCam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
init().catch(e=>{console.error(e);$('loading').innerHTML='<div style="color:#e50;padding:20px">Ошибка: '+e.message+'</div>';});
