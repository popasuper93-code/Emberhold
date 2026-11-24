import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const rand = (a,b) => a + Math.random()*(b-a);
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900);

function noise2D(x,y){ const s = Math.sin(x*12.9898 + y*78.233)*43758.5453; return s - Math.floor(s); }
function fbm(x,y,oct=4){ let v=0,a=0.5,f=1; for(let i=0;i<oct;i++){ v+=a*noise2D(x*f,y*f); a*=0.5; f*=2; } return v; }

const memoryStore = {};
const SafeStorage = {
  getItem(k){ try{ return localStorage.getItem(k); }catch(e){ return memoryStore[k] ?? null; } },
  setItem(k,v){ try{ localStorage.setItem(k,v); }catch(e){ memoryStore[k]=v; } },
  removeItem(k){ try{ localStorage.removeItem(k); }catch(e){ delete memoryStore[k]; } }
};

const AudioSys = {
  ctx:null, master:null, unlocked:false,
  init(){ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); this.master=this.ctx.createGain(); this.master.gain.value=0.7; this.master.connect(this.ctx.destination); },
  unlock(){ if(this.ctx?.state==='suspended') this.ctx.resume(); this.unlocked=true; },
  setVol(v){ if(this.master) this.master.gain.value=v; },
  beep(f=440,d=0.08,type='square',vol=0.12){
    if(!this.unlocked) return;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.value=f; g.gain.value=vol;
    o.connect(g); g.connect(this.master); o.start();
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+d);
    o.stop(this.ctx.currentTime+d);
  },
  tick(){ this.beep(780,0.035,'square',0.07); },
  hit(){ this.beep(160,0.1,'sawtooth',0.18); },
  craft(){ this.beep(500,0.12,'triangle',0.1); },
  shoot(){ this.beep(85,0.15,'sawtooth',0.22); },
  foot(){ this.beep(70+Math.random()*30,0.04,'triangle',0.03); },
  ui(){ this.beep(580,0.04,'sine',0.07); }
};

const Save = {
  data:{ coins:150, embers:0, skins:[], settings:{quality:'Medium',fov:75,sens:1.2,vol:0.7,showFps:true}, daily:'' },
  load(){ try{ const s=SafeStorage.getItem('emberhold_v3'); if(s) Object.assign(this.data, JSON.parse(s)); }catch(e){} this.apply(); },
  save(){ try{ SafeStorage.setItem('emberhold_v3', JSON.stringify(this.data)); }catch(e){} },
  apply(){
    const s=this.data.settings;
    try{
      if($('setQuality')) $('setQuality').value=s.quality;
      if($('setFov')) $('setFov').value=s.fov;
      if($('setSens')) $('setSens').value=s.sens;
      if($('setVol')) $('setVol').value=s.vol;
      if($('setFps')) $('setFps').checked=s.showFps;
      if($('coins')) $('coins').textContent=this.data.coins;
      if($('embers')) $('embers').textContent=this.data.embers;
    }catch(e){}
    AudioSys.setVol(s.vol);
  }
};

const ITEMS = {
  wood:{name:'Дерево',stack:100,icon:'W'}, stone:{name:'Камень',stack:100,icon:'S'},
  ember:{name:'Кристалл',stack:50,icon:'E'}, ore:{name:'Руда',stack:50,icon:'O'},
  metal:{name:'Металл',stack:50,icon:'M'}, cloth:{name:'Ткань',stack:50,icon:'C'},
  rock:{name:'Камень',stack:1,icon:'R',weapon:true,dmg:14,range:2.5},
  spear:{name:'Копьё',stack:1,icon:'P',weapon:true,dmg:28,range:3.5},
  axe:{name:'Топор',stack:1,icon:'A',tool:'wood'}, pick:{name:'Кирка',stack:1,icon:'K',tool:'stone'},
  bandage:{name:'Бинт',stack:10,icon:'B',heal:30}
};

const G = {
  state:'LOADING',
  player:{hp:100,hunger:100,thirst:100},
  inv:[], hotbar:[null,null,null,null,null,null], selected:0,
  dayTime:0.3, entities:[], log:[], fps:60, pointerLocked:false
};

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a0c0);
scene.fog = new THREE.FogExp2(0x87a0c0, 0.003);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 900);
const lobbyCam = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, 0.1, 200);

