import { io } from "socket.io-client";

const url = process.env.RIFT_SERVER_URL ?? "https://rift-hunters.onrender.com";
const sockets = [];
const connect = () => {
  const socket = io(url, { transports: ["websocket"], forceNew: true, timeout: 10_000 });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
};
const ack = (socket, event, payload) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${event} timeout`)), 10_000);
  const done = (result) => { clearTimeout(timer); resolve(result); };
  payload === undefined ? socket.emit(event, done) : socket.emit(event, payload, done);
});
const waitFor = (socket, event, predicate) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`${event} timeout`)); }, 10_000);
  const handler = (value) => {
    if (!predicate(value)) return;
    clearTimeout(timer);
    socket.off(event, handler);
    resolve(value);
  };
  socket.on(event, handler);
});

let display;
let roomCode;
let displayToken;
try {
  const ready = await fetch(`${url}/ready`);
  if (!ready.ok || !(await ready.json()).ready) throw new Error("backend not ready");
  display = await connect();
  const room = await ack(display, "room:create");
  roomCode = room.roomCode;
  displayToken = room.token;
  const p1 = await connect();
  const p2 = await connect();
  const one = await ack(p1, "room:join", { roomCode, role: "player" });
  const two = await ack(p2, "room:join", { roomCode, role: "player" });
  if (one.playerId !== 1 || two.playerId !== 2) throw new Error("player allocation failed");
  const statePromise = waitFor(display, "room:state", (state) => state.aims[1].sequence === 1);
  p1.emit("controller:aim", { roomCode, playerId: 1, token: one.token, x: 0.82, y: 0.24, sequence: 1 });
  const state = await statePromise;
  if (Math.abs(state.aims[1].x - 0.82) > 0.001) throw new Error("aim propagation failed");
  const sentAt = Date.now();
  const ping = await ack(p1, "connection:ping", { sentAt });
  console.log(JSON.stringify({ ok: true, url, roomCode, players: [one.playerId, two.playerId], rttMs: Date.now() - ping.sentAt }));
} finally {
  if (display && roomCode && displayToken) display.emit("room:close", { roomCode, token: displayToken });
  sockets.forEach((socket) => socket.disconnect());
}
