import { useEffect, useRef, useState } from "react";
import type { PlayerId } from "@rift/protocol";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@rift/protocol";
import { assignPlayers, isFist, nextPinch, pinchRatio, smoothAim, isOpenPalm, detectSwipe } from "./handMath";
import type { Point } from "./handMath";

interface HandPoint { x: number; y: number }
interface TrackedHand extends HandPoint { playerId: PlayerId; pinch: boolean; fist: boolean; ability: boolean; landmarks: HandPoint[] | null }
interface TrainingState { hands: boolean; aim: boolean; pinch: boolean; fist: boolean; ability: boolean; super: boolean }
interface Props {
  active: boolean;
  roomCode: string;
  token: string;
  mode: "coop" | "solo";
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  video: React.RefObject<HTMLVideoElement | null>;
  onStatus: (status: string) => void;
  retryKey: number;
}

export function HandTracker({ active, roomCode, token, mode, socket, video, onStatus, retryKey }: Props) {
  const [hands, setHands] = useState<TrackedHand[]>([]);
  const [training, setTraining] = useState<TrainingState>({ hands: false, aim: false, pinch: false, fist: false, ability: false, super: false });
  const trainingRef = useRef<TrainingState>({ hands: false, aim: false, pinch: false, fist: false, ability: false, super: false });
  const sequence = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const smooth = useRef<Record<PlayerId, HandPoint>>({ 1: { x: 0.3, y: 0.5 }, 2: { x: 0.7, y: 0.5 } });
  const pinched = useRef<Record<PlayerId, boolean>>({ 1: false, 2: false });
  const fistSince = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const reloaded = useRef<Record<PlayerId, boolean>>({ 1: false, 2: false });
  const presence = useRef("00");
  const lastSeen = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const lastRaw = useRef<Partial<Record<PlayerId, HandPoint>>>({});
  const aimTravel = useRef(0);
  const ghostSince = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const lastPalmPos = useRef<Record<PlayerId, Point>>({ 1: { x: 0, y: 0 }, 2: { x: 0, y: 0 } });
  const lastPalmTime = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const lastPinchTime = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });


  useEffect(() => {
    if (!active || !roomCode || !token) { setHands([]); return; }
    const initialTraining: TrainingState = { hands: false, aim: false, pinch: false, fist: false, ability: false, super: false };
    trainingRef.current = initialTraining;
    setTraining(initialTraining);
    lastRaw.current = {};
    aimTravel.current = 0;
    const completeTraining = (step: keyof TrainingState) => {
      if (trainingRef.current[step]) return;
      const next = { ...trainingRef.current, [step]: true };
      trainingRef.current = next;
      setTraining(next);
    };
    let cancelled = false;
    let frame = 0;
    let stream: MediaStream | undefined;
    let ownsStream = false;
    let landmarker: { detectForVideo: (video: HTMLVideoElement, time: number) => { landmarks?: HandPoint[][] }; close: () => void } | undefined;

    const run = async () => {
      try {
        onStatus("LOADING HAND MODEL");
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm");
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.6,
        });
        if (cancelled) return;
        const element = video.current;
        if (!element) throw new Error("Video element unavailable");
        if (element.srcObject instanceof MediaStream) stream = element.srcObject;
        else {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: false });
          ownsStream = true;
          element.srcObject = stream;
        }
        await element.play();
        onStatus("SHOW TWO HANDS");
        let lastVideoTime = -1;
        let frameTimes: number[] = [];
        const detect = () => {
          if (cancelled || !landmarker) return;
          if (element.readyState >= 2 && element.currentTime !== lastVideoTime) {
            lastVideoTime = element.currentTime;
            const frameStart = performance.now();
            const result = landmarker.detectForVideo(element, performance.now());
            const found = (result.landmarks ?? []).map((marks) => {
              const index = marks[8];
              const screenX = 1 - index.x;
              return { marks, screenX, index };
            }).sort((a, b) => a.screenX - b.screenX);
            const handsToTrack = mode === "solo" ? found.slice(0, 1) : found.slice(0, 2);
            if (handsToTrack.length === (mode === "solo" ? 1 : 2)) completeTraining("hands");
            const players = assignPlayers(handsToTrack.map((hand) => hand.screenX));
            const now = performance.now();
            const tracked: TrackedHand[] = handsToTrack.map((hand, index) => {
              const playerId = players[index] as PlayerId;
              const raw = { x: hand.screenX, y: hand.index.y };
              const priorRaw = lastRaw.current[playerId];
              if (trainingRef.current.hands && priorRaw && !trainingRef.current.aim) {
                aimTravel.current += Math.hypot(raw.x - priorRaw.x, raw.y - priorRaw.y);
                if (aimTravel.current > 0.1) completeTraining("aim");
              }
              lastRaw.current[playerId] = raw;
              const previous = smooth.current[playerId];
              const next = smoothAim(previous, raw);
              smooth.current[playerId] = next;
              lastSeen.current[playerId] = performance.now();
              if (next.x !== previous.x || next.y !== previous.y) socket.emit("hand:aim", { roomCode, token, playerId, ...next, sequence: ++sequence.current[playerId] });
              const pinch = nextPinch(pinchRatio(hand.marks), pinched.current[playerId]);
              const fist = isFist(hand.marks);
              if (pinch && !pinched.current[playerId]) {
                socket.emit("hand:shoot", { roomCode, token, playerId, sequence: ++sequence.current[playerId], clientTime: Date.now() });
                if (trainingRef.current.aim) completeTraining("pinch");
              }
              pinched.current[playerId] = pinch;
              if (fist) {
                fistSince.current[playerId] ||= performance.now();
                if (!reloaded.current[playerId] && performance.now() - fistSince.current[playerId] > 800) {
                  socket.emit("hand:reload", { roomCode, token, playerId });
                  reloaded.current[playerId] = true;
                  if (trainingRef.current.pinch) completeTraining("fist");
                }
              } else { fistSince.current[playerId] = 0; reloaded.current[playerId] = false; }

              const openPalm = isOpenPalm(hand.marks);
              let didAbility = false;
              if (openPalm) {
                const prev = lastPalmPos.current[playerId];
                const curr = { x: hand.screenX, y: hand.index.y };
                lastPalmPos.current[playerId] = curr;
                const dt = lastPalmTime.current[playerId] > 0 ? now - lastPalmTime.current[playerId] : 999;
                lastPalmTime.current[playerId] = now;
                if (dt <= 300 && prev.x !== 0 && detectSwipe(prev, curr, dt)) {
                  socket.emit("hand:ability", { roomCode, token, playerId });
                  didAbility = true;
                  if (trainingRef.current.fist) completeTraining("ability");
                }
              } else {
                lastPalmTime.current[playerId] = 0;
              }

              if (pinch && !pinched.current[playerId]) {
                lastPinchTime.current[playerId] = performance.now();
              }

              let didSuper = false;
              const other = playerId === 1 ? 2 : 1;
              if (pinch && pinched.current[other]) {
                const dt = Math.abs(performance.now() - lastPinchTime.current[other]);
                if (dt <= 200 && found.length === 2 && mode === "coop") {
                  socket.emit("hand:super", { roomCode, token });
                  didSuper = true;
                  if (trainingRef.current.ability) completeTraining("super");
                }
              }

              const skeletonLandmarks = hand.marks.map(m => ({ x: 1 - m.x, y: m.y }));
              return { playerId, ...next, pinch, fist, ability: didAbility, landmarks: skeletonLandmarks };
            });
            const GHOST_MS = 500;
            for (const playerId of (mode === "solo" ? [1] : [1, 2]) as PlayerId[]) {
              const seen = tracked.some(h => h.playerId === playerId);
              if (seen) {
                ghostSince.current[playerId] = 0;
              } else if (lastSeen.current[playerId] > 0) {
                const lost = now - lastSeen.current[playerId];
                if (ghostSince.current[playerId] === 0) ghostSince.current[playerId] = now;
                if (lost < GHOST_MS) {
                  const gs = smooth.current[playerId];
                  tracked.push({ playerId, ...gs, pinch: false, fist: false, ability: false, landmarks: null });
                } else {
                  lastSeen.current[playerId] = 0;
                }
              }
            }
            const nextPresence = `${Number(now-lastSeen.current[1]<350)}${mode==="solo"?"1":Number(now-lastSeen.current[2]<350)}`;
            if (nextPresence !== presence.current) {
              presence.current = nextPresence;
              socket.emit("hand:presence", { roomCode, token, players: { 1: nextPresence[0] === "1", 2: nextPresence[1] === "1" } });
            }
            for (const playerId of (mode === "solo" ? [1] : [1, 2]) as PlayerId[]) if (!tracked.some((hand) => hand.playerId === playerId)) pinched.current[playerId] = false;
            setHands(tracked);
            onStatus(mode === "solo" ? (tracked.length >= 1 ? "1 HAND ONLINE" : "SHOW HAND") : tracked.length === 2 ? "2 HANDS ONLINE" : `${tracked.length}/2 HANDS FOUND`);
            const frameEnd = performance.now();
            frameTimes.push(frameEnd - frameStart);
            if (frameTimes.length > 60) frameTimes.shift();
            const avgFrame = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            if (frameTimes.length >= 30 && avgFrame > 66) {
              onStatus("WARNING: LOW LIGHT — IMPROVE LIGHTING");
            }
          }
          frame = requestAnimationFrame(detect);
        };
        detect();
      } catch (error) {
        console.error("Hand tracking failed", error);
        socket.emit("hand:presence", { roomCode, token, players: { 1: false, 2: false } });
        const name = error instanceof DOMException ? error.name : "MODEL_ERROR";
        onStatus(name === "NotAllowedError" ? "CAMERA PERMISSION DENIED" : name === "NotFoundError" ? "CAMERA NOT FOUND" : `HAND ERROR: ${name}`);
      }
    };
    void run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      landmarker?.close();
      socket.emit("hand:presence", { roomCode, token, players: { 1: false, 2: false } });
      if (ownsStream && stream && video.current?.srcObject === stream) {
        stream.getTracks().forEach((track) => track.stop());
        video.current.srcObject = null;
      }
      setHands([]);
    };
  }, [active, roomCode, socket, token, video, onStatus, retryKey]);

  if (!active) return null;
  const isComplete = mode === "solo"
    ? training.hands && training.aim && training.pinch && training.fist && training.ability
    : training.hands && training.aim && training.pinch && training.fist && training.ability && training.super;
  const skeletonConnections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20]];
  return <div className="hand-overlay" aria-hidden="true">
    <div className={`hand-training ${isComplete ? "complete" : ""}`}>
      <small>HAND TRAINING</small>
      <span className={training.hands ? "done" : "active"}>1. {mode === "solo" ? "SHOW HAND" : "SHOW BOTH HANDS"}</span>
      <span className={training.aim ? "done" : training.hands ? "active" : ""}>2. MOVE INDEX TO AIM</span>
      <span className={training.pinch ? "done" : training.aim ? "active" : ""}>3. PINCH TO FIRE</span>
      <span className={training.fist ? "done" : training.pinch ? "active" : ""}>4. HOLD FIST TO RELOAD</span>
      <span className={training.ability ? "done" : training.fist ? "active" : ""}>5. PALM SWIPE (SHIELD)</span>
      {mode === "coop" && <span className={training.super ? "done" : training.ability ? "active" : ""}>6. BOTH PINCH (SUPER)</span>}
      {isComplete && <b>TRAINING COMPLETE</b>}
    </div>
    {hands.map((hand) => <div key={hand.playerId} className={`hand-cursor p${hand.playerId} ${hand.pinch ? "pinch" : ""} ${hand.fist ? "fist" : ""}`} style={{ left: `${hand.x * 100}%`, top: `${hand.y * 100}%` }}>
      <i /><b>P{hand.playerId}</b><span>{hand.fist ? "RELOAD" : hand.pinch ? "FIRE" : hand.ability ? "SHIELD" : "AIM"}</span>
    </div>)}
    <svg className="hand-skeletons" viewBox="0 0 100 100" preserveAspectRatio="none">
      {hands.filter(h => h.landmarks).map((hand) => hand.landmarks!.map((lm, i) => {
        const idx = i === 0 ? 0 : i;
        return idx === 0 ? null : <circle key={`${hand.playerId}-${i}`} cx={lm.x * 100} cy={lm.y * 100} r={i % 4 === 0 ? 1.2 : 0.6} fill={hand.playerId === 1 ? "#ff4a3d" : "#29f2df"} opacity={0.6} />;
      }))}
      {hands.filter(h => h.landmarks).map((hand) => skeletonConnections.map(([a, b]) => {
        const la = hand.landmarks![a], lb = hand.landmarks![b];
        return <line key={`${hand.playerId}-${a}-${b}`} x1={la.x * 100} y1={la.y * 100} x2={lb.x * 100} y2={lb.y * 100} stroke={hand.playerId === 1 ? "#ff4a3d" : "#29f2df"} strokeWidth={0.3} opacity={0.35} />;
      }))}
    </svg>
  </div>;
}
