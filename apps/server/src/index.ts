import crypto from "node:crypto";
import express from "express";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import type { ClientToServerEvents, PlayerId, ServerToClientEvents } from "@rift/protocol";
import { clampAim, createTarget, initialState, outcomeFor, resolveShot, shiftTargetExpiry, waveForTime, type GameState } from "./game.js";
import { log } from "./logger.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export interface Room { state:GameState;displayToken:string;displaySocket?:string;playerTokens:Partial<Record<PlayerId,string>>;playerSockets:Partial<Record<PlayerId,string>>;lastShot:Partial<Record<PlayerId,number>>;lastReload:Partial<Record<PlayerId,number>>;timer?:NodeJS.Timeout;emptySince?:number;pausedAt?:number }
export const rooms=new Map<string,Room>();
let draining=false;
export const app=express();export const httpServer=createServer(app);export const io=new Server<ClientToServerEvents,ServerToClientEvents>(httpServer,{cors:{origin:process.env.CLIENT_ORIGIN?.split(",")??"*"}});
app.get("/health",(_,res)=>res.json({ok:true,rooms:rooms.size}));
app.get("/ready",(_,res)=>res.status(draining?503:200).json({ready:!draining,rooms:rooms.size}));
const makeToken=()=>crypto.randomBytes(18).toString("base64url");
const makeCode=()=>{let c="";do c=Math.random().toString(36).slice(2,8).toUpperCase();while(rooms.has(c));return c};
const broadcast=(r:Room)=>io.to(r.state.code).emit("room:state",r.state);
const spawn=(r:Room,now=Date.now())=>{r.state.target=createTarget(r.state.timeLeft,now)};
const stop=(r:Room)=>{if(r.timer)clearInterval(r.timer);r.timer=undefined};
export const stopRooms=()=>{for(const r of rooms.values())stop(r)};
export function tickRoom(r:Room,now=Date.now()){if(r.state.phase==="countdown"){r.state.countdown--;if(r.state.countdown<=0){r.state.phase="playing";spawn(r,now)}}else if(r.state.phase==="playing"){r.state.timeLeft--;r.state.wave=waveForTime(r.state.timeLeft);if(r.state.target&&now>r.state.target.expiresAt){r.state.health--;r.state.message="Rift breach!";spawn(r,now)}if(r.state.timeLeft<=0||r.state.health<=0){r.state.phase="finished";r.state.outcome=outcomeFor(r.state.health,r.state.timeLeft);r.state.message=r.state.outcome==="victory"?"Rift sealed":"Containment failed";r.state.target=null;log("info","game.finished",{roomCode:r.state.code,outcome:r.state.outcome,score:r.state.score});stop(r)}}}
const begin=(r:Room)=>{stop(r);r.state={...initialState(r.state.code),players:r.state.players,phase:"countdown"};log("info","game.started",{roomCode:r.state.code});r.pausedAt=undefined;r.timer=setInterval(()=>{tickRoom(r);broadcast(r)},1000)};
const validDisplay=(r:Room,t:string)=>r.displayToken===t;
const validPlayer=(r:Room,p:PlayerId,t:string)=>r.playerTokens[p]===t;
const getRoom=(code:string)=>rooms.get(code.trim().toUpperCase());
const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null;
const text=(value:unknown):value is string=>typeof value==="string"&&value.length>0&&value.length<=128;
const playerId=(value:unknown):value is PlayerId=>value===1||value===2;
const finite=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);
const roomPayload=(value:unknown)=>record(value)&&text(value.roomCode)&&text(value.token);
const playerPayload=(value:unknown)=>record(value)&&roomPayload(value)&&playerId(value.playerId);
const closeRoom=(r:Room)=>{log("info","room.closed",{roomCode:r.state.code});stop(r);io.to(r.state.code).emit("room:error","Room ditutup oleh display");io.in(r.state.code).disconnectSockets(true);rooms.delete(r.state.code)};

