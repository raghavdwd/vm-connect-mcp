import { describe, expect, test } from "bun:test";
import { filterNoise, wrapCommand } from "../src/ssh.ts";

function unwrap(w: string): string {
  const m = w.match(/<<< "([^"]+)"\)/);
  if (!m) throw new Error(`cannot unwrap: ${w}`);
  return Buffer.from(m[1], "base64").toString();
}

describe("wrapCommand", () => {
  test("wraps in bash -lic", () => {
    expect(wrapCommand("echo hi").startsWith("bash -lic ")).toBe(true);
    expect(unwrap(wrapCommand("echo hi"))).toBe("echo hi");
  });

  test("cwd prepends cd &&", () => {
    expect(unwrap(wrapCommand("npm run build", "/home/ubuntu/project"))).toBe(
      "cd '/home/ubuntu/project' && npm run build",
    );
  });

  test("single quotes in cwd survive base64 round-trip", () => {
    expect(unwrap(wrapCommand("echo hi", "/home/o'brien/x"))).toBe(
      "cd '/home/o'\\''brien/x' && echo hi",
    );
  });
});

describe("filterNoise", () => {
  test("strips login-shell job control noise", () => {
    const raw = "bash: cannot set terminal process group (-1): Inappropriate ioctl for device\nbash: no job control in this shell\nhello\n";
    expect(filterNoise(raw)).toBe("hello\n");
  });

  test("keeps real stderr", () => {
    expect(filterNoise("warning: something\n")).toBe("warning: something\n");
  });

  test("empty stays empty", () => {
    expect(filterNoise("")).toBe("");
  });
});
