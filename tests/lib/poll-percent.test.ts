import { describe, expect, it } from "vitest";
import { computePercent } from "@/lib/poll-percent";

// Pure function, no DB — runnable without TEST_DATABASE_URL. See
// .scratch/voting-app-deadline/issues/01-foundation-closes-at-and-pure-helpers.md.
describe("computePercent (ticket 01)", () => {
  it("returns 0 when totalVotes is 0 (never divides by zero)", () => {
    expect(computePercent(0, 0)).toBe(0);
  });

  it("returns 100 when all votes went to this choice", () => {
    expect(computePercent(3, 3)).toBe(100);
  });

  it("returns 0 for a choice with no votes among a nonzero total", () => {
    expect(computePercent(0, 5)).toBe(0);
  });

  it("rounds to one decimal place", () => {
    expect(computePercent(1, 3)).toBe(33.3);
    expect(computePercent(2, 3)).toBe(66.7);
    expect(computePercent(1, 6)).toBe(16.7);
  });

  it("handles an even split", () => {
    expect(computePercent(1, 2)).toBe(50);
  });
});
