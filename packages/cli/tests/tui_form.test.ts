import { describe, expect, test } from "bun:test";
import { expandPath, parsePortField, validateVmFields } from "../src/vm_form.ts";

describe("vm_form", () => {
  test("expandPath handles ~ and trims", () => {
    expect(expandPath("~/key.pem")).toBe(`${process.env.HOME}/key.pem`);
    expect(expandPath("  ~/.ssh/id  ")).toBe(`${process.env.HOME}/.ssh/id`);
    expect(expandPath("/abs/path.pem")).toBe("/abs/path.pem");
  });

  test("parsePortField: empty → default, bad → throw", () => {
    expect(parsePortField("")).toBeUndefined();
    expect(parsePortField("  ")).toBeUndefined();
    expect(parsePortField("22")).toBe(22);
    expect(parsePortField("2222")).toBe(2222);
    expect(() => parsePortField("abc")).toThrow(/port must be/);
    expect(() => parsePortField("0")).toThrow(/1-65535/);
    expect(() => parsePortField("99999")).toThrow(/1-65535/);
  });

  test("valid form with .pem key passes", () => {
    const r = validateVmFields({ name: "build", host: "1.2.3.4", user: "ubuntu", port: "22", keyPath: "~/.ssh/key.pem", password: "" });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.value).toMatchObject({ name: "build", host: "1.2.3.4", user: "ubuntu", port: 22 });
    expect(r.value.keyPath).toBe(`${process.env.HOME}/.ssh/key.pem`);
    expect(r.value.warnings).toEqual([]);
  });

  test("missing required fields reported together", () => {
    const r = validateVmFields({ name: "", host: "", user: "", port: "", keyPath: "", password: "" });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("name is required");
    expect(r.errors).toContain("host is required");
    expect(r.errors).toContain("user is required");
  });

  test("bad name and bad port reported", () => {
    const r = validateVmFields({ name: "../evil", host: "h", user: "u", port: "xx", keyPath: "", password: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("invalid name"))).toBe(true);
    expect(r.errors.some((e) => e.includes("port"))).toBe(true);
  });

  test("unusual key extension warns, empty port → undefined", () => {
    const r = validateVmFields({ name: "a", host: "h", user: "u", port: "", keyPath: "~/key.txt", password: "s3cret" });
    expect(r.ok).toBe(true);
    expect(r.value.port).toBeUndefined();
    expect(r.value.password).toBe("s3cret");
    expect(r.value.warnings.length).toBe(1);
  });

  test("ed25519 and extensionless keys pass without warnings", () => {
    for (const keyPath of ["~/.ssh/id_ed25519", "~/.ssh/id_rsa", "~/.ssh/key.pem", "/opt/keys/aws-prod.PEM"]) {
      const r = validateVmFields({ name: "a", host: "h", user: "u", port: "22", keyPath, password: "" });
      expect(r.ok).toBe(true);
      expect(r.value.warnings).toEqual([]);
    }
  });
});
