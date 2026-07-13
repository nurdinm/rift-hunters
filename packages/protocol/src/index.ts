export type PlayerId = 1 | 2;
export type TargetKind = "red" | "blue" | "combo";
export type GamePhase = "lobby" | "countdown" | "playing" | "paused" | "finished";
export type GameOutcome = "victory" | "defeat" | null;
export type ControlMode = "phone" | "hand";
export interface Aim { x: number; y: number; sequence: number }
export interface PlayerStats { shots: number; hits: number; misses: number; combos: number }
export interface Target { id: string; kind: TargetKind; x: number; y: number; radius: number; expiresAt: number; hits: PlayerId[] }
export interface PublicRoom { code: string; phase: GamePhase; outcome: GameOutcome; controlMode: ControlMode; players: Record<PlayerId, boolean>; aims: Record<PlayerId, Aim>; ammo: Record<PlayerId, number>; maxAmmo: number; stats: Record<PlayerId, PlayerStats>; target: Target | null; score: number; health: number; timeLeft: number; countdown: number; wave: number; totalWaves: number; tutorialStep: number; message?: string }
export interface JoinResult { ok: boolean; error?: string; playerId?: PlayerId; token?: string; state?: PublicRoom }
export interface ClientToServerEvents {
 "room:create": (cb:(r:{ok:boolean;roomCode?:string;token?:string;error?:string})=>void)=>void;
 "room:join": (d:{roomCode:string;role:"display"|"player";token?:string},cb:(r:JoinResult)=>void)=>void;
 "game:start": (d:{roomCode:string;token:string})=>void; "game:pause": (d:{roomCode:string;token:string})=>void; "game:restart": (d:{roomCode:string;token:string})=>void; "tutorial:set": (d:{roomCode:string;token:string;step:number})=>void; "room:close": (d:{roomCode:string;token:string})=>void;
 "control:set": (d:{roomCode:string;token:string;mode:ControlMode})=>void;
 "hand:presence": (d:{roomCode:string;token:string;players:Record<PlayerId,boolean>})=>void;
 "hand:aim": (d:{roomCode:string;token:string;playerId:PlayerId;x:number;y:number;sequence:number})=>void;
 "hand:shoot": (d:{roomCode:string;token:string;playerId:PlayerId;sequence:number;clientTime:number})=>void;
 "hand:reload": (d:{roomCode:string;token:string;playerId:PlayerId})=>void;
 "controller:aim": (d:{roomCode:string;playerId:PlayerId;token:string;x:number;y:number;sequence:number})=>void;
 "controller:shoot": (d:{roomCode:string;playerId:PlayerId;token:string;sequence:number;clientTime:number})=>void;
 "controller:reload": (d:{roomCode:string;playerId:PlayerId;token:string})=>void;
 "connection:ping": (d:{sentAt:number},cb:(r:{sentAt:number;serverAt:number})=>void)=>void;
}
export interface ShotEvent { playerId:PlayerId; hit:boolean; combo:boolean; x:number; y:number }
export interface ServerToClientEvents { "room:state":(s:PublicRoom)=>void; "shot:result":(r:ShotEvent)=>void; "room:error":(m:string)=>void }
