const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
  perMessageDeflate: true
});

app.use(express.static(path.join(__dirname, 'public')));

const WORLD = { w: 3000, h: 3000 };
const TICK_RATE = 50;
const MAX_BULLETS = 200;
const VIEW_DIST = 1200;
const MAX_SHAPES = 80;

let players = {};
let bullets = [];
let shapes = [];
let bulletId = 0;

function spawnShape() {
  if (shapes.length >= MAX_SHAPES) return;
  const types = ['square', 'triangle', 'pentagon'];
  const type = types[Math.floor(Math.random() * types.length)];
  const cfg = {
    square:   { radius: 18, health: 10,  maxHealth: 10,  xp: 10,  score: 10,  color: '#ffdd44' },
    triangle: { radius: 22, health: 25,  maxHealth: 25,  xp: 25,  score: 25,  color: '#ff8844' },
    pentagon: { radius: 30, health: 100, maxHealth: 100, xp: 130, score: 130, color: '#aa44ff' }
  };
  const c = cfg[type];
  shapes.push({
    id: Math.random().toString(36).slice(2),
    x: Math.random() * (WORLD.w - 100) + 50,
    y: Math.random() * (WORLD.h - 100) + 50,
    type, ...c,
    angle: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.02,
    vx: 0, vy: 0
  });
}

for (let i = 0; i < MAX_SHAPES; i++) spawnShape();

function dist2(a, b) { return (a.x-b.x)**2 + (a.y-b.y)**2; }

function getStats(p) {
  const u = p.upgrades;
  return {
    speed: 4 + (u.moveSpeed||0)*0.5,
    bulletSpeed: 10 + (u.bulletSpeed||0)*2,
    bulletDamage: 15 + (u.bulletDamage||0)*8,
    fireInterval: Math.max(80, 350-(u.fireRate||0)*40),
    maxHealth: 100 + (u.maxHealth||0)*30,
    bulletCount: (u.bulletCount||0)>0 ? 2 : 1
  };
}

function getStateForPlayer(pid) {
  const me = players[pid];
  if (!me) return null;
  const vd2 = VIEW_DIST * VIEW_DIST;
  const nearPlayers = {};
  for (const [id, p] of Object.entries(players)) {
    if (id === pid || dist2(me, p) < vd2) {
      nearPlayers[id] = {
        x: Math.round(p.x), y: Math.round(p.y),
        angle: +p.angle.toFixed(2),
        health: Math.round(p.health),
        maxHealth: 100+(p.upgrades.maxHealth||0)*30,
        radius: p.radius, color: p.color, name: p.name,
        alive: p.alive, level: p.level, score: p.score,
        upgrades: p.upgrades
      };
    }
  }
  const nearBullets = bullets.filter(b => dist2(me,b)<vd2)
    .map(b => ({ id:b.id, x:Math.round(b.x), y:Math.round(b.y), radius:b.radius, color:b.color, ownerId:b.ownerId }));
  const nearShapes = shapes.filter(s => dist2(me,s)<vd2)
    .map(s => ({ id:s.id, x:Math.round(s.x), y:Math.round(s.y), type:s.type, radius:s.radius, color:s.color, angle:+s.angle.toFixed(2), health:Math.round(s.health), maxHealth:s.maxHealth }));
  return { players: nearPlayers, bullets: nearBullets, shapes: nearShapes };
}

setInterval(() => {
  bullets = bullets.filter(b => {
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life<=0||b.x<0||b.x>WORLD.w||b.y<0||b.y>WORLD.h) return false;
    for (const [sid, p] of Object.entries(players)) {
      if (!p.alive||sid===b.ownerId) continue;
      const r = b.radius+p.radius;
      if (dist2(b,p)<r*r) {
        p.health -= b.damage;
        if (p.health<=0) {
          p.alive=false; p.health=0;
          const killer=players[b.ownerId];
          if (killer) { killer.score+=200; killer.upgradePoints+=3; gainXP(killer,200); io.to(b.ownerId).emit('killedPlayer',{name:p.name}); }
          io.to(sid).emit('youDied',{killer:players[b.ownerId]?.name||'???'});
          io.emit('playerDied',{id:sid,name:p.name});
        }
        return false;
      }
    }
    for (let i=shapes.length-1;i>=0;i--) {
      const s=shapes[i];
      const r=b.radius+s.radius;
      if (dist2(b,s)<r*r) {
        s.health-=b.damage; s.vx=b.vx*0.3; s.vy=b.vy*0.3;
        if (s.health<=0) {
          const owner=players[b.ownerId];
          if (owner) { owner.score+=s.score; owner.upgradePoints++; gainXP(owner,s.xp); io.to(b.ownerId).emit('gainedScore',{score:owner.score,xp:owner.xp,xpNeeded:owner.xpNeeded,level:owner.level,upgradePoints:owner.upgradePoints}); }
          shapes.splice(i,1); spawnShape();
        }
        return false;
      }
    }
    return true;
  });

  if (bullets.length>MAX_BULLETS) bullets=bullets.slice(-MAX_BULLETS);

  for (const s of shapes) {
    s.angle+=s.rotSpeed; s.x+=s.vx; s.y+=s.vy;
    s.vx*=0.95; s.vy*=0.95;
    s.x=Math.max(s.radius,Math.min(WORLD.w-s.radius,s.x));
    s.y=Math.max(s.radius,Math.min(WORLD.h-s.radius,s.y));
  }

  for (const p of Object.values(players)) {
    if (!p.alive) continue;
    const maxHp=100+(p.upgrades.maxHealth||0)*30;
    if (p.health<maxHp) p.health=Math.min(maxHp,p.health+0.1);
  }

  for (const [pid, sock] of Object.entries(io.sockets.sockets)) {
    const state=getStateForPlayer(pid);
    if (state) sock.emit('gameState',state);
  }
}, TICK_RATE);

