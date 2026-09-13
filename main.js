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
  blaster:     { hp:100, speed:230, damage:24, cooldown:340 },
  sprinter:    { hp:88,  speed:275, damage:19, cooldown:270 },
  scholar:     { hp:108, speed:215, damage:23, cooldown:360 },
  hacker:      { hp:94,  speed:240, damage:22, cooldown:300 },
  historian:   { hp:112, speed:205, damage:26, cooldown:400 },
  geographer:  { hp:106, speed:220, damage:23, cooldown:350 },
  chemist:     { hp:102, speed:218, damage:27, cooldown:410 },
  artist:      { hp:94,  speed:238, damage:21, cooldown:290 },
  musician:    { hp:96,  speed:235, damage:20, cooldown:280 },
  guardian:    { hp:132, speed:188, damage:26, cooldown:430 },
  phantom:     { hp:90,  speed:260, damage:22, cooldown:310 },
  captain:     { hp:118, speed:210, damage:25, cooldown:370 },
  sniper:      { hp:84,  speed:205, damage:36, cooldown:620 },
  medic:       { hp:104, speed:220, damage:19, cooldown:315 },
  engineer:    { hp:114, speed:205, damage:25, cooldown:390 },
  stormer:     { hp:100, speed:242, damage:22, cooldown:295 },
  illusionist: { hp:90,  speed:252, damage:21, cooldown:300 },
};

