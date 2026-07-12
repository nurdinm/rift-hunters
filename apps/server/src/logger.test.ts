import { describe, expect, it } from "vitest";
import { entry, sanitize } from "./logger.js";

describe("structured logger",()=>{
 it("redacts secrets and sensor coordinates",()=>{expect(sanitize({token:"secret",displayToken:"secret",playerTokens:{1:"secret"},x:.2,y:.8,roomCode:"ABC123",playerId:1})).toEqual({roomCode:"ABC123",playerId:1})});
 it("emits a bounded structured entry",()=>{const value=entry("warn","payload.rejected",{roomCode:"A".repeat(200),reason:"invalid"});expect(value).toMatchObject({level:"warn",event:"payload.rejected",roomCode:"A".repeat(80),reason:"invalid"});expect(Number.isNaN(Date.parse(value.time))).toBe(false)});
});