io.on("connection",(socket:GameSocket)=>{
 socket.on("room:create",cb=>{const code=makeCode(),displayToken=makeToken(),r:Room={state:initialState(code),displayToken,playerTokens:{},playerSockets:{},lastShot:{},lastReload:{}};rooms.set(code,r);log("info","room.created",{roomCode:code});socket.join(code);r.displaySocket=socket.id;socket.data={roomCode:code,role:"display"};cb({ok:true,roomCode:code,token:displayToken});broadcast(r)});
 socket.on("room:join",(d,cb)=>{if(!d||typeof d.roomCode!=="string")return cb({ok:false,error:"Payload tidak valid"});const r=getRoom(d.roomCode);if(!r)return cb({ok:false,error:"Room tidak ditemukan"});const code=r.state.code;if(d.role==="display"){if(!d.token||!validDisplay(r,d.token))return cb({ok:false,error:"Display token tidak valid"});r.displaySocket=socket.id;r.emptySince=undefined;socket.join(code);socket.data={roomCode:code,role:"display"};return cb({ok:true,state:r.state})}let p=([1,2]as PlayerId[]).find(id=>Boolean(d.token)&&r.playerTokens[id]===d.token);if(!p)p=([1,2]as PlayerId[]).find(id=>!r.state.players[id]);if(!p)return cb({ok:false,error:"Room sudah penuh"});const pt=d.token&&r.playerTokens[p]===d.token?d.token:makeToken();r.playerTokens[p]=pt;r.playerSockets[p]=socket.id;r.state.players[p]=true;r.emptySince=undefined;socket.join(code);socket.data={roomCode:code,role:"player",playerId:p};cb({ok:true,playerId:p,token:pt,state:r.state});broadcast(r)});
 socket.on("tutorial:set",d=>{if(!roomPayload(d)||!finite(d.step))return;const r=getRoom(d.roomCode);if(!r||!validDisplay(r,d.token)||r.state.phase!=="lobby")return;r.state.tutorialStep=Math.max(0,Math.min(4,Math.floor(d.step)));broadcast(r)});
 socket.on("game:start",d=>{if(!roomPayload(d))return;const r=getRoom(d.roomCode);if(r&&validDisplay(r,d.token)&&r.state.phase==="lobby"&&r.state.players[1]&&r.state.players[2])begin(r)});
 socket.on("game:restart",d=>{if(!roomPayload(d))return;const r=getRoom(d.roomCode);if(r&&validDisplay(r,d.token))begin(r)});
 socket.on("game:pause",d=>{if(!roomPayload(d))return;const r=getRoom(d.roomCode);if(!r||!validDisplay(r,d.token)||!(r.state.phase==="playing"||r.state.phase==="paused"))return;const now=Date.now();if(r.state.phase==="playing"){r.state.phase="paused";r.state.message="Paused by display";r.pausedAt=now}else{if(!r.state.players[1]||!r.state.players[2])return;shiftTargetExpiry(r.state,now-(r.pausedAt??now));r.pausedAt=undefined;r.state.message=undefined;r.state.phase="playing"}broadcast(r)});
 socket.on("room:close",d=>{if(!roomPayload(d))return;const r=getRoom(d.roomCode);if(r&&validDisplay(r,d.token))closeRoom(r)});
 socket.on("controller:aim",d=>{if(!playerPayload(d)||!finite(d.x)||!finite(d.y)||!finite(d.sequence))return;const r=getRoom(d.roomCode);if(!r||!validPlayer(r,d.playerId,d.token))return;const aim=clampAim(d);if(!aim||aim.sequence<=r.state.aims[d.playerId].sequence)return;r.state.aims[d.playerId]=aim;broadcast(r)});
 socket.on("controller:shoot",d=>{if(!playerPayload(d)||!finite(d.sequence)||!finite(d.clientTime))return;const r=getRoom(d.roomCode),now=Date.now();if(!r||r.state.phase!=="playing"||!validPlayer(r,d.playerId,d.token)||r.state.ammo[d.playerId]<=0||(r.lastShot[d.playerId]??0)>now-120)return;r.lastShot[d.playerId]=now;r.state.ammo[d.playerId]--;const result=resolveShot(r.state,d.playerId,now);if(result.scored)spawn(r,now);io.to(r.state.code).emit("shot:result",{playerId:d.playerId,hit:result.hit,combo:result.combo,x:r.state.aims[d.playerId].x,y:r.state.aims[d.playerId].y});broadcast(r)});
 socket.on("controller:reload",d=>{if(!playerPayload(d))return;const r=getRoom(d.roomCode),now=Date.now();if(!r||r.state.phase!=="playing"||!validPlayer(r,d.playerId,d.token)||r.state.ammo[d.playerId]===r.state.maxAmmo||(r.lastReload[d.playerId]??0)>now-600)return;r.lastReload[d.playerId]=now;r.state.ammo[d.playerId]=r.state.maxAmmo;broadcast(r)});
 socket.on("disconnect",()=>{const {roomCode,role,playerId}=socket.data as {roomCode?:string;role?:string;playerId?:PlayerId};if(!roomCode)return;const r=rooms.get(roomCode);if(!r)return;if(role==="player"&&playerId&&r.playerSockets[playerId]===socket.id){r.state.players[playerId]=false;delete r.playerSockets[playerId];if(r.state.phase==="playing"){r.state.phase="paused";r.state.message=`Player ${playerId} link lost`;r.pausedAt=Date.now()}}if(role==="display"&&r.displaySocket===socket.id)r.displaySocket=undefined;broadcast(r);if(!r.displaySocket&&!r.state.players[1]&&!r.state.players[2])r.emptySince=Date.now()})
});
export function cleanupRooms(now=Date.now()){for(const[c,r]of rooms)if(r.emptySince&&r.emptySince<now-120000){log("info","room.expired",{roomCode:c});stop(r);rooms.delete(c)}}
const cleanup=setInterval(cleanupRooms,30000);cleanup.unref();
export async function shutdown(signal="manual"){if(draining)return;draining=true;log("info","server.draining",{signal,rooms:rooms.size});clearInterval(cleanup);stopRooms();io.emit("room:error","Server restarting");io.disconnectSockets(true);await new Promise<void>(resolve=>{if(!httpServer.listening)return resolve();httpServer.close(()=>resolve())})}
const port=Number(process.env.PORT||3001);if(process.env.NODE_ENV!=="test"){httpServer.listen(port,()=>log("info","server.ready",{port}));for(const signal of ["SIGTERM","SIGINT"] as const)process.once(signal,()=>{void shutdown(signal).then(()=>process.exit(0))})}