const MAPS = {
  hall: {
    name: "Головний хол",
    obstacles: [
      {x:360,y:190,w:190,h:72},{x:1178,y:190,w:190,h:72},
      {x:360,y:710,w:190,h:72},{x:1178,y:710,w:190,h:72},
      {x:760,y:355,w:208,h:64},{x:760,y:553,w:208,h:64}
    ]
  },
  library: {
    name: "Бібліотека",
    obstacles: [
      {x:280,y:160,w:120,h:250},{x:510,y:160,w:120,h:250},
      {x:1098,y:160,w:120,h:250},{x:1328,y:160,w:120,h:250},
      {x:280,y:565,w:120,h:250},{x:510,y:565,w:120,h:250},
      {x:1098,y:565,w:120,h:250},{x:1328,y:565,w:120,h:250}
    ]
  },
  gym: {
    name: "Спортзал",
    obstacles: [
      {x:180,y:225,w:150,h:55},{x:1398,y:225,w:150,h:55},
      {x:180,y:692,w:150,h:55},{x:1398,y:692,w:150,h:55},
      {x:780,y:235,w:168,h:54},{x:780,y:683,w:168,h:54}
    ]
  }
};

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

  onCreate(){
    this.phase="lobby";
    this.players=new Map();
    this.bots=new Map();
    this.hostSessionId="";
    this.startedAt=0;
    this.endsAt=0;
    this.round=0;
    this.mapId="hall";
    this.botFill=true;
    this.objectiveClock=0;
    this.botCounter=0;

    this.onMessage("start",(client)=>this.startMatch(client));
    this.onMessage("input",(client,data)=>this.handleInput(client,data));
    this.onMessage("shoot",(client,data)=>this.handleShoot(client,data));
    this.onMessage("super",(client)=>this.handleSuper(client));
    this.onMessage("hero",(client,data)=>this.setHero(client,data));
    this.onMessage("map",(client,data)=>this.setMap(client,data));
    this.onMessage("bots",(client,data)=>this.setBots(client,data));
    this.onMessage("ping",(client,data)=>client.send("pong",{t:data?.t||Date.now(),serverNow:Date.now()}));

    this.clock.setInterval(()=>this.tick(),TICK_MS);
    this.clock.setInterval(()=>this.snapshot(),SNAPSHOT_MS);
  }

  onJoin(client,options={}){
    if(this.phase!=="lobby")throw new Error("MATCH_ALREADY_STARTED");

    const used=new Set([...this.players.values()].map(p=>p.slot));
    let slot=0; while(used.has(slot)&&slot<5)slot++;
    if(slot>=5)throw new Error("ROOM_FULL");

    if(!this.hostSessionId)this.hostSessionId=client.sessionId;
    const hero=HEROES[options.hero]?options.hero:"blaster";
    const spec=heroSpec(hero);
    const sp=SPAWNS[slot];

    this.players.set(client.sessionId,{
      id:client.sessionId,sessionId:client.sessionId,isBot:false,
      name:clean(options.name||("Учень "+(slot+1)))||("Учень "+(slot+1)),
      hero,slot,x:sp.x,y:sp.y,angle:0,
      hp:spec.hp,maxHp:spec.hp,alive:true,score:0,deaths:0,super:0,
      respawnAt:0,lastShotAt:0,input:{dx:0,dy:0,seq:0}
    });

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
      if(this.hostSessionId)this.broadcast("host_changed",{hostSessionId:this.hostSessionId});
    }
    this.broadcastLobby();
  }

  actors(){
    return [...this.players.values(),...this.bots.values()];
  }

  setHero(client,data={}){
    if(this.phase!=="lobby")return;
    const p=this.players.get(client.sessionId); if(!p)return;
    const id=String(data.hero||"");
    if(!HEROES[id])return;
    p.hero=id;p.maxHp=heroSpec(id).hp;p.hp=p.maxHp;
    this.broadcastLobby();
  }

  setMap(client,data={}){
    if(client.sessionId!==this.hostSessionId||this.phase!=="lobby")return;
    const id=String(data.map||"");
    if(!MAPS[id])return;
    this.mapId=id;
    this.broadcastLobby();
  }

  setBots(client,data={}){
    if(client.sessionId!==this.hostSessionId||this.phase!=="lobby")return;
    this.botFill=data.enabled!==false;
    this.broadcastLobby();
  }

  broadcastLobby(){
    this.broadcast("lobby",{
      code:this.roomId,phase:this.phase,hostSessionId:this.hostSessionId,
      map:this.mapId,botFill:this.botFill,maxPlayers:5,
      players:[...this.players.values()].sort((a,b)=>a.slot-b.slot).map(p=>({
        sessionId:p.sessionId,name:p.name,hero:p.hero,slot:p.slot
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
    for(let slot=0;slot<5;slot++){
      if(used.has(slot))continue;
      const id="BOT_"+(++this.botCounter);
      const hero=botHeroes[(slot+this.round)%botHeroes.length];
      const spec=heroSpec(hero),sp=SPAWNS[slot];
      this.bots.set(id,{
        id,sessionId:id,isBot:true,name:"BOT "+botNames[n++%botNames.length],
        hero,slot,x:sp.x,y:sp.y,angle:0,hp:spec.hp,maxHp:spec.hp,
        alive:true,score:0,deaths:0,super:0,respawnAt:0,lastShotAt:0,
        input:{dx:0,dy:0,seq:0},brainAt:0,targetId:""
      });
    }
  }

  startMatch(client){
    if(client.sessionId!==this.hostSessionId){
      client.send("server_error",{code:"NOT_HOST",message:"Лише HOST може почати матч."});
      return;
    }
    if(this.phase!=="lobby")return;

    this.round+=1;
    this.phase="countdown";
    this.startedAt=Date.now()+1300;
    this.endsAt=this.startedAt+MATCH_MS;
    this.objectiveClock=0;

    this.fillBots();

    for(const a of this.actors()){
      const sp=SPAWNS[a.slot]||SPAWNS[0], spec=heroSpec(a.hero);
      a.x=sp.x;a.y=sp.y;a.angle=0;a.maxHp=spec.hp;a.hp=spec.hp;
      a.alive=true;a.score=0;a.deaths=0;a.super=0;a.respawnAt=0;a.lastShotAt=0;
      a.input={dx:0,dy:0,seq:0};
    }

    this.lock();
    this.broadcast("match_started",{
      startedAt:this.startedAt,endsAt:this.endsAt,durationMs:MATCH_MS,
      round:this.round,map:this.mapId,botCount:this.bots.size
    });
    this.snapshot();
  }

  handleInput(client,data={}){
    const p=this.players.get(client.sessionId);if(!p)return;
    const v=normalize(data.dx,data.dy);
    p.input={dx:v.dx,dy:v.dy,seq:Math.max(0,Number(data.seq)||0)};
    if(Number.isFinite(Number(data.angle)))p.angle=Number(data.angle);
  }

  findTarget(shooter,angle,range=520,width=54){
    let best=null;
    for(const target of this.actors()){
      if(target.id===shooter.id||!target.alive)continue;
      const h=rayHit(shooter,target,angle,range,width);
      if(!h)continue;
      if(!best||h.along<best.hit.along)best={target,hit:h};
    }
    return best;
  }

  shootActor(shooter,angle,source="player"){
    if(this.phase!=="playing"||!shooter||!shooter.alive)return;
    const now=Date.now(),spec=heroSpec(shooter.hero);
    if(now-shooter.lastShotAt<spec.cooldown)return;
    shooter.lastShotAt=now;shooter.angle=angle;

    const range=shooter.hero==="sniper"?680:520;
    const width=shooter.hero==="sniper"?42:58;
    const found=this.findTarget(shooter,angle,range,width);

    this.broadcast("shot",{
      by:shooter.id,isBot:!!shooter.isBot,x:shooter.x,y:shooter.y,angle,
      range,hero:shooter.hero,at:now
    });

    if(!found)return;
    this.damageActor(shooter,found.target,spec.damage,false);
  }

  damageActor(attacker,target,damage,isSuper=false){
    if(!target.alive)return;
    target.hp=Math.max(0,target.hp-damage);
    attacker.super=clamp(attacker.super+(isSuper?8:24),0,100);

    this.broadcast("hit",{
      by:attacker.id,target:target.id,damage,hp:target.hp,maxHp:target.maxHp,
      superHit:isSuper
    });

    if(target.hp<=0){
      target.alive=false;target.deaths+=1;target.respawnAt=Date.now()+RESPAWN_MS;
      attacker.score+=5;attacker.super=clamp(attacker.super+18,0,100);
      this.broadcast("ko",{by:attacker.id,target:target.id,score:attacker.score,respawnAt:target.respawnAt});
    }
  }

  handleShoot(client,data={}){
    const p=this.players.get(client.sessionId);if(!p)return;
    const angle=Number.isFinite(Number(data.angle))?Number(data.angle):p.angle;
    this.shootActor(p,angle,"player");
  }

  handleSuper(client){
    const p=this.players.get(client.sessionId);if(!p||!p.alive||p.super<100||this.phase!=="playing")return;
    p.super=0;

    if(["guardian","medic","captain"].includes(p.hero)){
      p.hp=Math.min(p.maxHp,p.hp+Math.round(p.maxHp*.42));
      this.broadcast("super",{by:p.id,type:"heal",x:p.x,y:p.y});
      return;
    }

    let hitCount=0;
    for(const t of this.actors()){
      if(t.id===p.id||!t.alive)continue;
      const d=dist(p,t);
      if(d<=205){this.damageActor(p,t,38,true);hitCount++;}
    }
    this.broadcast("super",{by:p.id,type:"burst",x:p.x,y:p.y,hits:hitCount});
  }

  respawn(a){
    const sp=SPAWNS[a.slot]||SPAWNS[0],spec=heroSpec(a.hero);
    a.x=sp.x;a.y=sp.y;a.hp=spec.hp;a.maxHp=spec.hp;a.alive=true;a.respawnAt=0;
    this.broadcast("respawn",{sessionId:a.id,x:a.x,y:a.y});
  }

  updateBots(now){
    for(const b of this.bots.values()){
      if(!b.alive)continue;

      let target=null,best=Infinity;
      for(const a of this.actors()){
        if(a.id===b.id||!a.alive)continue;
        const d=dist(b,a);
        if(d<best){best=d;target=a;}
      }
      if(!target)continue;

      const ang=Math.atan2(target.y-b.y,target.x-b.x);
      b.angle=ang;
      const towardCenter=Math.hypot(b.x-CENTER_X,b.y-CENTER_Y)>260 && (b.score<=2);
      let tx=towardCenter?CENTER_X:target.x,ty=towardCenter?CENTER_Y:target.y;
      let dx=tx-b.x,dy=ty-b.y,m=Math.hypot(dx,dy)||1;
      dx/=m;dy/=m;

      if(best<145){dx=-dx*.7;dy=-dy*.7;}
      else if(best<330){
        const side=((b.slot+this.round)%2?1:-1);
        const sx=-dy*side,sy=dx*side;
        dx=dx*.35+sx*.75;dy=dy*.35+sy*.75;
        const nm=Math.hypot(dx,dy)||1;dx/=nm;dy/=nm;
      }
      b.input={dx,dy,seq:0};

      if(best<600 && now-b.lastShotAt>heroSpec(b.hero).cooldown+140){
        this.shootActor(b,ang,"bot");
      }

      if(b.super>=100 && best<220){
        b.super=0;
        for(const t of this.actors()){
          if(t.id===b.id||!t.alive)continue;
          if(dist(b,t)<=190)this.damageActor(b,t,34,true);
        }
        this.broadcast("super",{by:b.id,type:"burst",x:b.x,y:b.y,hits:1});
      }
    }
  }

  tick(){
    const now=Date.now();
    if(this.phase==="countdown"&&now>=this.startedAt)this.phase="playing";
    if(this.phase!=="playing")return;

    if(now>=this.endsAt){this.finishMatch();return;}

    this.updateBots(now);

    const dt=TICK_MS/1000;
    for(const a of this.actors()){
      if(!a.alive){
        if(a.respawnAt&&now>=a.respawnAt)this.respawn(a);
        continue;
      }
      const spec=heroSpec(a.hero);
      const p=resolveMove(a.x+a.input.dx*spec.speed*dt,a.y+a.input.dy*spec.speed*dt,25,this.mapId);
      a.x=p.x;a.y=p.y;
    }

    this.objectiveClock+=TICK_MS;
    if(this.objectiveClock>=1000){
      this.objectiveClock-=1000;
      for(const a of this.actors()){
        if(a.alive&&Math.hypot(a.x-CENTER_X,a.y-CENTER_Y)<=126)a.score+=1;
      }
    }
  }

  finishMatch(){
    this.phase="finished";
    const ranking=this.actors().sort((a,b)=>b.score-a.score||a.deaths-b.deaths).map((a,i)=>({
      place:i+1,id:a.id,name:a.name,score:a.score,deaths:a.deaths,isBot:!!a.isBot
    }));
    this.broadcast("match_ended",{round:this.round,ranking,winner:ranking[0]||null});
    this.unlock();
    this.clock.setTimeout(()=>{
      if(this.phase!=="finished")return;
      this.phase="lobby";this.bots.clear();this.broadcastLobby();this.snapshot();
    },4800);
  }

  snapshot(){
    this.broadcast("snapshot",{
      serverNow:Date.now(),phase:this.phase,startedAt:this.startedAt,endsAt:this.endsAt,
      round:this.round,hostSessionId:this.hostSessionId,map:this.mapId,botFill:this.botFill,
      actors:this.actors().map(a=>({
        id:a.id,sessionId:a.sessionId,name:a.name,hero:a.hero,slot:a.slot,isBot:!!a.isBot,
        x:Math.round(a.x*10)/10,y:Math.round(a.y*10)/10,angle:a.angle,
        hp:a.hp,maxHp:a.maxHp,alive:a.alive,score:a.score,deaths:a.deaths,
        super:Math.round(a.super),respawnAt:a.respawnAt,seq:a.input?.seq||0
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
      ok:true,service:"lyceum-clash-server",version:"2.0.0",node:process.version,
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
console.log("LYCEUM CLASH v2.0 listening on "+PORT);