setInterval(() => {
  const lb=Object.values(players).sort((a,b)=>b.score-a.score).slice(0,10).map(p=>({name:p.name,score:p.score,level:p.level}));
  io.emit('leaderboard',lb);
}, 2000);

function gainXP(p,amount) {
  p.xp+=amount;
  while(p.xp>=p.xpNeeded){p.xp-=p.xpNeeded;p.level++;p.xpNeeded=Math.floor(p.xpNeeded*1.4);p.upgradePoints+=2;}
}

io.on('connection', (socket) => {
  console.log('Oyuncu bağlandı:', socket.id);
  const colors=['#1ab8ff','#3af0c0','#ffdd44','#ff8844','#aa44ff','#ff4499','#44ff99'];
  const color=colors[Math.floor(Math.random()*colors.length)];
  players[socket.id]={
    x:Math.random()*800+WORLD.w/2-400, y:Math.random()*800+WORLD.h/2-400,
    radius:22, angle:0, health:100, maxHealth:100, speed:4, color,
    name:'Oyuncu', alive:true, score:0, level:1, xp:0, xpNeeded:100,
    upgradePoints:0, upgrades:{}, lastShot:0
  };
  socket.emit('init',{id:socket.id,player:players[socket.id],shapes:shapes.slice(0,50),world:WORLD});
  socket.on('setName',(name)=>{if(players[socket.id])players[socket.id].name=String(name).slice(0,16)||'Oyuncu';});
  socket.on('input',(data)=>{
    const p=players[socket.id];
    if(!p||!p.alive) return;
    const st=getStats(p);
    const diag=data.dx!==0&&data.dy!==0?0.707:1;
    p.x+=data.dx*st.speed*diag; p.y+=data.dy*st.speed*diag;
    p.x=Math.max(p.radius,Math.min(WORLD.w-p.radius,p.x));
    p.y=Math.max(p.radius,Math.min(WORLD.h-p.radius,p.y));
    p.angle=data.angle;
    if(data.shooting){
      const now=Date.now();
      if(now-p.lastShot>=st.fireInterval){
        p.lastShot=now;
        for(let b=0;b<st.bulletCount;b++){
          const ang=p.angle+(st.bulletCount===2?(b===0?-0.2:0.2):0);
          bullets.push({id:bulletId++,x:p.x+Math.cos(ang)*42,y:p.y+Math.sin(ang)*42,vx:Math.cos(ang)*st.bulletSpeed,vy:Math.sin(ang)*st.bulletSpeed,radius:7+(p.upgrades.bulletDamage||0),damage:st.bulletDamage,color:p.color,life:70,ownerId:socket.id});
        }
      }
    }
  });
  socket.on('upgrade',(stat)=>{
    const p=players[socket.id];
    if(!p||p.upgradePoints<=0||(p.upgrades[stat]||0)>=7) return;
    p.upgrades[stat]=(p.upgrades[stat]||0)+1; p.upgradePoints--;
    socket.emit('upgradeConfirm',{upgrades:p.upgrades,upgradePoints:p.upgradePoints});
  });
  socket.on('respawn',()=>{
    const p=players[socket.id]; if(!p) return;
    p.x=Math.random()*800+WORLD.w/2-400; p.y=Math.random()*800+WORLD.h/2-400;
    p.health=100; p.alive=true; p.score=Math.floor(p.score*0.5);
    socket.emit('respawned',{player:p});
  });
  socket.on('ping_custom',()=>socket.emit('pong_custom'));
  socket.on('disconnect',()=>{console.log('Ayrıldı:',socket.id);delete players[socket.id];io.emit('playerLeft',{id:socket.id});});
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Sunucu çalışıyor: http://localhost:${PORT}`));
