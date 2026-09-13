import { Room, defineRoom, defineServer } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.PORT || 2567);
const GAME_HTML = readFileSync(new URL("./game.html", import.meta.url), "utf8");

const WORLD_W = 1728;
const WORLD_H = 972;
const MATCH_MS = 75_000;
const TICK_MS = 1000 / 30;
const SNAPSHOT_MS = 50;
const RESPAWN_MS = 2400;
const CENTER_X = WORLD_W / 2;
const CENTER_Y = WORLD_H / 2;

const SPAWNS = [
  { x: 180, y: 175 },
  { x: WORLD_W - 180, y: 175 },
  { x: 180, y: WORLD_H - 175 },
  { x: WORLD_W - 180, y: WORLD_H - 175 },
  { x: WORLD_W / 2, y: WORLD_H - 140 },
];

const HEROES = {
  blaster:     { hp:100, speed:230, damage:24, cooldown:340, accel:1050, passive:"steady", superType:"overdrive" },
  sprinter:    { hp:88,  speed:275, damage:19, cooldown:270, accel:1350, passive:"momentum", superType:"dash" },
  scholar:     { hp:108, speed:215, damage:23, cooldown:360, accel:900,  passive:"focus", superType:"shield" },
  hacker:      { hp:94,  speed:240, damage:22, cooldown:300, accel:1120, passive:"charge", superType:"emp" },
  historian:   { hp:112, speed:205, damage:26, cooldown:400, accel:820,  passive:"resolve", superType:"shockwave" },
  geographer:  { hp:106, speed:220, damage:23, cooldown:350, accel:930,  passive:"zone", superType:"survey" },
  chemist:     { hp:102, speed:218, damage:27, cooldown:410, accel:900,  passive:"corrosive", superType:"toxic" },
  artist:      { hp:94,  speed:238, damage:21, cooldown:290, accel:1180, passive:"evasion", superType:"sidestep" },
  musician:    { hp:96,  speed:235, damage:20, cooldown:280, accel:1150, passive:"rhythm", superType:"sonic" },
  guardian:    { hp:132, speed:188, damage:26, cooldown:430, accel:720,  passive:"armor", superType:"fortify" },
  phantom:     { hp:90,  speed:260, damage:22, cooldown:310, accel:1280, passive:"phase", superType:"blink" },
  captain:     { hp:118, speed:210, damage:25, cooldown:370, accel:850,  passive:"leader", superType:"rally" },
  sniper:      { hp:84,  speed:205, damage:36, cooldown:620, accel:820,  passive:"precision", superType:"rail" },
  medic:       { hp:104, speed:220, damage:19, cooldown:315, accel:940,  passive:"regen", superType:"heal" },
  engineer:    { hp:114, speed:205, damage:25, cooldown:390, accel:840,  passive:"repair", superType:"drone" },
  stormer:     { hp:100, speed:242, damage:22, cooldown:295, accel:1160, passive:"fury", superType:"storm" },
  illusionist: { hp:90,  speed:252, damage:21, cooldown:300, accel:1220, passive:"mirage", superType:"decoy" },
};

const WEAPONS = {
  school_blaster:{damage:23,cooldown:330,speed:1080,range:560,mag:8,reload:920,spread:.025,recoil:.16,radius:9},
  pulse_smg:{damage:15,cooldown:145,speed:1220,range:470,mag:18,reload:1080,spread:.070,recoil:.095,radius:8},
  prism_rifle:{damage:27,cooldown:390,speed:1380,range:660,mag:7,reload:1230,spread:.018,recoil:.20,radius:8},
  marker_blaster:{damage:20,cooldown:255,speed:930,range:510,mag:11,reload:960,spread:.045,recoil:.13,radius:10},
  laser_ruler:{damage:32,cooldown:520,speed:1580,range:760,mag:6,reload:1380,spread:.010,recoil:.24,radius:7}
};
const BOT_LEVELS={
  easy:{aim:.42,fireMul:2.15,speed:.76,damage:.58,react:520,superChance:.22,cover:.75},
  normal:{aim:.24,fireMul:1.48,speed:.88,damage:.74,react:300,superChance:.52,cover:.55},
  hard:{aim:.12,fireMul:1.14,speed:.96,damage:.88,react:180,superChance:.74,cover:.38}
};
const MODES={
  clash:{label:"CLASH",max:5,respawn:true,zone:1,ko:5},
  control:{label:"КОНТРОЛЬ ДЗВОНУ",max:5,respawn:true,zone:3,ko:2},
  team2v2:{label:"КОМАНДНИЙ 2v2",max:4,respawn:true,zone:1,ko:5,teams:true},
  last:{label:"ОСТАННІЙ УЧЕНЬ",max:5,respawn:false,zone:0,ko:10}
};
const PERKS={
  assault:{label:"Штурм",superGain:1.05},
  agile:{label:"Маневр",speed:1.025},
  guard:{label:"Захист",damageTaken:.97},
  focus:{label:"Фокус",spread:.94}
};
const ENERGY_PADS=[
  {x:CENTER_X-310,y:CENTER_Y},{x:CENTER_X+310,y:CENTER_Y},
  {x:CENTER_X,y:CENTER_Y-250},{x:CENTER_X,y:CENTER_Y+250}
];

function weaponIdOf(a){
  const w=String(a?.weapon||"school_blaster").toLowerCase();
  if(w.includes("smg"))return "pulse_smg";
  if(w.includes("rifle"))return "prism_rifle";
  if(w.includes("marker"))return "marker_blaster";
  if(w.includes("ruler"))return "laser_ruler";
  return WEAPONS[w]?w:"school_blaster";
}
function weaponSpec(a){return WEAPONS[weaponIdOf(a)]||WEAPONS.school_blaster}


const MAP_SCALE = 1.35;
const basePoint = (p) => ({ x: Math.round(p.x * MAP_SCALE), y: Math.round(p.y * MAP_SCALE) });
const baseRect = (o) => ({ x: Math.round(o.x * MAP_SCALE), y: Math.round(o.y * MAP_SCALE), w: Math.round(o.w * MAP_SCALE), h: Math.round(o.h * MAP_SCALE), type:o.type||"block" });