const sun = new THREE.DirectionalLight(0xfff0d0, 1.35);
sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.near=1; sun.shadow.camera.far=280;
sun.shadow.camera.left=sun.shadow.camera.bottom=-100;
sun.shadow.camera.right=sun.shadow.camera.top=100;
scene.add(sun);
const amb = new THREE.AmbientLight(0x405060, 0.42); scene.add(amb);
const hemi = new THREE.HemisphereLight(0x87b0e0, 0x3a2a1a, 0.32); scene.add(hemi);

const charGroup = new THREE.Group();
function buildCharacter(){
  const skin = new THREE.MeshStandardMaterial({color:0xc8a888, roughness:0.7});
  const cloth = new THREE.MeshStandardMaterial({color:0x4a3a28, roughness:0.85});
  const metal = new THREE.MeshStandardMaterial({color:0x5a5a52, roughness:0.4, metalness:0.5});
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.95,0.42), cloth); torso.position.y=1.2; charGroup.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.44,0.4), skin); head.position.y=1.92; charGroup.add(head);
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.44,0.3,0.44), new THREE.MeshStandardMaterial({color:0x7a5a30})); helm.position.y=2.08; charGroup.add(helm);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.75,0.2), cloth); armL.position.set(-0.52,1.15,0); charGroup.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.75,0.2), cloth); armR.position.set(0.52,1.15,0); charGroup.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.85,0.24), cloth); legL.position.set(-0.22,0.42,0); charGroup.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.85,0.24), cloth); legR.position.set(0.22,0.42,0); charGroup.add(legR);
  const rifle = new THREE.Group();
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.13,0.6), metal); stock.position.set(0.58,1.25,-0.2); rifle.add(stock);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.055,0.75), new THREE.MeshStandardMaterial({color:0x333})); barrel.position.set(0.58,1.32,-0.6); rifle.add(barrel);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.07,0.35), new THREE.MeshStandardMaterial({color:0xff6020, emissive:0xff4010, emissiveIntensity:1.4})); glow.position.set(0.58,1.28,-0.35); rifle.add(glow);
  charGroup.add(rifle);
  scene.add(charGroup);
}
buildCharacter();

const lobbyGround = new THREE.Mesh(new THREE.CircleGeometry(22,40), new THREE.MeshStandardMaterial({color:0x2a2218, roughness:0.95}));
lobbyGround.rotation.x = -Math.PI/2; lobbyGround.receiveShadow = true; scene.add(lobbyGround);

const WORLD = 400;
function getHeight(x,z){
  let h = fbm(x*0.012, z*0.012, 5)*26;
  h += fbm(x*0.038, z*0.038, 3)*8;
  const dist = Math.sqrt(x*x + z*z);
  h *= Math.max(0, 1 - dist/(WORLD*0.46));
  if(dist > WORLD*0.40) h = Math.min(h, -0.5);
  return h;
}

function generateWorld(){
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, 100, 100);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    pos.setY(i, getHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color:0x4a6a38, roughness:0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.visible = false;
  scene.add(mesh);
  G.terrain = mesh;

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD*1.35, WORLD*1.35),
    new THREE.MeshStandardMaterial({color:0x1a4568, transparent:true, opacity:0.74, roughness:0.18, metalness:0.25})
  );
  water.rotation.x = -Math.PI/2; water.position.y = -0.3; water.visible = false;
  scene.add(water); G.water = water;

  const treeMat = new THREE.MeshStandardMaterial({color:0x4a3020});
  const leafMat = new THREE.MeshStandardMaterial({color:0x2a5528});
  const trees = new THREE.Group(); trees.visible = false;
  for(let i=0;i<130;i++){
    const x=rand(-170,170), z=rand(-170,170);
    const h=getHeight(x,z);
    if(h<1.6 || h>17) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.36,3.8,5), treeMat);
    trunk.position.set(x, h+1.9, z); trunk.castShadow=true;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.85,4.2,6), leafMat);
    leaf.position.set(x, h+5.1, z); leaf.castShadow=true;
    trees.add(trunk, leaf);
  }
  scene.add(trees); G.trees = trees;
}

const player = {
  pos: new THREE.Vector3(0,10,0),
  vel: new THREE.Vector3(),
  yaw:0, pitch:0,
  onGround:false, crouch:false, sprint:false,
  weaponCd:0
};

