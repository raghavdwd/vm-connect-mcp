import {
  BoxRenderable,
  InputRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  createCliRenderer,
  type RenderContext,
} from "@opentui/core";
import { existsSync } from "node:fs";
import { addVm, getActive, listVms, readVm, rmVm, setActive, writeVm } from "./config.ts";
import { audit } from "./safety.ts";
import { sshExec } from "./ssh.ts";
import { expandPath, validateVmFields, type VmFormFields } from "./vm_form.ts";

export type TuiMode = "setup" | "manager";

const HINTS = "tab switch · ^S save · ^T test · ^N new · ^D del · ^U use-active · esc quit";

function fieldRow(
  renderer: RenderContext,
  parent: BoxRenderable,
  label: string,
  initial: string,
  placeholder: string,
  width = 42,
): InputRenderable {
  parent.add(new TextRenderable(renderer, { content: label, fg: "#888888" }));
  const input = new InputRenderable(renderer, {
    width,
    value: initial,
    placeholder,
    backgroundColor: "#1a1a1a",
    focusedBackgroundColor: "#2a4a2a",
    textColor: "#FFFFFF",
    cursorColor: "#00FF00",
  });
  parent.add(input);
  return input;
}

export async function runTui(mode: TuiMode): Promise<void> {
  if (!process.stdin.isTTY) throw new Error("TUI needs an interactive terminal (stdin is not a TTY)");

  const renderer = await createCliRenderer({ exitOnCtrlC: true });

  const root = new BoxRenderable(renderer, { width: "100%", height: "100%", flexDirection: "column" });
  const header = new TextRenderable(renderer, { content: `vm-connect ${mode} — ${HINTS}`, fg: "#00FF88" });
  const body = new BoxRenderable(renderer, { flexDirection: "row", flexGrow: 1 });
  const listBox = new BoxRenderable(renderer, {
    width: 28,
    border: true,
    borderStyle: "rounded",
    borderColor: "#00FF88",
    title: "VMs",
    flexShrink: 0,
  });
  const formBox = new BoxRenderable(renderer, {
    flexGrow: 1,
    border: true,
    borderStyle: "rounded",
    borderColor: "#555555",
    title: "Config (.pem key supported)",
    paddingLeft: 1,
    paddingRight: 1,
    flexDirection: "column",
  });
  const status = new TextRenderable(renderer, { content: "loading…", fg: "#AAAAAA", wrapMode: "word" });

  const list = new SelectRenderable(renderer, {
    options: [],
    showDescription: false,
    backgroundColor: "transparent",
    textColor: "#CCCCCC",
    focusedBackgroundColor: "#1a1a1a",
    selectedBackgroundColor: "#00FF88",
    selectedTextColor: "#000000",
  });

  listBox.add(list);
  body.add(listBox);
  body.add(formBox);
  root.add(header);
  root.add(body);
  root.add(status);
  renderer.root.add(root);

  const inputs = {
    name: fieldRow(renderer, formBox, "name", "", "e.g. build"),
    host: fieldRow(renderer, formBox, "host", "", "e.g. 203.0.113.10"),
    user: fieldRow(renderer, formBox, "user", "", "e.g. ubuntu"),
    port: fieldRow(renderer, formBox, "port [22]", "", "22"),
    key: fieldRow(renderer, formBox, "key path (.pem) [optional]", "", "~/.ssh/key.pem"),
    password: fieldRow(renderer, formBox, "password (visible) [optional]", "", "leave empty for key auth"),
  };
  const order = [list, inputs.name, inputs.host, inputs.user, inputs.port, inputs.key, inputs.password] as const;
  let focusIdx = mode === "setup" ? 1 : 0;
  let originalName: string | null = null;
  let armDelete = 0;
  let warnedMissingKey: string | null = null;

  const say = (msg: string, _color = "#AAAAAA") => {
    status.content = msg;
  };

  const currentFields = (): VmFormFields => ({
    name: inputs.name.value,
    host: inputs.host.value,
    user: inputs.user.value,
    port: inputs.port.value,
    keyPath: inputs.key.value,
    password: inputs.password.value,
  });

  async function refreshList(selectName?: string): Promise<void> {
    const names = await listVms();
    const active = await getActive();
    list.options = names.map((n) => ({
      name: `${n === active ? "* " : "  "}${n}`,
      description: "",
      value: n,
    }));
    if (!names.length) {
      say("no VMs yet — fill the form and ^S to save", "#FFCC00");
      return;
    }
    const idx = selectName ? names.indexOf(selectName) : 0;
    list.setSelectedIndex(Math.max(0, idx));
  }

  async function loadSelected(): Promise<void> {
    const opt = list.getSelectedOption();
    const name = opt?.value as string | undefined;
    if (!name) return;
    try {
      const cfg = await readVm(name);
      inputs.name.value = cfg.name;
      inputs.host.value = cfg.host;
      inputs.user.value = cfg.user;
      inputs.port.value = cfg.port ? String(cfg.port) : "";
      inputs.key.value = cfg.keyPath ?? "";
      inputs.password.value = cfg.password ?? "";
      originalName = cfg.name;
      say(`loaded "${name}" — edit + ^S to save, ^T to test`, "#00FF88");
    } catch (e) {
      say(`load failed: ${(e as Error).message}`, "#FF5555");
    }
  }

  function focusAt(i: number): void {
    focusIdx = (i + order.length) % order.length;
    order[focusIdx].focus();
    const label = focusIdx === 0 ? "VM list" : ["name", "host", "user", "port", "key", "password"][focusIdx - 1];
    say(`focus: ${label} · ${HINTS}`, "#666666");
  }

  async function doSave(): Promise<void> {
    const v = validateVmFields(currentFields());
    if (!v.ok) {
      say(`fix: ${v.errors.join("; ")}`, "#FF5555");
      return;
    }
    if (v.value.keyPath && !existsSync(expandPath(v.value.keyPath))) {
      if (warnedMissingKey !== v.value.keyPath) {
        warnedMissingKey = v.value.keyPath;
        say(`key file not found: ${v.value.keyPath} — ^S again to save anyway, fix path to retry`, "#FFCC00");
        return;
      }
    }
    warnedMissingKey = null;
    try {
      const data = {
        host: v.value.host,
        user: v.value.user,
        port: v.value.port,
        keyPath: v.value.keyPath,
        password: v.value.password,
      };
      if (originalName && originalName !== v.value.name) {
        // rename: write new, drop old, keep active if it pointed at old
        const oldActive = await getActive();
        await writeVm(v.value.name, data);
        try {
          await rmVm(originalName);
        } catch {}
        if (oldActive === originalName || oldActive === null) await setActive(v.value.name);
      } else if (originalName) {
        await writeVm(v.value.name, data);
      } else {
        await addVm(v.value.name, data); // first VM auto-activates
      }
      await audit({ tool: "vm_save_tui", vm: v.value.name, renamedFrom: originalName });
      originalName = v.value.name;
      const warn = v.value.warnings.length ? ` · warn: ${v.value.warnings.join("; ")}` : "";
      await refreshList(v.value.name);
      say(`saved "${v.value.name}" (${v.value.user}@${v.value.host})${warn} — ^U to activate, ^T to test`, "#00FF88");
    } catch (e) {
      say(`save failed: ${(e as Error).message}`, "#FF5555");
    }
  }

  async function doTest(): Promise<void> {
    const v = validateVmFields(currentFields());
    if (!v.ok) {
      say(`fix: ${v.errors.join("; ")}`, "#FF5555");
      return;
    }
    say(`testing ${v.value.user}@${v.value.host}…`, "#FFCC00");
    try {
      const r = await sshExec(
        { name: v.value.name || "tui-test", host: v.value.host, user: v.value.user, port: v.value.port, keyPath: v.value.keyPath, password: v.value.password },
        "uname -a",
        15_000,
      );
      say(r.code === 0 ? `OK: ${r.stdout.trim().slice(0, 160)}` : `exit ${r.code}: ${(r.stderr || r.stdout).trim().slice(0, 160)}`, r.code === 0 ? "#00FF88" : "#FF5555");
    } catch (e) {
      say(`connection failed: ${(e as Error).message}`, "#FF5555");
    }
  }

  async function doUse(): Promise<void> {
    const name = inputs.name.value.trim() || (list.getSelectedOption()?.value as string | undefined);
    if (!name) {
      say("nothing to activate — pick or type a VM name", "#FF5555");
      return;
    }
    try {
      await readVm(name);
      await setActive(name);
      await audit({ tool: "vm_use_tui", vm: name });
      await refreshList(name);
      say(`active VM: ${name}`, "#00FF88");
    } catch (e) {
      say(`use failed: ${(e as Error).message}`, "#FF5555");
    }
  }

  async function doDelete(): Promise<void> {
    const opt = list.getSelectedOption();
    const name = (opt?.value as string | undefined) ?? inputs.name.value.trim();
    if (!name) {
      say("nothing to delete", "#FF5555");
      return;
    }
    const now = Date.now();
    if (now - armDelete > 5000) {
      armDelete = now;
      say(`press ^D again within 5s to delete "${name}"`, "#FFCC00");
      return;
    }
    armDelete = 0;
    try {
      const wasActive = await rmVm(name);
      await audit({ tool: "vm_rm_tui", vm: name });
      if (originalName === name) originalName = null;
      await refreshList();
      say(`removed "${name}"${wasActive ? " — no active VM" : ""}`, "#00FF88");
    } catch (e) {
      say(`delete failed: ${(e as Error).message}`, "#FF5555");
    }
  }

  function doNew(): void {
    for (const k of Object.keys(inputs) as (keyof typeof inputs)[]) inputs[k].value = "";
    originalName = null;
    focusAt(1);
    say("new VM — fill name/host/user, ^S to save", "#FFCC00");
  }

  list.on(SelectRenderableEvents.ITEM_SELECTED, () => void loadSelected());

  renderer.keyInput.on("keypress", (key) => {
    if (key.name === "escape" || (key.name === "q" && key.ctrl) || (key.name === "c" && key.ctrl)) {
      renderer.destroy();
      return;
    }
    if (key.name === "tab") {
      key.preventDefault();
      focusAt(focusIdx + (key.shift ? -1 : 1));
      return;
    }
    if (key.ctrl && key.name === "s") {
      key.preventDefault();
      void doSave();
      return;
    }
    if (key.ctrl && key.name === "t") {
      key.preventDefault();
      void doTest();
      return;
    }
    if (key.ctrl && key.name === "n") {
      key.preventDefault();
      doNew();
      return;
    }
    if (key.ctrl && key.name === "d") {
      key.preventDefault();
      void doDelete();
      return;
    }
    if (key.ctrl && key.name === "u") {
      key.preventDefault();
      void doUse();
    }
  });

  await refreshList();
  if (mode === "manager" && list.options.length) await loadSelected();
  focusAt(focusIdx);
  if (mode === "setup" && !list.options.length) say("new setup — fill name/host/user, key path accepts .pem, ^S to save", "#FFCC00");

  await new Promise<void>((resolve) => renderer.once("destroy", () => resolve()));
}
