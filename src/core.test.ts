import { describe, expect, test } from "bun:test";
import { checkBlocked, truncate } from "./safety.ts";
import { shQuote } from "./tmux.ts";

describe("safety", () => {
  test("blocks rm -rf /", () => {
    expect(checkBlocked("rm -rf /")).not.toBeNull();
  });
  test("allows normal commands", () => {
    expect(checkBlocked("ls -la /tmp")).toBeNull();
    expect(checkBlocked("bun test")).toBeNull();
  });
  test("truncate caps at 32k", () => {
    const big = "x".repeat(40_000);
    const t = truncate(big);
    expect(t.truncated).toBe(true);
    expect(t.text.length).toBeLessThan(big.length);
  });
});

describe("tmux quoting", () => {
  test("shQuote escapes single quotes", () => {
    expect(shQuote("a'b")).toBe(`'a'\\''b'`);
  });
});