const MAPS_BASE = {
  hall:{
    name:"Центральний хол",icon:"🏫",floor:"#07111f",line:"#17345b",accent:"#38bdf8",
    spawns:[{x:190,y:360},{x:640,y:120},{x:1090,y:360},{x:310,y:610},{x:970,y:610}],
    obstacles:[
      {x:174,y:156,w:154,h:58,type:"desk"},{x:415,y:118,w:70,h:132,type:"books"},
      {x:952,y:154,w:154,h:58,type:"maptable"},{x:795,y:112,w:70,h:132,type:"globe"},
      {x:174,y:508,w:164,h:60,type:"labtable"},{x:420,y:466,w:72,h:126,type:"lab"},
      {x:942,y:506,w:164,h:58,type:"bench"},{x:790,y:474,w:74,h:116,type:"rack"},
      {x:566,y:106,w:148,h:50,type:"hall"},{x:566,y:566,w:148,h:50,type:"hall"}
    ]
  },
  library:{
    name:"Велика бібліотека",icon:"📚",floor:"#100c0b",line:"#4a2c20",accent:"#fbbf24",
    spawns:[{x:180,y:560},{x:640,y:105},{x:1100,y:560},{x:200,y:150},{x:1080,y:150}],
    obstacles:[
      {x:420,y:90,w:84,h:216,type:"books"},{x:776,y:90,w:84,h:216,type:"books"},
      {x:420,y:414,w:84,h:216,type:"books"},{x:776,y:414,w:84,h:216,type:"books"},
      {x:545,y:188,w:190,h:54,type:"desk"},{x:545,y:478,w:190,h:54,type:"desk"},
      {x:168,y:330,w:180,h:54,type:"desk"},{x:932,y:330,w:180,h:54,type:"desk"}
    ]
  },
  gym:{
    name:"Спортзал",icon:"🏀",floor:"#160d08",line:"#6b371f",accent:"#fb923c",
    spawns:[{x:150,y:360},{x:640,y:100},{x:1130,y:360},{x:350,y:610},{x:930,y:610}],
    obstacles:[
      {x:150,y:92,w:110,h:54,type:"bench"},{x:1020,y:574,w:110,h:54,type:"bench"},
      {x:352,y:82,w:70,h:150,type:"rack"},{x:858,y:488,w:70,h:150,type:"rack"},
      {x:470,y:230,w:74,h:74,type:"ballrack"},{x:736,y:416,w:74,h:74,type:"ballrack"}
    ]
  },
  lab:{
    name:"Науковий корпус",icon:"🧪",floor:"#061213",line:"#104b4b",accent:"#34d399",
    spawns:[{x:170,y:145},{x:1110,y:145},{x:640,y:610},{x:180,y:585},{x:1100,y:585}],
    obstacles:[
      {x:470,y:95,w:120,h:88,type:"labtable"},{x:690,y:95,w:120,h:88,type:"labtable"},
      {x:470,y:537,w:120,h:88,type:"labtable"},{x:690,y:537,w:120,h:88,type:"labtable"},
      {x:205,y:285,w:145,h:62,type:"lab"},{x:930,y:285,w:145,h:62,type:"lab"},
      {x:555,y:300,w:170,h:120,type:"reactor"}
    ]
  },
  yard:{
    name:"Шкільне подвір’я",icon:"🌳",floor:"#0c1e18",line:"#2b5f4a",accent:"#4ade80",
    spawns:[{x:170,y:570},{x:640,y:95},{x:1110,y:570},{x:180,y:135},{x:1100,y:135}],
    obstacles:[
      {x:430,y:110,w:90,h:160,type:"planter"},{x:760,y:110,w:90,h:160,type:"planter"},
      {x:430,y:450,w:90,h:160,type:"planter"},{x:760,y:450,w:90,h:160,type:"planter"},
      {x:188,y:330,w:150,h:50,type:"bench"},{x:942,y:330,w:150,h:50,type:"bench"},
      {x:570,y:290,w:140,h:140,type:"fountain"}
    ]
  },
  museum:{
    name:"Галерея історії",icon:"🏛️",floor:"#120d0a",line:"#5b3a2c",accent:"#f59e0b",
    spawns:[{x:145,y:360},{x:640,y:100},{x:1135,y:360},{x:330,y:610},{x:950,y:610}],
    obstacles:[
      {x:460,y:90,w:92,h:180,type:"display"},{x:728,y:90,w:92,h:180,type:"display"},
      {x:460,y:450,w:92,h:180,type:"display"},{x:728,y:450,w:92,h:180,type:"display"},
      {x:565,y:180,w:150,h:54,type:"desk"},{x:565,y:486,w:150,h:54,type:"desk"},
      {x:190,y:325,w:140,h:52,type:"column"},{x:950,y:325,w:140,h:52,type:"column"}
    ]
  },
  media:{
    name:"Медіацентр",icon:"🎬",floor:"#080d18",line:"#243b66",accent:"#22d3ee",
    spawns:[{x:175,y:580},{x:640,y:100},{x:1105,y:580},{x:190,y:145},{x:1090,y:145}],
    obstacles:[
      {x:462,y:105,w:100,h:165,type:"screen"},{x:718,y:105,w:100,h:165,type:"screen"},
      {x:462,y:450,w:100,h:165,type:"server"},{x:718,y:450,w:100,h:165,type:"server"},
      {x:565,y:212,w:150,h:54,type:"desk"},{x:565,y:454,w:150,h:54,type:"desk"}
    ]
  },
  auditorium:{
    name:"Актова зала",icon:"🎭",floor:"#100812",line:"#5b1d37",accent:"#fb7185",
    spawns:[{x:145,y:550},{x:640,y:95},{x:1135,y:550},{x:170,y:150},{x:1110,y:150}],
    obstacles:[
      {x:410,y:118,w:110,h:70,type:"speaker"},{x:760,y:118,w:110,h:70,type:"speaker"},
      {x:450,y:510,w:90,h:90,type:"seat"},{x:580,y:510,w:90,h:90,type:"seat"},{x:710,y:510,w:90,h:90,type:"seat"},
      {x:120,y:390,w:150,h:52,type:"curtain"},{x:1010,y:390,w:150,h:52,type:"curtain"}
    ]
  }
};

const MAPS = Object.fromEntries(Object.entries(MAPS_BASE).map(([id,m])=>[id,{
  ...m,
  spawns:m.spawns.map(basePoint),
  obstacles:m.obstacles.map(baseRect)
}]));