function spawnPlayer(x=rand(-25,25), z=rand(-25,25)){
  const h = getHeight(x,z);
  player.pos.set(x, h+2.2, z);
  player.vel.set(0,0,0);
  G.player.hp=100; G.player.hunger=95; G.player.thirst=95;
}

const viewmodel = new THREE.Group();
camera.add(viewmodel);
const handMat = new THREE.MeshStandardMaterial({color:0xc8a888, roughness:0.7});
const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.38,0.12), handMat);
armL.position.set(-0.24,-0.24,-0.4); viewmodel.add(armL);
const armR = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.38,0.12), handMat);
armR.position.set(0.28,-0.22,-0.45); viewmodel.add(armR);
const wepMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.12,0.55), new THREE.MeshStandardMaterial({color:0x3a3a3a}));
wepMesh.position.set(0.3,-0.12,-0.55); viewmodel.add(wepMesh);

const keys = {};
const mouse = {dx:0, dy:0, left:false};
let joy = {active:false, x:0, y:0};

window.addEventListener('keydown', e => { keys[e.code]=true; if(e.code==='Tab') e.preventDefault(); AudioSys.unlock(); });
window.addEventListener('keyup', e => keys[e.code]=false);
window.addEventListener('mousemove', e => { if(G.pointerLocked){ mouse.dx+=e.movementX; mouse.dy+=e.movementY; }});
window.addEventListener('mousedown', e => { if(e.button===0) mouse.left=true; AudioSys.unlock(); });
window.addEventListener('mouseup', e => { if(e.button===0) mouse.left=false; });
canvas.addEventListener('click', () => { if(G.state==='GAME' && !isMobile) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { G.pointerLocked = document.pointerLockElement===canvas; });

const jz=$('joystickZone'), jk=$('joystickKnob');
function joyStart(e){
  joy.active=true;
  const t=e.touches?e.touches[0]:e;
  const r=jz.getBoundingClientRect();
  joy.cx=r.left+r.width/2; joy.cy=r.top+r.height/2;
  joyMove(e);
}
function joyMove(e){
  if(!joy.active) return;
  const t=e.touches?e.touches[0]:e;
  let dx=t.clientX-joy.cx, dy=t.clientY-joy.cy;
  const len=Math.hypot(dx,dy), max=48;
  if(len>max){ dx*=max/len; dy*=max/len; }
  joy.x=dx/max; joy.y=dy/max;
  jk.style.transform=`translate(${dx}px,${dy}px)`;
}
function joyEnd(){ joy.active=false; joy.x=0; joy.y=0; jk.style.transform='translate(0,0)'; }
if(jz){
  jz.addEventListener('touchstart', joyStart, {passive:false});
  jz.addEventListener('touchmove', joyMove, {passive:false});
  jz.addEventListener('touchend', joyEnd);
  jz.addEventListener('mousedown', joyStart);
  window.addEventListener('mousemove', e => { if(joy.active) joyMove(e); });
  window.addEventListener('mouseup', joyEnd);
}

['btnFire','btnJump','btnCrouch','btnUse','btnInv','btnBuild'].forEach(id=>{
  const el=$(id); if(!el) return;
  if(id==='btnFire'){ el.addEventListener('touchstart',e=>{e.preventDefault();mouse.left=true;}); el.addEventListener('touchend',()=>mouse.left=false); }
  if(id==='btnJump'){ el.addEventListener('touchstart',e=>{e.preventDefault();keys['Space']=true;}); el.addEventListener('touchend',()=>keys['Space']=false); }
  if(id==='btnCrouch'){ el.addEventListener('touchstart',e=>{e.preventDefault();player.crouch=!player.crouch;}); }
  if(id==='btnUse'){ el.addEventListener('touchstart',e=>{e.preventDefault();tryUse();}); }
  if(id==='btnInv'){ el.addEventListener('touchstart',e=>{e.preventDefault();toggleInv();}); }
  if(id==='btnBuild'){ el.addEventListener('touchstart',e=>{e.preventDefault();toggleCraft();}); }
});

let lookTouch=null;
canvas.addEventListener('touchstart', e=>{
  for(const t of e.changedTouches){
    if(t.clientX > innerWidth*0.45){ lookTouch={id:t.identifier,x:t.clientX,y:t.clientY}; break; }
  }
},{passive:true});
canvas.addEventListener('touchmove', e=>{
  if(!lookTouch) return;
  for(const t of e.changedTouches){
    if(t.identifier===lookTouch.id){
      mouse.dx += (t.clientX-lookTouch.x)*0.35;
      mouse.dy += (t.clientY-lookTouch.y)*0.35;
      lookTouch.x=t.clientX; lookTouch.y=t.clientY;
    }
  }
},{passive:true});
canvas.addEventListener('touchend', e=>{
  for(const t of e.changedTouches) if(lookTouch && t.identifier===lookTouch.id) lookTouch=null;
});

function addItem(id, qty=1){
  const def=ITEMS[id]; if(!def) return;
  for(let i=0;i<6;i++){
    if(G.hotbar[i]?.id===id && G.hotbar[i].qty < def.stack){
      const add=Math.min(qty, def.stack-G.hotbar[i].qty);
      G.hotbar[i].qty+=add; qty-=add;
      if(qty<=0){ updateHotbar(); return; }
    }
  }
  for(let i=0;i<6 && qty>0;i++) if(!G.hotbar[i]){ const q=Math.min(qty,def.stack); G.hotbar[i]={id,qty:q}; qty-=q; }
  while(qty>0){
    let f=G.inv.find(s=>s.id===id && s.qty<def.stack);
    if(f){ const a=Math.min(qty,def.stack-f.qty); f.qty+=a; qty-=a; }
    else{ const q=Math.min(qty,def.stack); G.inv.push({id,qty:q}); qty-=q; }
  }
  updateHotbar();
}
function updateHotbar(){
  const hb=$('hotbar'); if(!hb) return;
  hb.innerHTML='';
  for(let i=0;i<6;i++){
    const s=document.createElement('div');
    s.className='slot'+(G.selected===i?' active':'');
    const it=G.hotbar[i];
    if(it){ const d=ITEMS[it.id]; s.innerHTML=`${d.icon}<span class="qty">${it.qty>1?it.qty:''}</span>`; }
    else s.textContent=i+1;
    hb.appendChild(s);
  }
}
function logEvent(msg){
  G.log.unshift(msg); if(G.log.length>7) G.log.pop();
  const el=$('eventLog'); if(el) el.innerHTML=G.log.map(m=>`<div>${m}</div>`).join('');
}

function tryUse(){
  const item=G.hotbar[G.selected];
  const tool=item && ITEMS[item.id]?.tool;
  if(tool==='wood' || !item){ addItem('wood', tool?8:3); AudioSys.hit(); logEvent('+Дерево'); }
  else if(tool==='stone'){ addItem('stone', tool?6:2); if(Math.random()<0.14) addItem('ore',1); if(Math.random()<0.08) addItem('ember',1); AudioSys.hit(); logEvent('+Камень'); }
}

function tryAttack(){
  if(player.weaponCd>0) return;
  player.weaponCd=0.45;
  AudioSys.shoot();
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const ray=new THREE.Raycaster(camera.position, dir, 0, 4);
  const hits=ray.intersectObjects(G.entities);
  if(hits.length){
    const e=hits[0].object;
    e.userData.hp -= 18;
    logEvent('Урон 18');
    if(e.userData.hp<=0){
      scene.remove(e);
      G.entities=G.entities.filter(x=>x!==e);
      addItem('cloth', 1+(Math.random()*2|0));
      logEvent('Добыча');
    }
  }
}

function toggleInv(){
  const p=$('inventoryPanel');
  if(!p) return;
  if(p.classList.contains('show')){ p.classList.remove('show'); G.state='GAME'; }
  else{
    const g=$('invGrid'); if(g){ g.innerHTML=''; for(let i=0;i<24;i++){ const s=document.createElement('div'); s.className='inv-slot'; const it=G.inv[i]; if(it){ const d=ITEMS[it.id]; s.innerHTML=`${d.icon}<br>${it.qty}`; } g.appendChild(s); } }
    p.classList.add('show'); G.state='INV'; document.exitPointerLock();
  }
}
function toggleCraft(){
  const p=$('craftPanel');
  if(!p) return;
  if(p.classList.contains('show')){ p.classList.remove('show'); G.state='GAME'; }
  else{
    const list=$('craftList');
    if(list){
      list.innerHTML='';
      const recipes=[{id:'axe',need:{wood:120,stone:40}},{id:'pick',need:{wood:100,stone:70}},{id:'spear',need:{wood:180,stone:30}},{id:'bandage',need:{cloth:4}}];
      recipes.forEach(r=>{
        const d=ITEMS[r.id]; if(!d) return;
        const btn=document.createElement('button'); btn.className='btn'; btn.style.textAlign='left';
        btn.textContent=`${d.icon} ${d.name}`;
        btn.onclick=()=>{
          let ok=true;
          for(const [k,v] of Object.entries(r.need)){
            const have=[...G.hotbar.filter(Boolean),...G.inv].filter(s=>s.id===k).reduce((a,s)=>a+s.qty,0);
            if(have<v) ok=false;
          }
          if(ok){ addItem(r.id); AudioSys.craft(); logEvent('Скрафтил '+d.name); }
          else logEvent('Мало ресурсов');
        };
        list.appendChild(btn);
      });
    }
    p.classList.add('show'); G.state='CRAFT'; document.exitPointerLock();
  }
}

function spawnAnimals(){
  const cols=[0xc0a070,0x5a4030,0x4a4a4a];
  for(let i=0;i<16;i++){
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.85,1.2), new THREE.MeshStandardMaterial({color:cols[i%3]}));
    const x=rand(-150,150), z=rand(-150,150);
    m.position.set(x, getHeight(x,z)+0.5, z);
    m.userData={hp:40+i%3*15, vx:0, vz:0, timer:0};
    m.visible=false;
    scene.add(m);
    G.entities.push(m);
  }
}

