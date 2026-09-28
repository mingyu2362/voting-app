import { describe, expect, it } from "vitest";
import { isPollClosed } from "@/lib/poll-status";

// Pure function, no DB — runnable without TEST_DATABASE_URL. See
// .scratch/voting-app-deadline/issues/01-foundation-closes-at-and-pure-helpers.md.
describe("isPollClosed (ticket 01)", () => {
  const now = Date.parse("2026-01-15T12:00:00.000Z");

  it("is never closed when closesAt is null (무기한)", () => {
    expect(isPollClosed(null, now)).toBe(false);
  });

  it("is never closed when closesAt is undefined", () => {
    expect(isPollClosed(undefined, now)).toBe(false);
  });

  it("is closed when closesAt is in the past", () => {
    const past = new Date(now - 1000);
    expect(isPollClosed(past, now)).toBe(true);
  });

  it("is not closed when closesAt is in the future", () => {
    const future = new Date(now + 1000);
    expect(isPollClosed(future, now)).toBe(false);
  });

  it("is closed at the exact boundary (closesAt === now)", () => {
    expect(isPollClosed(new Date(now), now)).toBe(true);
  });

  it("accepts an ISO string closesAt", () => {
    expect(isPollClosed(new Date(now - 1000).toISOString(), now)).toBe(true);
    expect(isPollClosed(new Date(now + 1000).toISOString(), now)).toBe(false);
  });

  it("accepts an epoch-ms number closesAt", () => {
    expect(isPollClosed(now - 1000, now)).toBe(true);
    expect(isPollClosed(now + 1000, now)).toBe(false);
  });

  it("defaults `now` to the current time when omitted", () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    expect(isPollClosed(past)).toBe(true);
    expect(isPollClosed(future)).toBe(false);
  });
});
