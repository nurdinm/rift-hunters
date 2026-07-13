import { describe, expect, it } from "vitest";
import { assignPlayers, isFist, isOpenPalm, isThumbsUp, isTwoHandPinch, nextPinch, pinchRatio, smoothAim, detectSwipe, type Point } from "./handMath";

const hand = (scale = 1): Point[] => Array.from({ length: 21 }, () => ({ x: 0, y: 0 })).map((point, index) => ({ ...point, x: index * 0.001 * scale }));

describe("hand gesture math", () => {
  it("normalizes pinch distance against palm size", () => {
    const near = hand();
    near[0] = { x: 0, y: 0 }; near[9] = { x: 0, y: 0.2 }; near[4] = { x: 0, y: 0.1 }; near[8] = { x: 0.04, y: 0.1 };
    const far = near.map((point) => ({ x: point.x * 0.5, y: point.y * 0.5 }));
    expect(pinchRatio(near)).toBeCloseTo(pinchRatio(far));
  });

  it("uses hysteresis so a held pinch does not chatter", () => {
    expect(nextPinch(0.5, false)).toBe(true);
    expect(nextPinch(0.65, true)).toBe(true);
    expect(nextPinch(0.8, true)).toBe(false);
    expect(nextPinch(0.6, false)).toBe(false);
  });

  it("applies a dead zone and accelerates large aim movement", () => {
    const origin = { x: 0.5, y: 0.5 };
    expect(smoothAim(origin, { x: 0.503, y: 0.502 })).toEqual(origin);
    const small = smoothAim(origin, { x: 0.54, y: 0.5 });
    const large = smoothAim(origin, { x: 0.75, y: 0.5 });
    expect(small.x - origin.x).toBeLessThan(large.x - origin.x);
    expect(large.x).toBeCloseTo(0.645);
  });

  it("assigns one hand by side and two hands from left to right", () => {
    expect(assignPlayers([0.2])).toEqual([1]);
    expect(assignPlayers([0.8])).toEqual([2]);
    expect(assignPlayers([0.2, 0.8])).toEqual([1, 2]);
  });

  it("requires folded fingertips and joints for a fist", () => {
    const marks = hand();
    marks[0] = { x: 0, y: 0 }; marks[9] = { x: 0, y: 0.1 };
    for (const [joint, tip] of [[6, 8], [10, 12], [14, 16], [18, 20]]) {
      marks[joint] = { x: 0, y: 0.12 };
      marks[tip] = { x: 0, y: 0.08 };
    }
    expect(isFist(marks)).toBe(true);
    marks[8] = { x: 0, y: 0.35 }; marks[12] = { x: 0, y: 0.35 };
    expect(isFist(marks)).toBe(false);
  });
});

describe("open palm detection", () => {
  it("detects open palm when fingertips are far from wrist", () => {
    const marks = hand();
    marks[0] = { x: 0, y: 0 }; marks[9] = { x: 0, y: 0.2 };
    marks[8] = { x: 0, y: 0.5 }; marks[12] = { x: 0.1, y: 0.5 };
    marks[16] = { x: 0.2, y: 0.5 }; marks[20] = { x: -0.1, y: 0.5 };
    marks[4] = { x: -0.05, y: 0.3 };
    expect(isOpenPalm(marks)).toBe(true);
  });

  it("rejects closed hand as open palm", () => {
    const marks = hand();
    marks[0] = { x: 0, y: 0 }; marks[9] = { x: 0, y: 0.2 };
    marks[8] = { x: 0, y: 0.08 }; marks[12] = { x: 0.1, y: 0.08 };
    marks[16] = { x: 0.2, y: 0.08 }; marks[20] = { x: -0.1, y: 0.08 };
    marks[4] = { x: -0.05, y: 0.1 };
    expect(isOpenPalm(marks)).toBe(false);
  });
});

describe("swipe detection", () => {
  it("detects fast horizontal movement", () => {
    expect(detectSwipe({ x: 0.3, y: 0.5 }, { x: 0.55, y: 0.51 }, 200)).toBe(true);
  });
  it("rejects slow movement", () => {
    expect(detectSwipe({ x: 0.3, y: 0.5 }, { x: 0.35, y: 0.51 }, 200)).toBe(false);
  });
  it("rejects movement that takes too long", () => {
    expect(detectSwipe({ x: 0.3, y: 0.5 }, { x: 0.55, y: 0.51 }, 1000)).toBe(false);
  });
});

describe("thumbs up detection", () => {
  it("detects thumb above all fingertips", () => {
    const marks = hand();
    marks[0] = { x: 0, y: 0 }; marks[9] = { x: 0, y: 0.15 };
    marks[4] = { x: -0.05, y: 0.01 };
    marks[8] = { x: 0, y: 0.12 }; marks[12] = { x: 0.1, y: 0.12 };
    marks[16] = { x: 0.2, y: 0.12 }; marks[20] = { x: -0.1, y: 0.12 };
    expect(isThumbsUp(marks)).toBe(true);
  });

  it("rejects thumb below fingertips", () => {
    const marks = hand();
    marks[0] = { x: 0, y: 0 }; marks[9] = { x: 0, y: 0.15 };
    marks[4] = { x: -0.05, y: 0.15 };
    marks[8] = { x: 0, y: 0.08 }; marks[12] = { x: 0.1, y: 0.08 };
    marks[16] = { x: 0.2, y: 0.08 }; marks[20] = { x: -0.1, y: 0.08 };
    expect(isThumbsUp(marks)).toBe(false);
  });
});

describe("two-hand pinch", () => {
  it("detects simultaneous pinch within 200ms", () => {
    expect(isTwoHandPinch(true, true, 150)).toBe(true);
  });
  it("rejects when only one hand pinches", () => {
    expect(isTwoHandPinch(true, false, 100)).toBe(false);
  });
  it("rejects when timing is too far apart", () => {
    expect(isTwoHandPinch(true, true, 300)).toBe(false);
  });
});