let last=performance.now(), frames=0, fpsT=0;

function loop(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  frames++; fpsT+=dt;
  if(fpsT>=0.5){
    G.fps=Math.round(frames/fpsT); frames=0; fpsT=0;
    const el=$('fps'); if(el){ el.textContent=G.fps+' FPS'; el.style.display=Save.data.settings.showFps?'block':'none'; }
  }

  if(G.state==='LOBBY' || G.state==='LOADING'){
    const t=now*0.00018;
    lobbyCam.position.set(Math.sin(t)*5.4, 2.15, Math.cos(t)*5.4+1.3);
    lobbyCam.lookAt(0,1.35,0);
    charGroup.rotation.y = Math.sin(now*0.0004)*0.18;
    renderer.render(scene, lobbyCam);
  } else if(G.state==='GAME' || G.state==='INV' || G.state==='CRAFT'){
    updateGame(dt, now);
    renderer.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}

function updateGame(dt, now){
  const sens = Save.data.settings.sens * 0.0021;
  player.yaw -= mouse.dx * sens;
  player.pitch -= mouse.dy * sens;
  player.pitch = clamp(player.pitch, -1.4, 1.4);
  mouse.dx = mouse.dy = 0;
  camera.rotation.order='YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  const speed = (player.sprint?7.4:4.1) * (player.crouch?0.42:1);
  let mx=0, mz=0;
  if(keys['KeyW']||keys['ArrowUp']) mz-=1;
  if(keys['KeyS']||keys['ArrowDown']) mz+=1;
  if(keys['KeyA']||keys['ArrowLeft']) mx-=1;
  if(keys['KeyD']||keys['ArrowRight']) mx+=1;
  if(isMobile){ mx+=joy.x; mz+=joy.y; }
  player.sprint = !!(keys['ShiftLeft']||keys['ShiftRight']);

  if(mx||mz){
    const l=Math.hypot(mx,mz); mx/=l; mz/=l;
    const sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
    player.vel.x = (mx*cos + mz*sin)*speed;
    player.vel.z = (-mx*sin + mz*cos)*speed;
    if(Math.random()<0.025) AudioSys.foot();
  } else {
    player.vel.x *= 0.78; player.vel.z *= 0.78;
  }

  player.vel.y -= 17.5*dt;
  player.pos.x += player.vel.x*dt;
  player.pos.z += player.vel.z*dt;
  player.pos.y += player.vel.y*dt;

  const gh = getHeight(player.pos.x, player.pos.z) + (player.crouch?1.15:1.72);
  if(player.pos.y < gh){ player.pos.y=gh; player.vel.y=0; player.onGround=true; }
  else player.onGround=false;
  if(keys['Space'] && player.onGround){ player.vel.y=7.4; player.onGround=false; }

  camera.position.copy(player.pos);

  G.player.hunger = Math.max(0, G.player.hunger - dt*0.28);
  G.player.thirst = Math.max(0, G.player.thirst - dt*0.4);
  if(G.player.hunger<=0 || G.player.thirst<=0) G.player.hp -= dt*1.6;
  if(G.player.hp<=0){ die('Истощение'); return; }
  if($('hpFill')) $('hpFill').style.width=G.player.hp+'%';
  if($('hungerFill')) $('hungerFill').style.width=G.player.hunger+'%';
  if($('thirstFill')) $('thirstFill').style.width=G.player.thirst+'%';

  for(let i=1;i<=6;i++) if(keys['Digit'+i]){ G.selected=i-1; updateHotbar(); keys['Digit'+i]=false; }
  if(keys['Tab']){ toggleInv(); keys['Tab']=false; }
  if(keys['KeyE']){ tryUse(); keys['KeyE']=false; }
  if(keys['KeyC']){ toggleCraft(); keys['KeyC']=false; }
  if(mouse.left) tryAttack();
  if(player.weaponCd>0) player.weaponCd-=dt;

  G.dayTime = (G.dayTime + dt*0.0065) % 1;
  const ang = G.dayTime*Math.PI*2 - Math.PI*0.5;
  sun.position.set(Math.cos(ang)*110, Math.sin(ang)*75, 35);
  const elev = Math.sin(ang);
  sun.intensity = Math.max(0.05, elev*1.45);
  const sky = new THREE.Color().setHSL(0.58, 0.48, clamp(0.11+elev*0.4, 0.06, 0.52));
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  amb.intensity = 0.16 + Math.max(0,elev)*0.35;

  G.entities.forEach(e=>{
    e.userData.timer -= dt;
    if(e.userData.timer<=0){ e.userData.vx=rand(-1.5,1.5); e.userData.vz=rand(-1.5,1.5); e.userData.timer=rand(2,6); }
    e.position.x += e.userData.vx*dt;
    e.position.z += e.userData.vz*dt;
    e.position.y = getHeight(e.position.x, e.position.z)+0.48;
  });

  if(G.water) G.water.position.y = -0.3 + Math.sin(now*0.001)*0.07;
  viewmodel.position.y = Math.sin(now*0.01)*0.012*(Math.hypot(player.vel.x,player.vel.z)>0.5?1:0.15) - 0.04;
}

function die(reason){
  G.state='DEATH';
  document.exitPointerLock();
  if($('deathReason')) $('deathReason').textContent=reason;
  if($('deathPanel')) $('deathPanel').classList.add('show');
  logEvent('Ты погиб');
}

function enterGame(){
  AudioSys.unlock(); AudioSys.ui();
  $('lobby').classList.remove('show');
  $('hud').classList.add('show');
  if(isMobile) $('mobileControls').style.display='block';

  if(G.terrain) G.terrain.visible=true;
  if(G.water) G.water.visible=true;
  if(G.trees) G.trees.visible=true;
  G.entities.forEach(e=>e.visible=true);
  charGroup.visible=false;
  lobbyGround.visible=false;

  G.state='GAME';
  spawnPlayer();
  camera.fov = Save.data.settings.fov || 75;
  camera.updateProjectionMatrix();
  if(!isMobile) canvas.requestPointerLock();
  logEvent('Добро пожаловать на Остров Пепла');
}

function setProgress(p){ const el=$('loadProgress'); if(el) el.style.width=p+'%'; }

async function init(){
  Save.load();
  AudioSys.init();
  setProgress(20);
  generateWorld(); setProgress(50);
  spawnAnimals(); setProgress(75);

  addItem('rock',1); addItem('wood',45); addItem('stone',30); addItem('cloth',8);
  updateHotbar();

  const day=new Date().toDateString();
  if(Save.data.daily!==day){ Save.data.daily=day; Save.data.coins+=80; Save.save(); if($('coins')) $('coins').textContent=Save.data.coins; }

  setProgress(100);
  setTimeout(()=>{
    if($('loading')) $('loading').classList.add('hide');
    if($('lobby')) $('lobby').classList.add('show');
    G.state='LOBBY';
    if($('onlineCount')) $('onlineCount').textContent='Онлайн: '+(84000+(Math.random()*12000|0));
  }, 400);

  if($('btnPlay')) $('btnPlay').onclick = enterGame;
  if($('btnCases')) $('btnCases').onclick = ()=>{ AudioSys.ui(); if($('roulettePanel')) $('roulettePanel').classList.add('show'); };
  if($('btnShop')) $('btnShop').onclick = ()=>logEvent('Магазин скоро');
  if($('btnDaily')) $('btnDaily').onclick = ()=>logEvent('Награды получены');
  if($('btnMissions')) $('btnMissions').onclick = ()=>logEvent('Миссии в разработке');
  if($('btnSkins')) $('btnSkins').onclick = ()=>logEvent('Скины: '+(Save.data.skins.length||0));
  if($('btnClans')) $('btnClans').onclick = ()=>logEvent('Кланы скоро');
  if($('btnInventoryLobby')) $('btnInventoryLobby').onclick = ()=>toggleInv();
  if($('btnSettings')) $('btnSettings').onclick = ()=>{ AudioSys.ui(); if($('settingsPanel')) $('settingsPanel').classList.add('show'); };
  if($('btnSettingsTop')) $('btnSettingsTop').onclick = ()=>{ AudioSys.ui(); if($('settingsPanel')) $('settingsPanel').classList.add('show'); };
  if($('btnExit')) $('btnExit').onclick = ()=>{ if(confirm('Выйти?')) window.close(); };

  document.querySelectorAll('[data-close]').forEach(b=>{
    b.onclick = ()=>{ const p=$(b.dataset.close); if(p) p.classList.remove('show'); if(G.state!=='LOBBY'&&G.state!=='LOADING') G.state='GAME'; };
  });

  document.querySelectorAll('[data-case]').forEach(b=>{
    b.onclick = ()=>{
      const cost={cheap:50,mid:200,high:800}[b.dataset.case]||50;
      if(Save.data.coins < cost){ logEvent('Недостаточно монет'); return; }
      Save.data.coins-=cost; if($('coins')) $('coins').textContent=Save.data.coins; Save.save();
      logEvent('Кейс открыт');
      AudioSys.craft();
    };
  });

  if($('btnRespawn')) $('btnRespawn').onclick=()=>{ if($('deathPanel')) $('deathPanel').classList.remove('show'); G.state='GAME'; spawnPlayer(player.pos.x+rand(-5,5),player.pos.z+rand(-5,5)); if(!isMobile) canvas.requestPointerLock(); };
  if($('btnRespawnRandom')) $('btnRespawnRandom').onclick=()=>{ if($('deathPanel')) $('deathPanel').classList.remove('show'); G.state='GAME'; spawnPlayer(); if(!isMobile) canvas.requestPointerLock(); };

  if($('setQuality')) $('setQuality').onchange=e=>{ Save.data.settings.quality=e.target.value; Save.save(); applyQuality(); };
  if($('setFov')) $('setFov').oninput=e=>{ Save.data.settings.fov=+e.target.value; camera.fov=+e.target.value; camera.updateProjectionMatrix(); Save.save(); };
  if($('setSens')) $('setSens').oninput=e=>{ Save.data.settings.sens=+e.target.value; Save.save(); };
  if($('setVol')) $('setVol').oninput=e=>{ Save.data.settings.vol=+e.target.value; AudioSys.setVol(+e.target.value); Save.save(); };
  if($('setFps')) $('setFps').onchange=e=>{ Save.data.settings.showFps=e.target.checked; Save.save(); };
  if($('btnReset')) $('btnReset').onclick=()=>{ if(confirm('Сбросить прогресс?')){ SafeStorage.removeItem('emberhold_v3'); location.reload(); } };

  applyQuality();
  requestAnimationFrame(loop);
}

function applyQuality(){
  const q=Save.data.settings.quality||'Medium';
  const pr=q==='Ultra'?1.7:q==='High'?1.35:q==='Medium'?1.15:1;
  renderer.setPixelRatio(Math.min(devicePixelRatio, pr));
  const size=q==='Low'?512:q==='Medium'?1024:1536;
  sun.shadow.mapSize.set(size,size);
}

window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  lobbyCam.aspect=innerWidth/innerHeight; lobbyCam.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

init().catch(err=>{
  console.error(err);
  if($('loading')) $('loading').innerHTML='<div style="color:#e05040;padding:20px;text-align:center">Ошибка<br>'+err.message+'</div>';
});
