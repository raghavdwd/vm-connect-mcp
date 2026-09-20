import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyEdit, buildRgCommand, resolveRemote, sliceText } from "../src/files.ts";
import { checkPath, checkSensitiveExec, redactSecrets, saveLog } from "../src/safety.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "vmc-"));
  process.env.VM_CONNECT_DIR = dir;
});

afterEach(async () => {
  delete process.env.VM_CONNECT_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("checkPath", () => {
  test("blocks traversal and sensitive paths", () => {
    expect(checkPath("")).not.toBeNull();
    expect(checkPath("a/../../etc/passwd")).not.toBeNull();
    expect(checkPath("/home/u/.ssh/id_ed25519")).not.toBeNull();
    expect(checkPath("/etc/shadow")).not.toBeNull();
    expect(checkPath("key.pem")).not.toBeNull();
  });
  test("allows normal paths", () => {
    expect(checkPath("/home/ubuntu/app/index.ts")).toBeNull();
    expect(checkPath("relative/file.txt")).toBeNull();
  });
});

describe("sliceText", () => {
  test("pages 1-indexed lines", () => {
    const s = sliceText("a\nb\nc\nd", 2, 2);
    expect(s.text).toBe("b\nc");
    expect(s.total).toBe(4);
    expect([s.start, s.end]).toEqual([2, 3]);
  });
});

describe("applyEdit", () => {
  test("replaces single occurrence", () => {
    expect(applyEdit("hello world", "world", "there").text).toBe("hello there");
  });
  test("throws when missing", () => {
    expect(() => applyEdit("abc", "z", "y")).toThrow("not found");
  });
  test("throws on multiple without replaceAll, replaces all with it", () => {
    expect(() => applyEdit("a-a-a", "a", "b")).toThrow("replaceAll");
    const r = applyEdit("a-a-a", "a", "b", true);
    expect(r.text).toBe("b-b-b");
    expect(r.count).toBe(3);
  });
});

describe("resolveRemote", () => {
  test("joins cwd for relative paths, keeps absolute", () => {
    expect(resolveRemote("f.txt", "/home/u")).toBe("/home/u/f.txt");
    expect(resolveRemote("/abs/f.txt", "/home/u")).toBe("/abs/f.txt");
  });
});

describe("buildRgCommand", () => {
  test("quotes pattern and path, adds glob and limit", () => {
    const cmd = buildRgCommand("foo bar", { path: "/srv/app", glob: "*.ts", limit: 5 });
    expect(cmd.startsWith("rg ")).toBe(true);
    expect(cmd).toContain("-m 5");
    expect(cmd).toContain("--glob");
    expect(cmd).toContain("--");
    expect(cmd).toContain("'/srv/app'");
  });
  test("rejects empty pattern", () => {
    expect(() => buildRgCommand("")).toThrow();
  });
});

describe("checkPath secrets", () => {
  test("blocks .env basenames", () => {
    for (const p of [".env", "/app/.env", "/app/.env.local", "prod.env", ".envrc", "/app/.env.production"]) {
      expect(checkPath(p), p).not.toBeNull();
    }
  });
  test("allows lookalikes", () => {
    expect(checkPath("env.example")).toBeNull();
    expect(checkPath("/app/environment.ts")).toBeNull();
  });
});

describe("checkSensitiveExec", () => {
  test("blocks .env reads and writes", () => {
    for (const c of [
      "cat .env",
      "cat /app/.env.local",
      "cp prod.env /tmp/x",
      "echo SECRET=x >> .env",
      "cat < .env",
      "grep -r FOO .env.production",
    ]) {
      expect(checkSensitiveExec(c), c).not.toBeNull();
    }
  });
  test("blocks .ssh access", () => {
    for (const c of ["cat ~/.ssh/config", "ls ~/.ssh", "cat ~/.ssh/id_ed25519", "scp -r ~/.ssh/ /tmp"]) {
      expect(checkSensitiveExec(c), c).not.toBeNull();
    }
  });
  test("blocks env dumping", () => {
    for (const c of ["env", "printenv", "printenv FOO", "set", "echo hi; env", "env | grep FOO"]) {
      expect(checkSensitiveExec(c), c).not.toBeNull();
    }
  });
  test("refusal cites developer policy", () => {
    expect(checkSensitiveExec("cat .env")).toContain("developer has not allowed");
    expect(checkSensitiveExec("env")).toContain("developer has not allowed");
  });
  test("allows legit commands", () => {
    for (const c of [
      "ls /tmp",
      "cat app.py",
      "set -e; npm run build",
      "set -o pipefail",
      "env FOO=bar npm start",
      "grep -r TODO src",
      "echo .environment ready",
    ]) {
      expect(checkSensitiveExec(c), c).toBeNull();
    }
  });
});

describe("redactSecrets", () => {
  test("redacts secret assignments, keeps normal text", () => {
    expect(redactSecrets("export API_KEY=abc123")).toBe("export API_KEY=[REDACTED]");
    expect(redactSecrets('{"password": "hunter2"}')).toBe('{"password": [REDACTED]}');
    expect(redactSecrets("ls /tmp")).toBe("ls /tmp");
  });
  test("redacts private key blocks", () => {
    const pem = "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----";
    expect(redactSecrets(`key ${pem} end`)).toBe("key [REDACTED PRIVATE KEY] end");
  });
});

describe("saveLog redaction", () => {
  test("redacts exec output logs, keeps backups exact", async () => {
    const p1 = await saveLog("a1", "export TOKEN=abc", { redact: true });
    expect(await Bun.file(p1).text()).toBe("export TOKEN=[REDACTED]");
    const p2 = await saveLog("a2.bak", "export TOKEN=abc");
    expect(await Bun.file(p2).text()).toBe("export TOKEN=abc");
  });
});
