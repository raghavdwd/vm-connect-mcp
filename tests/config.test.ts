import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addVm, getActive, listVms, migrateLegacy, paths, readVm, resolveVm, rmVm, setActive } from "../src/config.ts";
import { toolSchemas } from "../src/mcp.ts";

const conn = { host: "1.2.3.4", user: "ubuntu", port: 22, keyPath: "/home/x/id_ed25519" };
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "vmc-"));
  process.env.VM_CONNECT_DIR = dir;
  delete process.env.VM_CONNECT_VM;
});

afterEach(async () => {
  delete process.env.VM_CONNECT_DIR;
  delete process.env.VM_CONNECT_VM;
  await rm(dir, { recursive: true, force: true });
});

describe("vm store", () => {
  test("first add auto-activates, later adds do not", async () => {
    expect(await addVm("build", conn)).toBe(true);
    expect(await getActive()).toBe("build");
    expect(await addVm("prod", conn)).toBe(false);
    expect(await getActive()).toBe("build");
    expect(await listVms()).toEqual(["build", "prod"]);
  });

  test("use flips active, rm of active clears it", async () => {
    await addVm("build", conn);
    await addVm("prod", conn);
    await setActive("prod");
    expect((await resolveVm()).name).toBe("prod");
    expect(await rmVm("prod")).toBe(true);
    expect(await getActive()).toBeNull();
    expect(await rmVm("build")).toBe(false);
    expect(await listVms()).toEqual([]);
  });

  test("resolve precedence: explicit arg > VM_CONNECT_VM > active file", async () => {
    await addVm("a", conn);
    await addVm("b", { ...conn, host: "5.6.7.8" });
    await addVm("c", conn);
    await setActive("a");
    expect((await resolveVm("b")).name).toBe("b");
    process.env.VM_CONNECT_VM = "c";
    expect((await resolveVm()).name).toBe("c");
    expect((await resolveVm("b")).name).toBe("b");
  });

  test("unknown name lists available VMs", async () => {
    await addVm("build", conn);
    await expect(resolveVm("nope")).rejects.toThrow(/no VM "nope" — available: build/);
  });

  test("empty store explains how to add", async () => {
    await expect(resolveVm()).rejects.toThrow(/no VMs configured — run: vm add/);
  });

  test("name validation rejects path traversal", async () => {
    await expect(addVm("../evil", conn)).rejects.toThrow(/invalid VM name/);
    await expect(readVm("a/b")).rejects.toThrow(/invalid VM name/);
  });

  test("legacy config.json migrates once to default", async () => {
    const p = paths();
    await writeFile(p.CONFIG_PATH, JSON.stringify({ host: "9.9.9.9", user: "root", port: 2222 }));
    expect(await migrateLegacy()).toBe(true);
    const cfg = await resolveVm();
    expect(cfg).toMatchObject({ name: "default", host: "9.9.9.9", user: "root", port: 2222 });
    expect(await Bun.file(p.CONFIG_PATH + ".bak").exists()).toBe(true);
    expect(await Bun.file(p.CONFIG_PATH).exists()).toBe(false);
    expect(await migrateLegacy()).toBe(false); // no double-run
    expect(await getActive()).toBe("default");
  });

  test("legacy config without host is left alone", async () => {
    const p = paths();
    await writeFile(p.CONFIG_PATH, JSON.stringify({ user: "root" }));
    expect(await migrateLegacy()).toBe(false);
    expect(await Bun.file(p.CONFIG_PATH).exists()).toBe(true);
  });
});

describe("mcp tool schemas", () => {
  test("no connection params on any tool", async () => {
    const banned = ["host", "user", "port", "keyPath", "password"];
    for (const [name, schema] of Object.entries(toolSchemas)) {
      for (const key of banned) {
        expect(Object.keys(schema), `${name} must not accept ${key}`).not.toContain(key);
      }
    }
    expect(Object.keys(toolSchemas)).toHaveLength(7);
  });
});