function clamp(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }
function clean(v, max = 24) { return String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max); }
function heroSpec(id) { return HEROES[id] || HEROES.blaster; }
function normalize(dx,dy){
  dx=clamp(dx,-1,1); dy=clamp(dy,-1,1);
  const m=Math.hypot(dx,dy);
  if(m>1){dx/=m;dy/=m;}
  return {dx,dy};
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function circleRectPush(x,y,r,o){
  const nx=clamp(x,o.x,o.x+o.w), ny=clamp(y,o.y,o.y+o.h);
  const dx=x-nx, dy=y-ny, d=Math.hypot(dx,dy);
  if(d>=r || d===0){
    if(d!==0 || !(x>o.x-r&&x<o.x+o.w+r&&y>o.y-r&&y<o.y+o.h+r)) return {x,y};
  }
  if(d>0){
    const push=r-d;
    return {x:x+dx/d*push,y:y+dy/d*push};
  }
  const left=Math.abs(x-o.x), right=Math.abs(o.x+o.w-x), top=Math.abs(y-o.y), bottom=Math.abs(o.y+o.h-y);
  const m=Math.min(left,right,top,bottom);
  if(m===left)return{x:o.x-r,y};
  if(m===right)return{x:o.x+o.w+r,y};
  if(m===top)return{x,y:o.y-r};
  return{x,y:o.y+o.h+r};
}
function resolveMove(x,y,r,mapId){
  x=clamp(x,r,WORLD_W-r); y=clamp(y,r,WORLD_H-r);
  const obs=(MAPS[mapId]||MAPS.hall).obstacles;
  for(const o of obs){
    const p=circleRectPush(x,y,r,o); x=p.x; y=p.y;
  }
  return {x,y};
}
function rayHit(shooter,target,angle,range,width){
  const ux=Math.cos(angle), uy=Math.sin(angle);
  const vx=target.x-shooter.x, vy=target.y-shooter.y;
  const along=vx*ux+vy*uy;
  if(along<=0||along>range)return null;
  const perp=Math.abs(vx*uy-vy*ux);
  if(perp>width)return null;
  return {along,perp};
}

class LyceumClashRoom extends Room {
  maxClients = 5;
  autoDispose = true;

  async onCreate(){
    this.roomId=await this.generateRoomCode();
    this.phase="lobby";
    this.players=new Map();
    this.bots=new Map();
    this.projectiles=new Map();
    this.hostSessionId="";
    this.startedAt=0;
    this.endsAt=0;
    this.round=0;
    this.mapId="hall";
    this.botFill=true;
    this.botDifficulty="normal";
    this.mode="clash";
    this.mapEvent={lightsOut:false,doorsOpen:true,coverX:CENTER_X,phase:0};
    this.nextMapEventAt=0;
    this.objectiveClock=0;
    this.passiveClock=0;
    this.botCounter=0;
    this.projectileCounter=0;
    this.bellRush=false;

    this.onMessage("start",(client)=>this.startMatch(client));
    this.onMessage("input",(client,data)=>this.handleInput(client,data));
    this.onMessage("shoot",(client,data)=>this.handleShoot(client,data));
    this.onMessage("super",(client)=>this.handleSuper(client));
    this.onMessage("hero",(client,data)=>this.setHero(client,data));
    this.onMessage("map",(client,data)=>this.setMap(client,data));
    this.onMessage("bots",(client,data)=>this.setBots(client,data));
    this.onMessage("botDifficulty",(client,data)=>this.setBotDifficulty(client,data));
    this.onMessage("mode",(client,data)=>this.setMode(client,data));
    this.onMessage("ready",(client,data)=>this.setReady(client,data));
    this.onMessage("rematch",(client)=>this.rematch(client));
    this.onMessage("ping",(client,data)=>client.send("pong",{t:data?.t||Date.now(),serverNow:Date.now()}));

    this.clock.setInterval(()=>this.tick(),TICK_MS);
    this.clock.setInterval(()=>this.snapshot(),SNAPSHOT_MS);
  }

  async generateRoomCode(){
    const channel="$lyceum-clash-room-codes";
    const alphabet="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const existing=await this.presence.smembers(channel);
    let code="";
    do{
      code="";
      for(let i=0;i<5;i++)code+=alphabet[Math.floor(Math.random()*alphabet.length)];
    }while(existing.includes(code));
    await this.presence.sadd(channel,code);
    return code;
  }

  async onDispose(){
    try{await this.presence.srem("$lyceum-clash-room-codes",this.roomId)}catch(_){}
  }

  initCombatState(a){
    const ws=weaponSpec(a);
    a.vx=0;a.vy=0;
    a.ammo=ws.mag;
    a.reloadUntil=0;
    a.shieldUntil=0;
    a.damageBoostUntil=0;
    a.speedBoostUntil=0;
    a.stunnedUntil=0;
    a.invulnerableUntil=0;
    a.lastHitAt=0;
    a.padCooldownUntil=0;
    a.lastShotAt=0;
    a.recoil=0;
    a.lastPadAt=0;
  }

  onJoin(client,options={}){
    if(this.phase!=="lobby")throw new Error("MATCH_ALREADY_STARTED");

    const used=new Set([...this.players.values()].map(p=>p.slot));
    const roomMax=MODES[this.mode]?.max||5;
    let slot=0;while(used.has(slot)&&slot<roomMax)slot++;
    if(slot>=roomMax)throw new Error("ROOM_FULL");

    const isFirst=!this.hostSessionId;
    if(isFirst)this.hostSessionId=client.sessionId;
    const hero=HEROES[options.hero]?options.hero:"blaster";
    const spec=heroSpec(hero);
    const sp=(MAPS[this.mapId]||MAPS.hall).spawns[slot]||SPAWNS[slot];
    const p={
      id:client.sessionId,sessionId:client.sessionId,isBot:false,
      name:clean(options.name||("Учень "+(slot+1)))||("Учень "+(slot+1)),
      hero,
      skin:clean(options.skin||"student",24),
      weapon:clean(options.weapon||"school_blaster",28),
      weaponSkin:clean(options.weaponSkin||"default",24),
      perk:PERKS[clean(options.perk||"assault",20)]?clean(options.perk||"assault",20):"assault",
      shotEffect:clean(options.shotEffect||"classic",24),
      koEffect:clean(options.koEffect||"burst",24),
      frame:clean(options.frame||"none",24),
      trail:clean(options.trail||"none",24),
      ready:isFirst,team:slot%2,
      slot,x:sp.x,y:sp.y,angle:0,
      hp:spec.hp,maxHp:spec.hp,alive:true,score:0,deaths:0,super:0,
      respawnAt:0,input:{dx:0,dy:0,seq:0},
      kills:0,damageDone:0,controlSeconds:0,shots:0,hits:0
    };
    this.initCombatState(p);
    this.players.set(client.sessionId,p);

    client.send("room_ready",{
      code:this.roomId,sessionId:client.sessionId,hostSessionId:this.hostSessionId,
      world:{width:WORLD_W,height:WORLD_H}
    });
    this.broadcastLobby();
    this.snapshot();
  }

  onLeave(client){
    this.players.delete(client.sessionId);
    if(client.sessionId===this.hostSessionId){
      this.hostSessionId=this.players.keys().next().value||"";
      if(this.hostSessionId){const nh=this.players.get(this.hostSessionId);if(nh)nh.ready=true;this.broadcast("host_changed",{hostSessionId:this.hostSessionId});}
    }
    this.broadcastLobby();
  }

  actors(){return [...this.players.values(),...this.bots.values()]}

  setHero(client,data={}){
    if(this.phase!=="lobby")return;
    const p=this.players.get(client.sessionId);if(!p)return;
    const id=String(data.hero||"");if(!HEROES[id])return;
    p.hero=id;p.maxHp=heroSpec(id).hp;p.hp=p.maxHp;this.initCombatState(p);
    this.broadcastLobby();
  }

  setMap(client,data={}){
    if(client.sessionId!==this.hostSessionId||this.phase!=="lobby")return;
    const id=String(data.map||"");if(!MAPS[id])return;
    this.mapId=id;this.broadcastLobby();
  }

  setBots(client,data={}){
    if(client.sessionId!==this.hostSessionId||this.phase!=="lobby")return;
    this.botFill=data.enabled!==false;this.broadcastLobby();
  }

  setBotDifficulty(client,data={}){
    if(client.sessionId!==this.hostSessionId||this.phase!=="lobby")return;
    const level=String(data.level||"normal");
    if(!BOT_LEVELS[level])return;
    this.botDifficulty=level;this.broadcastLobby();
  }

  setMode(client,data={}){
    if(client.sessionId!==this.hostSessionId||this.phase!=="lobby")return;
    const mode=String(data.mode||"clash");if(!MODES[mode])return;
    if(this.players.size>MODES[mode].max){client.send("server_error",{code:"MODE_FULL",message:"Для цього режиму забагато гравців у кімнаті."});return}
    this.mode=mode;
    for(const p of this.players.values()){p.team=p.slot%2;p.ready=p.sessionId===this.hostSessionId}
    this.broadcastLobby();
  }

  setReady(client,data={}){
    if(this.phase!=="lobby")return;const p=this.players.get(client.sessionId);if(!p)return;
    p.ready=data.ready!==false;this.broadcastLobby();
  }

  rematch(client){
    if(client.sessionId!==this.hostSessionId||this.phase!=="finished")return;
    this.phase="lobby";this.unlock();this.bots.clear();this.projectiles.clear();
    for(const p of this.players.values())p.ready=p.sessionId===this.hostSessionId;
    this.broadcastLobby();this.snapshot();
    this.clock.setTimeout(()=>{if(this.phase==="lobby"&&this.players.has(client.sessionId))this.startMatch(client,true)},450);
  }

  dynamicObstacles(now=Date.now()){
    const out=[];
    const phase=(now-(this.startedAt||now))/1800;
    const coverX=CENTER_X-95+Math.sin(phase)*260;
    this.mapEvent.coverX=coverX;
    out.push({x:coverX,y:CENTER_Y-285,w:190,h:38,type:"moving_cover"});
    if(!this.mapEvent.doorsOpen){
      out.push({x:CENTER_X-22,y:135,w:44,h:150,type:"door"});
      out.push({x:CENTER_X-22,y:WORLD_H-285,w:44,h:150,type:"door"});
    }
    if(this.bellRush){
      out.push({x:CENTER_X-315,y:CENTER_Y-22,w:105,h:44,type:"temp_cover"});
      out.push({x:CENTER_X+210,y:CENTER_Y-22,w:105,h:44,type:"temp_cover"});
    }
    return out;
  }

  resolveRoomMove(x,y,r,now=Date.now()){
    let p=resolveMove(x,y,r,this.mapId);
    for(const o of this.dynamicObstacles(now)){p=circleRectPush(p.x,p.y,r,o)}
    return p;
  }

  broadcastLobby(){
    this.broadcast("lobby",{
      code:this.roomId,phase:this.phase,hostSessionId:this.hostSessionId,
      map:this.mapId,botFill:this.botFill,botDifficulty:this.botDifficulty,mode:this.mode,maxPlayers:MODES[this.mode].max,
      players:[...this.players.values()].sort((a,b)=>a.slot-b.slot).map(p=>({
        sessionId:p.sessionId,name:p.name,hero:p.hero,slot:p.slot,team:p.team,ready:!!p.ready,
        skin:p.skin,weapon:p.weapon,weaponSkin:p.weaponSkin,frame:p.frame
      }))
    });
  }

  fillBots(){
    this.bots.clear();
    if(!this.botFill)return;
    const used=new Set([...this.players.values()].map(p=>p.slot));
    const botNames=["Nova","Vector","Pixel","Flash","Orbit"];
    const botHeroes=["sprinter","guardian","historian","chemist","sniper","phantom","stormer","engineer"];
    let n=0;
    const maxActors=MODES[this.mode].max;
    for(let slot=0;slot<maxActors;slot++){
      if(used.has(slot))continue;
      const id="BOT_"+(++this.botCounter);
      const hero=botHeroes[(slot+this.round)%botHeroes.length];
      const spec=heroSpec(hero);
      const sp=(MAPS[this.mapId]||MAPS.hall).spawns[slot]||SPAWNS[slot];
      const b={
        id,sessionId:id,isBot:true,name:"BOT "+botNames[n++%botNames.length],
        hero,skin:["student","hoodie","varsity","sport","cyber"][slot%5],
        weapon:["school_blaster","pulse_smg","prism_rifle","marker_blaster","laser_ruler"][slot%5],
        weaponSkin:["default","neon","gold","frost","shadow"][slot%5],
        perk:["assault","agile","guard","focus"][slot%4],shotEffect:["classic","spark","plasma","pixel"][slot%4],koEffect:["burst","stars","glitch"][slot%3],frame:"none",trail:["none","gold","lightning"][slot%3],team:slot%2,ready:true,
        slot,x:sp.x,y:sp.y,angle:0,hp:spec.hp,maxHp:spec.hp,
        alive:true,score:0,deaths:0,super:0,respawnAt:0,input:{dx:0,dy:0,seq:0},
        kills:0,damageDone:0,controlSeconds:0,shots:0,hits:0,
        targetId:"",targetSwitchAt:0,brainAt:0
      };
      this.initCombatState(b);
      this.bots.set(id,b);
    }
  }

  startMatch(client,force=false){
    if(client.sessionId!==this.hostSessionId){
      client.send("server_error",{code:"NOT_HOST",message:"Лише HOST може почати матч."});return;
    }
    if(this.phase!=="lobby")return;
    if(!force){
      const waiting=[...this.players.values()].filter(p=>p.sessionId!==this.hostSessionId&&!p.ready);
      if(waiting.length){client.send("server_error",{code:"NOT_READY",message:"Не всі гравці натиснули ГОТОВИЙ."});return}
    }

    this.round+=1;this.phase="countdown";this.startedAt=Date.now()+1300;this.endsAt=this.startedAt+MATCH_MS;
    this.objectiveClock=0;this.passiveClock=0;this.bellRush=false;this.projectiles.clear();
    this.mapEvent={lightsOut:false,doorsOpen:true,coverX:CENTER_X,phase:0};this.nextMapEventAt=this.startedAt+11000;
    this.fillBots();

    for(const a of this.actors()){
      const sp=(MAPS[this.mapId]||MAPS.hall).spawns[a.slot]||SPAWNS[a.slot]||SPAWNS[0],spec=heroSpec(a.hero);
      a.x=sp.x;a.y=sp.y;a.angle=0;a.maxHp=spec.hp;a.hp=spec.hp;a.alive=true;a.score=0;a.deaths=0;a.super=0;a.respawnAt=0;
      a.input={dx:0,dy:0,seq:0};a.kills=0;a.damageDone=0;a.controlSeconds=0;a.shots=0;a.hits=0;a.team=a.slot%2;this.initCombatState(a);
    }

    this.lock();
    this.broadcast("match_started",{
      startedAt:this.startedAt,endsAt:this.endsAt,durationMs:MATCH_MS,round:this.round,
      map:this.mapId,botCount:this.bots.size,botDifficulty:this.botDifficulty,mode:this.mode
    });
    this.snapshot();
  }

  handleInput(client,data={}){
    const p=this.players.get(client.sessionId);if(!p)return;
    const v=normalize(data.dx,data.dy);
    p.input={dx:v.dx,dy:v.dy,seq:Math.max(0,Number(data.seq)||0)};
    if(Number.isFinite(Number(data.angle)))p.angle=Number(data.angle);
  }

  startReload(a,now=Date.now()){
    const ws=weaponSpec(a);
    if(a.reloadUntil>now)return;
    a.reloadUntil=now+ws.reload;
    this.broadcast("reload",{by:a.id,weapon:weaponIdOf(a),until:a.reloadUntil});
  }

  finishReload(a,now){
    if(a.reloadUntil&&now>=a.reloadUntil){
      a.reloadUntil=0;a.ammo=weaponSpec(a).mag;
    }
  }

  createProjectile(shooter,angle,damage,ws,{isSuper=false,speedMul=1,rangeMul=1,radiusMul=1}={}){
    const id="P_"+(++this.projectileCounter);
    const speed=ws.speed*speedMul,range=ws.range*rangeMul;
    const p={
      id,ownerId:shooter.id,isBot:!!shooter.isBot,hero:shooter.hero,weapon:weaponIdOf(shooter),
      x:shooter.x+Math.cos(angle)*30,y:shooter.y+Math.sin(angle)*30,angle,
      vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,speed,remaining:range,travelled:0,
      damage,radius:ws.radius*radiusMul,isSuper,bornAt:Date.now()
    };
    this.projectiles.set(id,p);
    return p;
  }

  shootActor(shooter,angle){
    if(this.phase!=="playing"||!shooter||!shooter.alive)return;
    const now=Date.now();this.finishReload(shooter,now);
    if(shooter.stunnedUntil>now||shooter.reloadUntil>now)return;

    const hs=heroSpec(shooter.hero),ws=weaponSpec(shooter),bot=shooter.isBot?BOT_LEVELS[this.botDifficulty]:null;
    if(shooter.ammo<=0){this.startReload(shooter,now);return}

    let cooldown=ws.cooldown;
    if(shooter.hero==="musician"&&Math.hypot(shooter.input.dx,shooter.input.dy)>.2)cooldown*=.86;
    if(shooter.hero==="stormer"&&shooter.hp<shooter.maxHp*.42)cooldown*=.82;
    if(bot)cooldown*=bot.fireMul;
    if(now-shooter.lastShotAt<cooldown)return;

    let spread=ws.spread;
    if(shooter.hero==="blaster")spread*=.55;
    if(shooter.hero==="sniper")spread*=.50;
    if(shooter.perk==="focus")spread*=PERKS.focus.spread;
    if(bot)spread+=bot.aim;
    angle+=(Math.random()-.5)*spread*2;

    let damage=ws.damage*(hs.damage/24);
    if(shooter.hero==="chemist")damage*=1.08;
    if(shooter.hero==="stormer"&&shooter.hp<shooter.maxHp*.42)damage*=1.14;
    if(shooter.damageBoostUntil>now)damage*=1.22;
    if(bot)damage*=bot.damage;
    damage=Math.max(6,Math.round(damage));

    shooter.lastShotAt=now;shooter.angle=angle;shooter.ammo-=1;shooter.shots=(Number(shooter.shots)||0)+1;
    const projectile=this.createProjectile(shooter,angle,damage,ws);
    this.broadcast("shot",{
      by:shooter.id,isBot:!!shooter.isBot,x:projectile.x,y:projectile.y,angle,
      weapon:weaponIdOf(shooter),speed:ws.speed,range:ws.range,recoil:ws.recoil,
      ammo:shooter.ammo,mag:ws.mag,at:now
    });

    if(shooter.ammo<=0)this.startReload(shooter,now);
  }

  handleShoot(client,data={}){
    const p=this.players.get(client.sessionId);if(!p)return;
    const angle=Number.isFinite(Number(data.angle))?Number(data.angle):p.angle;
    this.shootActor(p,angle);
  }

  segmentHitsObstacle(x1,y1,x2,y2,radius){
    const obs=[...(MAPS[this.mapId]||MAPS.hall).obstacles,...this.dynamicObstacles()];
    const d=Math.hypot(x2-x1,y2-y1),steps=Math.max(1,Math.ceil(d/16));
    for(let i=1;i<=steps;i++){
      const t=i/steps,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;
      for(const o of obs){
        if(x>o.x-radius&&x<o.x+o.w+radius&&y>o.y-radius&&y<o.y+o.h+radius)return true;
      }
    }
    return false;
  }

  updateProjectiles(dt){
    const now=Date.now();
    for(const [id,p] of [...this.projectiles]){
      const step=Math.min(p.remaining,p.speed*dt);
      const nx=p.x+Math.cos(p.angle)*step,ny=p.y+Math.sin(p.angle)*step;
      if(this.segmentHitsObstacle(p.x,p.y,nx,ny,p.radius)){
        this.broadcast("impact",{id,x:p.x,y:p.y,kind:"wall",weapon:p.weapon});
        this.projectiles.delete(id);continue;
      }

      let hit=null;
      const samples=Math.max(1,Math.ceil(step/14));
      for(let s=1;s<=samples&&!hit;s++){
        const tt=s/samples,sx=p.x+(nx-p.x)*tt,sy=p.y+(ny-p.y)*tt;
        for(const a of this.actors()){
          if(a.id===p.ownerId||!a.alive||a.invulnerableUntil>now)continue;
          if(Math.hypot(a.x-sx,a.y-sy)<=23+p.radius){hit=a;break}
        }
      }

      p.travelled+=step;p.remaining-=step;p.x=nx;p.y=ny;
      if(hit){
        const owner=this.actors().find(a=>a.id===p.ownerId);
        if(owner){
          let dmg=p.damage;
          if(owner.hero==="sniper"&&p.travelled>420)dmg=Math.round(dmg*1.16);
          this.damageActor(owner,hit,dmg,p.isSuper);
        }
        this.broadcast("impact",{id,x:p.x,y:p.y,kind:"actor",target:hit.id,weapon:p.weapon});
        this.projectiles.delete(id);continue;
      }
      if(p.remaining<=0)this.projectiles.delete(id);
    }
  }

  damageActor(attacker,target,damage,isSuper=false){
    if(!target?.alive)return false;
    if(this.mode==="team2v2"&&attacker?.team===target?.team)return false;
    const now=Date.now();
    if(target.invulnerableUntil>now)return false;

    const dodgeChance=target.hero==="artist"?.10:target.hero==="phantom"?.08:target.hero==="illusionist"?.12:0;
    if(dodgeChance&&Math.random()<dodgeChance){
      this.broadcast("dodge",{target:target.id,x:target.x,y:target.y});return false;
    }

    let taken=damage;
    if(target.hero==="guardian")taken*=.84;
    if(target.hero==="historian"&&target.hp<target.maxHp*.42)taken*=.84;
    if(target.shieldUntil>now)taken*=.60;
    if(target.perk==="guard")taken*=PERKS.guard.damageTaken;
    taken=Math.max(1,Math.round(taken));

    target.hp=Math.max(0,target.hp-taken);target.lastHitAt=now;
    const superGain=attacker.hero==="scholar"?30:attacker.hero==="hacker"?27:22;
    const perkGain=attacker.perk==="assault"?PERKS.assault.superGain:1;
    attacker.super=clamp(attacker.super+(isSuper?6:superGain)*perkGain,0,100);
    attacker.damageDone=(Number(attacker.damageDone)||0)+taken;attacker.hits=(Number(attacker.hits)||0)+1;

    this.broadcast("hit",{by:attacker.id,target:target.id,damage:taken,hp:target.hp,maxHp:target.maxHp,superHit:isSuper});

    if(target.hp<=0){
      target.alive=false;target.deaths+=1;target.respawnAt=now+RESPAWN_MS;target.vx=0;target.vy=0;
      attacker.kills=(Number(attacker.kills)||0)+1;
      attacker.score+=MODES[this.mode].ko;attacker.super=clamp(attacker.super+16,0,100);
      this.broadcast("ko",{by:attacker.id,target:target.id,score:attacker.score,respawnAt:target.respawnAt});
    }
    return true;
  }

  moveInstant(a,distance,angle){
    const p=this.resolveRoomMove(a.x+Math.cos(angle)*distance,a.y+Math.sin(angle)*distance,25);
    a.x=p.x;a.y=p.y;a.vx=0;a.vy=0;
  }

  radialDamage(a,radius,damage){
    let hits=0;
    for(const t of this.actors()){
      if(t.id===a.id||!t.alive)continue;
      if(dist(a,t)<=radius&&this.damageActor(a,t,damage,true))hits++;
    }
    return hits;
  }

  activateSuper(a){
    if(!a||!a.alive||a.super<100||this.phase!=="playing")return;
    const now=Date.now();a.super=0;
    let type=heroSpec(a.hero).superType;

    if(type==="overdrive"){
      a.damageBoostUntil=now+5000;a.speedBoostUntil=now+5000;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="dash"){
      this.moveInstant(a,310,a.angle);a.invulnerableUntil=now+550;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="shield"){
      a.shieldUntil=now+5200;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="emp"){
      let hits=0;
      for(const t of this.actors()){if(t.id!==a.id&&t.alive&&dist(a,t)<=285){t.stunnedUntil=now+1500;this.damageActor(a,t,10,true);hits++}}
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y,hits});
    }else if(type==="shockwave"){
      const hits=this.radialDamage(a,245,36);this.broadcast("super",{by:a.id,type,x:a.x,y:a.y,hits});
    }else if(type==="survey"){
      a.speedBoostUntil=now+5000;a.score+=2;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="toxic"){
      const hits=this.radialDamage(a,265,28);this.broadcast("super",{by:a.id,type,x:a.x,y:a.y,hits});
    }else if(type==="sidestep"){
      this.moveInstant(a,240,a.angle+Math.PI/2);a.invulnerableUntil=now+800;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="sonic"){
      const hits=this.radialDamage(a,270,23);a.speedBoostUntil=now+3800;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y,hits});
    }else if(type==="fortify"){
      a.hp=Math.min(a.maxHp,a.hp+Math.round(a.maxHp*.45));a.shieldUntil=now+4300;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="blink"){
      this.moveInstant(a,330,a.angle);a.invulnerableUntil=now+950;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="rally"){
      a.hp=Math.min(a.maxHp,a.hp+Math.round(a.maxHp*.24));a.damageBoostUntil=now+4500;a.speedBoostUntil=now+4500;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="rail"){
      const ws={...weaponSpec(a),damage:60,speed:1850,range:930,radius:11};
      this.createProjectile(a,a.angle,60,ws,{isSuper:true});
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y,angle:a.angle});
    }else if(type==="heal"){
      a.hp=Math.min(a.maxHp,a.hp+Math.round(a.maxHp*.62));a.shieldUntil=now+1800;
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="drone"){
      const ws=weaponSpec(a);
      [-.14,0,.14].forEach(off=>this.createProjectile(a,a.angle+off,26,ws,{isSuper:true,speedMul:1.08,rangeMul:1.05}));
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y,angle:a.angle});
    }else if(type==="storm"){
      const ws=weaponSpec(a);
      for(let i=0;i<8;i++)this.createProjectile(a,i*Math.PI/4,22,ws,{isSuper:true,speedMul:.92,rangeMul:.78,radiusMul:1.15});
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }else if(type==="decoy"){
      this.moveInstant(a,260,a.angle+Math.PI);a.invulnerableUntil=now+1200;a.hp=Math.min(a.maxHp,a.hp+14);
      this.broadcast("super",{by:a.id,type,x:a.x,y:a.y});
    }
  }

  handleSuper(client){
    const p=this.players.get(client.sessionId);if(p)this.activateSuper(p);
  }

  respawn(a){
    const sp=(MAPS[this.mapId]||MAPS.hall).spawns[a.slot]||SPAWNS[a.slot]||SPAWNS[0],spec=heroSpec(a.hero);
    a.x=sp.x;a.y=sp.y;a.hp=spec.hp;a.maxHp=spec.hp;a.alive=true;a.respawnAt=0;a.super=0;
    this.initCombatState(a);a.invulnerableUntil=Date.now()+900;
    this.broadcast("respawn",{sessionId:a.id,x:a.x,y:a.y});
  }

  coverPointFor(bot,target){
    const obs=(MAPS[this.mapId]||MAPS.hall).obstacles;
    let best=null,bestD=Infinity;
    for(const o of obs){
      const cx=o.x+o.w/2,cy=o.y+o.h/2,d=Math.hypot(bot.x-cx,bot.y-cy);
      if(d<bestD){bestD=d;best={o,cx,cy}}
    }
    if(!best)return null;
    const dx=best.cx-target.x,dy=best.cy-target.y,m=Math.hypot(dx,dy)||1;
    return{x:best.cx+dx/m*(Math.max(best.o.w,best.o.h)/2+42),y:best.cy+dy/m*(Math.max(best.o.w,best.o.h)/2+42)};
  }

  updateBots(now){
    const cfg=BOT_LEVELS[this.botDifficulty]||BOT_LEVELS.normal;
    for(const b of this.bots.values()){
      if(!b.alive)continue;
      this.finishReload(b,now);

      if(now>=b.targetSwitchAt||!b.targetId||!this.actors().some(a=>a.id===b.targetId&&a.alive)){
        const candidates=this.actors().filter(a=>a.id!==b.id&&a.alive).sort((a,c)=>dist(b,a)-dist(b,c));
        const pool=candidates.slice(0,Math.min(2,candidates.length));
        const target=pool.length?pool[Math.floor(Math.random()*pool.length)]:null;
        b.targetId=target?.id||"";b.targetSwitchAt=now+900+Math.random()*900;
      }
      const target=this.actors().find(a=>a.id===b.targetId&&a.alive);
      if(!target)continue;
      const best=dist(b,target);

      if(now>=b.brainAt){
        b.brainAt=now+cfg.react+Math.random()*cfg.react*.6;
        let tx=target.x,ty=target.y;
        if(b.hp<b.maxHp*.36&&Math.random()<cfg.cover){
          const cover=this.coverPointFor(b,target);if(cover){tx=cover.x;ty=cover.y}
        }else if(Math.hypot(b.x-CENTER_X,b.y-CENTER_Y)>300&&b.score<3&&Math.random()<.38){
          tx=CENTER_X;ty=CENTER_Y;
        }

        let dx=tx-b.x,dy=ty-b.y,m=Math.hypot(dx,dy)||1;dx/=m;dy/=m;
        if(best<150){dx=-dx;dy=-dy}
        else if(best<390){
          const side=((b.slot+this.round+Math.floor(now/900))%2?1:-1);
          const sx=-dy*side,sy=dx*side;
          dx=dx*(.25+Math.random()*.18)+sx*(.75+cfg.cover*.15);
          dy=dy*(.25+Math.random()*.18)+sy*(.75+cfg.cover*.15);
          const nm=Math.hypot(dx,dy)||1;dx/=nm;dy/=nm;
        }
        b.input={dx,dy,seq:0};
      }

      const aim=Math.atan2(target.y-b.y,target.x-b.x);
      b.angle=aim;
      if(best<560)this.shootActor(b,aim);
      if(b.super>=100&&best<260&&Math.random()<cfg.superChance)this.activateSuper(b);
    }
  }

  applyMovement(a,dt,now){
    if(!a.alive)return;
    const hs=heroSpec(a.hero),cfg=a.isBot?(BOT_LEVELS[this.botDifficulty]||BOT_LEVELS.normal):null;
    let speed=hs.speed*(cfg?cfg.speed:1);
    if(a.hero==="sprinter"&&Math.hypot(a.input.dx,a.input.dy)>.15)speed*=1.08;
    if(a.hero==="phantom")speed*=1.035;
    if(a.speedBoostUntil>now)speed*=1.24;
    if(a.perk==="agile")speed*=PERKS.agile.speed;
    if(a.stunnedUntil>now)speed*=.20;

    const targetVx=a.input.dx*speed,targetVy=a.input.dy*speed;
    const accel=hs.accel*(cfg?.speed||1);
    const maxDelta=accel*dt;
    a.vx+=(clamp(targetVx-a.vx,-maxDelta,maxDelta));
    a.vy+=(clamp(targetVy-a.vy,-maxDelta,maxDelta));
    if(Math.hypot(a.input.dx,a.input.dy)<.04){a.vx*=.86;a.vy*=.86}

    const ox=a.x,oy=a.y;
    const p=this.resolveRoomMove(a.x+a.vx*dt,a.y+a.vy*dt,25,now);
    a.x=p.x;a.y=p.y;
    if(Math.abs(a.x-ox-a.vx*dt)>2)a.vx*=.35;
    if(Math.abs(a.y-oy-a.vy*dt)>2)a.vy*=.35;
  }

  applyPassives(now){
    for(const a of this.actors()){
      if(!a.alive)continue;
      if(a.hero==="medic"&&now-a.lastHitAt>3500)a.hp=Math.min(a.maxHp,a.hp+3);
      if(a.hero==="engineer"&&now-a.lastHitAt>3000)a.hp=Math.min(a.maxHp,a.hp+2);
    }
  }

  applyPads(now){
    for(const a of this.actors()){
      if(!a.alive||a.padCooldownUntil>now)continue;
      for(let i=0;i<ENERGY_PADS.length;i++){
        const p=ENERGY_PADS[i];
        if(Math.hypot(a.x-p.x,a.y-p.y)<=42){
          a.padCooldownUntil=now+4200;a.super=clamp(a.super+14,0,100);a.hp=Math.min(a.maxHp,a.hp+4);
          this.broadcast("pad",{by:a.id,pad:i,x:p.x,y:p.y});break;
        }
      }
    }
  }

  updateMapEvents(now){
    if(now<this.nextMapEventAt)return;
    this.mapEvent.phase+=1;
    this.mapEvent.lightsOut=this.mapEvent.phase%3===1;
    this.mapEvent.doorsOpen=this.mapEvent.phase%2===0;
    this.nextMapEventAt=now+10500+Math.random()*3500;
    this.broadcast("map_event",{...this.mapEvent,at:now});
  }

  maybeFinishLast(){
    if(this.mode!=="last"||this.phase!=="playing"||Date.now()<this.startedAt+5000)return false;
    const alive=this.actors().filter(a=>a.alive);
    if(alive.length<=1){if(alive[0])alive[0].score+=12;this.finishMatch();return true}
    return false;
  }

  tick(){
    const now=Date.now();
    if(this.phase==="countdown"&&now>=this.startedAt)this.phase="playing";
    if(this.phase!=="playing")return;
    if(now>=this.endsAt){this.finishMatch();return}

    if(!this.bellRush&&this.endsAt-now<=15000){
      this.bellRush=true;this.broadcast("bell_rush",{at:now});
    }

    this.updateMapEvents(now);
    this.updateBots(now);
    const dt=TICK_MS/1000;
    this.updateProjectiles(dt);

    for(const a of this.actors()){
      this.finishReload(a,now);
      if(!a.alive){if(MODES[this.mode].respawn&&a.respawnAt&&now>=a.respawnAt)this.respawn(a);continue}
      this.applyMovement(a,dt,now);
    }

    this.passiveClock+=TICK_MS;
    if(this.passiveClock>=1000){this.passiveClock-=1000;this.applyPassives(now)}

    this.applyPads(now);

    this.objectiveClock+=TICK_MS;
    if(this.objectiveClock>=1000){
      this.objectiveClock-=1000;
      for(const a of this.actors()){
        if(!a.alive)continue;
        if(Math.hypot(a.x-CENTER_X,a.y-CENTER_Y)<=126){
          let pts=MODES[this.mode].zone;
          if(this.bellRush&&pts>0)pts+=1;
          if((a.hero==="geographer"||a.hero==="captain")&&pts>0)pts+=1;
          a.score+=pts;a.controlSeconds=(Number(a.controlSeconds)||0)+1;
        }
      }
    }
    this.maybeFinishLast();
  }

  finishMatch(){
    if(this.phase==="finished")return;
    this.phase="finished";this.projectiles.clear();
    const actors=this.actors();
    const teamScores={0:0,1:0};if(this.mode==="team2v2")for(const a of actors)teamScores[a.team]=(teamScores[a.team]||0)+a.score;
    actors.sort((a,b)=>{
      if(this.mode==="last"&&a.alive!==b.alive)return a.alive?-1:1;
      if(this.mode==="team2v2"&&teamScores[a.team]!==teamScores[b.team])return teamScores[b.team]-teamScores[a.team];
      return b.score-a.score||b.kills-a.kills||a.deaths-b.deaths;
    });
    const ranking=actors.map((a,i)=>({
      place:i+1,id:a.id,sessionId:a.sessionId,name:a.name,hero:a.hero,team:a.team,score:a.score,deaths:a.deaths,kills:a.kills||0,
      damage:Math.round(a.damageDone||0),controlSeconds:Math.round(a.controlSeconds||0),shots:a.shots||0,hits:a.hits||0,isBot:!!a.isBot,alive:!!a.alive
    }));
    const winnerTeam=this.mode==="team2v2"?(teamScores[0]>=teamScores[1]?0:1):null;
    this.broadcast("match_ended",{round:this.round,mode:this.mode,ranking,winner:ranking[0]||null,winnerTeam,teamScores});
    this.unlock();
    this.clock.setTimeout(()=>{
      if(this.phase!=="finished")return;
      this.phase="lobby";this.bots.clear();this.projectiles.clear();this.broadcastLobby();this.snapshot();
    },4800);
  }

  snapshot(){
    this.broadcast("snapshot",{
      serverNow:Date.now(),phase:this.phase,startedAt:this.startedAt,endsAt:this.endsAt,round:this.round,
      hostSessionId:this.hostSessionId,map:this.mapId,botFill:this.botFill,botDifficulty:this.botDifficulty,mode:this.mode,bellRush:this.bellRush,
      pads:ENERGY_PADS,mapEvent:{...this.mapEvent,dynamic:this.dynamicObstacles()},
      actors:this.actors().map(a=>({
        id:a.id,sessionId:a.sessionId,name:a.name,hero:a.hero,skin:a.skin||"student",
        weapon:a.weapon||"school_blaster",weaponSkin:a.weaponSkin||"default",perk:a.perk||"assault",shotEffect:a.shotEffect||"classic",koEffect:a.koEffect||"burst",frame:a.frame||"none",trail:a.trail||"none",
        slot:a.slot,team:a.team,isBot:!!a.isBot,x:Math.round(a.x*10)/10,y:Math.round(a.y*10)/10,angle:a.angle,
        hp:a.hp,maxHp:a.maxHp,alive:a.alive,score:a.score,deaths:a.deaths,super:Math.round(a.super),
        respawnAt:a.respawnAt,seq:a.input?.seq||0,ammo:a.ammo,reloadUntil:a.reloadUntil,
        shieldUntil:a.shieldUntil,stunnedUntil:a.stunnedUntil,kills:a.kills||0,damage:Math.round(a.damageDone||0),controlSeconds:a.controlSeconds||0
      })),
      projectiles:[...this.projectiles.values()].map(p=>({
        id:p.id,ownerId:p.ownerId,x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10,
        angle:p.angle,weapon:p.weapon,isSuper:p.isSuper
      }))
    });
  }
}

const server=defineServer({
  transport:new WebSocketTransport({pingInterval:10000,pingMaxRetries:4}),
  rooms:{lyceum_clash:defineRoom(LyceumClashRoom)},
  express:(app)=>{
    app.get("/",(_req,res)=>res.redirect("/game"));
    app.get("/health",(_req,res)=>res.json({
      ok:true,service:"lyceum-clash-server",version:"2.6.0",node:process.version,
      multiplayer:"colyseus-websocket",bots:"server-authoritative"
    }));
    app.get("/game",(_req,res)=>{
      res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma","no-cache");res.setHeader("Expires","0");
      res.type("html").send(GAME_HTML);
    });
    app.get("/test",(_req,res)=>res.redirect("/game"));
  }
});

await server.listen(PORT);
console.log("LYCEUM CLASH v2.6 listening on "+PORT);
