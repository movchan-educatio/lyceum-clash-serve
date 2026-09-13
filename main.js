import { Room, defineRoom, defineServer } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";

const PORT = Number(process.env.PORT || 2567);
const MATCH_MS = 75_000;
const WORLD_W = 1728;
const WORLD_H = 972;
const SPAWNS = [
  {x:180,y:180},{x:1548,y:180},{x:180,y:792},{x:1548,y:792},{x:864,y:822}
];

function clean(v,max=24){return String(v??"").replace(/[<>]/g,"").trim().slice(0,max);}
function clamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0));}

class LyceumClashRoom extends Room {
  maxClients = 5;
  autoDispose = true;

  onCreate(){
    this.phase = "lobby";
    this.players = new Map();
    this.hostSessionId = "";
    this.startedAt = 0;
    this.endsAt = 0;

    this.onMessage("start",(client)=>this.startMatch(client));
    this.onMessage("input",(client,data)=>this.input(client,data));
    this.onMessage("shoot",(client,data)=>this.shoot(client,data));

    this.clock.setInterval(()=>this.tick(), 1000/30);
    this.clock.setInterval(()=>this.snapshot(), 50);
  }

  onJoin(client,options={}){
    if(this.phase!=="lobby") throw new Error("MATCH_ALREADY_STARTED");

    const used=new Set([...this.players.values()].map(p=>p.slot));
    let slot=0; while(used.has(slot)&&slot<5) slot++;
    if(slot>=5) throw new Error("ROOM_FULL");

    if(!this.hostSessionId) this.hostSessionId=client.sessionId;
    const sp=SPAWNS[slot];

    this.players.set(client.sessionId,{
      sessionId:client.sessionId,
      name:clean(options.name || `Учень ${slot+1}`),
      hero:clean(options.hero || "blaster",20),
      slot,
      x:sp.x,y:sp.y,angle:0,
      hp:100,maxHp:100,alive:true,score:0,deaths:0,
      input:{dx:0,dy:0}
    });

    client.send("room_ready",{code:this.roomId,sessionId:client.sessionId,hostSessionId:this.hostSessionId});
    this.sendLobby();
  }

  onLeave(client){
    this.players.delete(client.sessionId);
    if(client.sessionId===this.hostSessionId){
      this.hostSessionId=this.players.keys().next().value || "";
    }
    this.sendLobby();
  }

  sendLobby(){
    this.broadcast("lobby",{
      code:this.roomId,
      phase:this.phase,
      hostSessionId:this.hostSessionId,
      players:[...this.players.values()].map(p=>({
        sessionId:p.sessionId,name:p.name,hero:p.hero,slot:p.slot
      }))
    });
  }

  startMatch(client){
    if(client.sessionId!==this.hostSessionId){
      client.send("server_error",{message:"Лише HOST може почати матч"});
      return;
    }
    if(this.phase!=="lobby") return;

    this.phase="playing";
    this.startedAt=Date.now()+1000;
    this.endsAt=this.startedAt+MATCH_MS;

    for(const p of this.players.values()){
      const sp=SPAWNS[p.slot];
      p.x=sp.x;p.y=sp.y;p.hp=100;p.maxHp=100;p.alive=true;p.score=0;p.deaths=0;
    }

    this.lock();
    this.broadcast("match_started",{startedAt:this.startedAt,endsAt:this.endsAt,durationMs:MATCH_MS});
    this.snapshot();
  }

  input(client,data={}){
    const p=this.players.get(client.sessionId);
    if(!p) return;
    let dx=clamp(data.dx,-1,1),dy=clamp(data.dy,-1,1);
    const m=Math.hypot(dx,dy);
    if(m>1){dx/=m;dy/=m;}
    p.input={dx,dy};
    if(Number.isFinite(Number(data.angle))) p.angle=Number(data.angle);
  }

  shoot(client,data={}){
    if(this.phase!=="playing") return;
    const p=this.players.get(client.sessionId);
    if(!p||!p.alive) return;
    const angle=Number.isFinite(Number(data.angle))?Number(data.angle):p.angle;
    this.broadcast("shot",{by:client.sessionId,x:p.x,y:p.y,angle,at:Date.now()});
  }

  tick(){
    if(this.phase!=="playing") return;
    const now=Date.now();
    if(now>=this.endsAt){
      const ranking=[...this.players.values()].sort((a,b)=>b.score-a.score).map((p,i)=>({
        place:i+1,sessionId:p.sessionId,name:p.name,score:p.score
      }));
      this.phase="lobby";
      this.unlock();
      this.broadcast("match_ended",{ranking,winner:ranking[0]||null});
      this.sendLobby();
      return;
    }

    const dt=(1000/30)/1000;
    for(const p of this.players.values()){
      if(!p.alive) continue;
      p.x=clamp(p.x+p.input.dx*225*dt,24,WORLD_W-24);
      p.y=clamp(p.y+p.input.dy*225*dt,24,WORLD_H-24);
    }
  }

