import { describe, expect, it } from "vitest";
import { clampAim, COMBO_WINDOW_MS, createTarget, initialState, outcomeFor, resolveShot, shiftTargetExpiry, targetLifetime, waveForTime, type GameState } from "./game.js";

const target=(kind:"red"|"blue"|"combo"):GameState=>{const state=initialState("ABC123");state.phase="playing";state.aims[1]={x:.5,y:.5,sequence:1};state.aims[2]={x:.5,y:.5,sequence:1};state.target={id:"t",kind,x:.5,y:.5,radius:.1,expiresAt:2000,hits:[],hitAt:{}};return state};

describe("authoritative game logic",()=>{
 it("clamps valid aim and rejects invalid payloads",()=>{expect(clampAim({x:2,y:-1,sequence:3.9})).toEqual({x:1,y:0,sequence:3});expect(clampAim({x:NaN,y:0,sequence:1})).toBeNull()});
 it("scores only the matching player",()=>{const state=target("red");expect(resolveShot(state,2)).toMatchObject({hit:false});expect(state.score).toBe(0);expect(resolveShot(state,1)).toMatchObject({hit:true,scored:true});expect(state.score).toBe(100)});
 it("requires combo hits within one second",()=>{const state=target("combo");expect(resolveShot(state,1,1000).combo).toBe(false);expect(resolveShot(state,2,1000+COMBO_WINDOW_MS).combo).toBe(true);expect(state.score).toBe(300);const late=target("combo");resolveShot(late,1,1000);expect(resolveShot(late,2,2001).combo).toBe(false);expect(late.score).toBe(0)});
 it("never makes score negative",()=>{const state=target("blue");resolveShot(state,1);expect(state.score).toBe(0)});
 it("shifts target expiry after pause",()=>{const state=target("combo");shiftTargetExpiry(state,750);expect(state.target?.expiresAt).toBe(2750)});
 it("tracks shots, hits, misses, and both combo contributors",()=>{const state=target("combo");resolveShot(state,1,1000);resolveShot(state,2,1500);expect(state.stats).toEqual({1:{shots:1,hits:1,misses:0,combos:1},2:{shots:1,hits:1,misses:0,combos:1}});const miss=target("red");resolveShot(miss,2);expect(miss.stats[2]).toEqual({shots:1,hits:0,misses:1,combos:0})});
 it("derives victory from timer and defeat from depleted shield",()=>{expect(outcomeFor(5,0)).toBe("victory");expect(outcomeFor(0,30)).toBe("defeat");expect(outcomeFor(3,30)).toBeNull();expect(outcomeFor(0,0)).toBe("defeat")});
 it("progresses through three waves with faster targets",()=>{expect([waveForTime(180),waveForTime(121),waveForTime(120),waveForTime(61),waveForTime(60),waveForTime(0)]).toEqual([1,1,2,2,3,3]);expect([targetLifetime(1),targetLifetime(2),targetLifetime(3)]).toEqual([2600,2050,1500]);expect(createTarget(60,1000,()=>.9,"late")).toMatchObject({kind:"combo",expiresAt:2500})});
});
