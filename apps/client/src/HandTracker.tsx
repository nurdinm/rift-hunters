import { useEffect, useRef, useState } from "react";
import type { PlayerId } from "@rift/protocol";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@rift/protocol";

interface HandPoint { x: number; y: number }
interface TrackedHand extends HandPoint { playerId: PlayerId; pinch: boolean; fist: boolean }
interface Props {
  active: boolean;
  roomCode: string;
  token: string;
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  video: React.RefObject<HTMLVideoElement | null>;
  onStatus: (status: string) => void;
}

const distance = (a: HandPoint, b: HandPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function HandTracker({ active, roomCode, token, socket, video, onStatus }: Props) {
  const [hands, setHands] = useState<TrackedHand[]>([]);
  const sequence = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const smooth = useRef<Record<PlayerId, HandPoint>>({ 1: { x: 0.3, y: 0.5 }, 2: { x: 0.7, y: 0.5 } });
  const pinched = useRef<Record<PlayerId, boolean>>({ 1: false, 2: false });
  const fistSince = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const reloaded = useRef<Record<PlayerId, boolean>>({ 1: false, 2: false });

  useEffect(() => {
    if (!active || !roomCode || !token) { setHands([]); return; }
    let cancelled = false;
    let frame = 0;
    let stream: MediaStream | undefined;
    let ownsStream = false;
    let landmarker: { detectForVideo: (video: HTMLVideoElement, time: number) => { landmarks?: HandPoint[][] }; close: () => void } | undefined;

    const run = async () => {
      try {
        onStatus("LOADING HAND MODEL");
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
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
        const detect = () => {
          if (cancelled || !landmarker) return;
          if (element.readyState >= 2 && element.currentTime !== lastVideoTime) {
            lastVideoTime = element.currentTime;
            const result = landmarker.detectForVideo(element, performance.now());
            const found = (result.landmarks ?? []).map((marks) => {
              const index = marks[8], thumb = marks[4], wrist = marks[0];
              const screenX = 1 - index.x;
              return { marks, screenX, index, pinch: distance(index, thumb) < 0.055, fist: [8, 12, 16, 20].every((tip) => distance(marks[tip], wrist) < 0.34) };
            }).sort((a, b) => a.screenX - b.screenX);
            const tracked: TrackedHand[] = found.slice(0, 2).map((hand, index) => {
              const playerId = found.length === 1 ? (hand.screenX < 0.5 ? 1 : 2) : (index + 1) as PlayerId;
              const previous = smooth.current[playerId];
              const next = { x: previous.x * 0.68 + hand.screenX * 0.32, y: previous.y * 0.68 + hand.index.y * 0.32 };
              smooth.current[playerId] = next;
              socket.emit("hand:aim", { roomCode, token, playerId, ...next, sequence: ++sequence.current[playerId] });
              if (hand.pinch && !pinched.current[playerId]) socket.emit("hand:shoot", { roomCode, token, playerId, sequence: ++sequence.current[playerId], clientTime: Date.now() });
              pinched.current[playerId] = hand.pinch;
              if (hand.fist) {
                fistSince.current[playerId] ||= performance.now();
                if (!reloaded.current[playerId] && performance.now() - fistSince.current[playerId] > 650) {
                  socket.emit("hand:reload", { roomCode, token, playerId });
                  reloaded.current[playerId] = true;
                }
              } else { fistSince.current[playerId] = 0; reloaded.current[playerId] = false; }
              return { playerId, ...next, pinch: hand.pinch, fist: hand.fist };
            });
            for (const playerId of [1, 2] as PlayerId[]) if (!tracked.some((hand) => hand.playerId === playerId)) pinched.current[playerId] = false;
            setHands(tracked);
            onStatus(tracked.length === 2 ? "2 HANDS ONLINE" : `${tracked.length}/2 HANDS FOUND`);
          }
          frame = requestAnimationFrame(detect);
        };
        detect();
      } catch (error) {
        console.error("Hand tracking failed", error);
        onStatus("HAND TRACKING ERROR");
      }
    };
    void run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      landmarker?.close();
      if (ownsStream && stream && video.current?.srcObject === stream) {
        stream.getTracks().forEach((track) => track.stop());
        video.current.srcObject = null;
      }
      setHands([]);
    };
  }, [active, roomCode, socket, token, video, onStatus]);

  if (!active) return null;
  return <div className="hand-overlay" aria-hidden="true">
    {hands.map((hand) => <div key={hand.playerId} className={`hand-cursor p${hand.playerId} ${hand.pinch ? "pinch" : ""} ${hand.fist ? "fist" : ""}`} style={{ left: `${hand.x * 100}%`, top: `${hand.y * 100}%` }}>
      <i /><b>P{hand.playerId}</b><span>{hand.fist ? "RELOAD" : hand.pinch ? "FIRE" : "AIM"}</span>
    </div>)}
  </div>;
}