  snapshot(){
    this.broadcast("snapshot",{
      phase:this.phase,
      startedAt:this.startedAt,
      endsAt:this.endsAt,
      hostSessionId:this.hostSessionId,
      players:[...this.players.values()].map(p=>({
        sessionId:p.sessionId,name:p.name,hero:p.hero,slot:p.slot,
        x:p.x,y:p.y,angle:p.angle,hp:p.hp,maxHp:p.maxHp,
        alive:p.alive,score:p.score,deaths:p.deaths
      }))
    });
  }
}

const TEST_HTML = `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LYCEUM CLASH test</title>
<script src="https://unpkg.com/@colyseus/sdk@0.18.5/dist/colyseus.js"><\/script>
<style>
body{margin:0;background:#07111f;color:white;font-family:Arial,sans-serif}.wrap{max-width:800px;margin:auto;padding:20px}
.card{background:#102039;padding:16px;border-radius:16px;margin-bottom:14px}
input,button{padding:12px;border:0;border-radius:10px;margin:4px;font-weight:bold}
button{background:#22c55e}#code{font-size:28px;letter-spacing:4px}.p{padding:8px;background:#19314f;margin:6px 0;border-radius:8px}
canvas{width:100%;background:#061827;border-radius:12px;aspect-ratio:16/9}.row{display:flex;gap:8px;flex-wrap:wrap}
</style>
</head>
<body><div class="wrap">
<div class="card"><h2>LYCEUM CLASH — SERVER TEST</h2>
<div class="row"><input id="name" value="Учень"><button id="create">СТВОРИТИ</button></div>
<div class="row"><input id="joinCode" maxlength="12" placeholder="КОД"><button id="join">ПРИЄДНАТИСЯ</button></div>
<div>Кімната: <b id="code">—</b></div><div id="status">Не підключено</div>
<div id="players"></div><button id="start" style="display:none">▶ ПОЧАТИ МАТЧ</button></div>
<div class="card"><canvas id="game" width="960" height="540"></canvas></div>
</div>
<script>
const $=id=>document.getElementById(id);
const client=new Colyseus.Client(location.origin);
let room=null,lobby=null,snapshot=null;
async function attach(){
  $("code").textContent=room.roomId;
  $("status").textContent="Підключено";
  room.onMessage("room_ready",d=>{$("code").textContent=d.code});
  room.onMessage("lobby",d=>{lobby=d;renderLobby()});
  room.onMessage("match_started",d=>{$("status").textContent="МАТЧ ПОЧАВСЯ"});
  room.onMessage("snapshot",d=>{snapshot=d;render()});
  room.onMessage("match_ended",d=>{$("status").textContent="МАТЧ ЗАВЕРШЕНО"});
  room.onMessage("server_error",d=>alert(d.message||"Server error"));
}
function renderLobby(){
  $("players").innerHTML=(lobby?.players||[]).map(p=>'<div class="p">'+p.name+' • '+p.hero+(p.sessionId===lobby.hostSessionId?' • HOST':'')+'</div>').join('');
  $("start").style.display=room?.sessionId===lobby?.hostSessionId?'inline-block':'none';
}
$("create").onclick=async()=>{try{room=await client.create("lyceum_clash",{name:$("name").value,hero:"blaster"});await attach()}catch(e){alert(e.message)}};
$("join").onclick=async()=>{try{room=await client.joinById($("joinCode").value.trim(),{name:$("name").value,hero:"blaster"});await attach()}catch(e){alert(e.message)}};
$("start").onclick=()=>room?.send("start");
function render(){
  const c=$("game"),x=c.getContext("2d");x.clearRect(0,0,c.width,c.height);x.fillStyle="#061827";x.fillRect(0,0,c.width,c.height);
  if(!snapshot)return; for(const p of snapshot.players){x.beginPath();x.arc(p.x/1728*c.width,p.y/972*c.height,14,0,Math.PI*2);x.fillStyle=p.sessionId===room.sessionId?"#22c55e":"#60a5fa";x.fill();}
}
<\/script></body></html>`;

const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: {
    lyceum_clash: defineRoom(LyceumClashRoom)
  },
  express: (app) => {
    app.get("/", (_req,res)=>res.type("text").send("LYCEUM CLASH server online"));
    app.get("/health", (_req,res)=>res.json({ok:true,service:"lyceum-clash-server",version:"1.1.0"}));
    app.get("/test", (_req,res)=>res.type("html").send(TEST_HTML));
  }
});

await server.listen(PORT);
console.log(`LYCEUM CLASH listening on ${PORT}`);
