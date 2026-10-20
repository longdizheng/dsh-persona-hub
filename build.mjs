#!/usr/bin/env node
// Build a DSH bundle from the persona catalog.
//
//   node build.mjs --list
//   node build.mjs                      # interactive: pick personas
//   node build.mjs --stdin              # pick from one line on stdin (automation)
//   node build.mjs --only alpha,selena  # non-interactive
//   node build.mjs --all                # every persona
//   node build.mjs --sync               # rewrite the repo-root bundle patch
//
// Options: --out <dir>, --name <pkg>, --version <semver>.
//
// Generated bundle: <out>/package.json + <out>/cordis.patch.yml.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PERSONA_DIR = join(ROOT, "personas");
const TOOLSET_FILE = join(ROOT, "lib", "toolset.yml");
const DSL_ENGINE = ">=0.2.1-rc.2";

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { out: "dist/persona-pack", list: false, all: false, sync: false, stdin: false, only: null, name: null, version: "1.0.0" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) fail(`${arg} needs a value`);
      return value;
    };
    if (arg === "--list") opts.list = true;
    else if (arg === "--all") opts.all = true;
    else if (arg === "--sync") opts.sync = true;
    else if (arg === "--stdin") opts.stdin = true;
    else if (arg === "--only") opts.only = next();
    else if (arg === "--out") opts.out = next();
    else if (arg === "--name") opts.name = next();
    else if (arg === "--version") opts.version = next();
    else if (arg === "-h" || arg === "--help") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(0, 12).join("\n"));
      process.exit(0);
    } else fail(`unknown argument ${arg}`);
  }
  return opts;
}

function parsePersona(file) {
  const raw = readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) fail(`${file}: missing --- frontmatter ---`);
  const meta = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!field) continue;
    meta[field[1]] = field[2].trim().replace(/^["']|["']$/g, "");
  }
  for (const key of ["id", "name", "description"]) {
    if (!meta[key]) fail(`${file}: frontmatter needs ${key}`);
  }
  if (!/^[a-z0-9-]+$/.test(meta.id)) fail(`${file}: id must be lowercase letters, digits and hyphens`);
  const body = match[2].trim();
  if (!body) fail(`${file}: empty persona text`);
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    order: Number(meta.order ?? 100),
    body,
    file: file.replace(/\\/g, "/").slice(ROOT.replace(/\\/g, "/").length + 1),
  };
}

function loadPersonas() {
  const files = readdirSync(PERSONA_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(PERSONA_DIR, name));
  if (!files.length) fail("personas/ is empty");
  const personas = files.map(parsePersona);
  const seen = new Set();
  for (const persona of personas) {
    if (seen.has(persona.id)) fail(`duplicate persona id ${persona.id}`);
    seen.add(persona.id);
    if (!Number.isFinite(persona.order)) fail(`${persona.file}: order must be a number`);
  }
  return personas.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function loadToolset() {
  const lines = readFileSync(TOOLSET_FILE, "utf8").replace(/\r\n/g, "\n").split("\n");
  const rows = [];
  let started = false;
  for (const line of lines) {
    if (!started) {
      if (line.startsWith("  - id:")) {
        started = true;
        rows.push(line);
      }
      continue;
    }
    rows.push(line);
  }
  while (rows.length && rows[rows.length - 1].trim() === "") rows.pop();
  if (!rows.length) fail("lib/toolset.yml has no rows");
  return rows;
}

const quote = (value) => JSON.stringify(value);

function indent(text, spaces) {
  const prefix = " ".repeat(spaces);
  return text.split("\n").map((line) => (line.length ? prefix + line : "")).join("\n");
}

function presetYaml(persona, toolset) {
  const lines = [
    `    - id: preset-persona-${persona.id}`,
    `      name: '@deepseek-ai/dsh-agent-preset'`,
    `      config:`,
    `        id: persona-${persona.id}`,
    `        name: ${quote(persona.name)}`,
    `        description: ${quote(persona.description)}`,
    `        order: ${persona.order}`,
    `        plugins:`,
    `          - id: persona`,
    `            name: '@deepseek-ai/dsh-persona'`,
    `            config:`,
    `              prefix: |-`,
    indent(persona.body, 16),
  ];
  for (const line of toolset) lines.push(line.length ? "        " + line : "");
  return lines.join("\n");
}

function buildPatch(personas, toolset) {
  const header = [
    "# Generated by build.mjs. Do not edit by hand; edit personas/*.md and rebuild.",
    "# Each persona becomes its own @deepseek-ai/dsh-agent-preset declaration.",
    "- insert:",
  ].join("\n");
  return [header, ...personas.map((persona) => presetYaml(persona, toolset))].join("\n") + "\n";
}

function buildManifest({ name, version, description, personaIds }) {
  return JSON.stringify({
    name,
    version,
    description,
    private: true,
    type: "module",
    license: "MIT",
    files: ["cordis.patch.yml", "README.md"],
    engines: { dsh: DSL_ENGINE },
    dsh: { bundle: { patch: "./cordis.patch.yml" } },
    keywords: ["dsh-bundle", "dsh-persona", ...personaIds],
  }, null, 2) + "\n";
}

function buildReadme(personas, name) {
  const rows = personas.map((p) => `- **${p.name}** \`persona-${p.id}\` — ${p.description}`).join("\n");
  return `# ${name}

由 \`dsh-persona-hub\` 生成的人设组合包，包含 ${personas.length} 个 agent preset。

## 包含的人设

${rows}

## 安装

在 Harness 的**插件**页选择安装，目标填本目录的绝对路径；或让 agent 执行：

\`\`\`
plugin_manager action=install_bundle target=<本目录绝对路径>
\`\`\`

安装后新建会话，在预置选择器里选择其中一个人设。已有会话保留旧组合。

## 说明

- 每个 preset 都挂载 DSH \`standard\` 的工具行，因此换人设不丢能力。
- 修改人设：编辑 \`dsh-persona-hub/personas/*.md\`，重新生成。
- 工具行固定于 DSH ${DSL_ENGINE} 时代；升级 DSH 后请同步 \`lib/toolset.yml\`。
`;
}

function printCatalog(personas) {
  console.log("\n可用 persona：\n");
  personas.forEach((persona, index) => {
    console.log(`  ${String(index + 1).padStart(2)}. ${persona.name} — ${persona.description}`);
  });
  console.log("");
}

function parseAnswer(answer, personas) {
  const text = answer.trim();
  if (!text) return null;
  if (text.toLowerCase() === "all") return personas;
  const picked = [];
  for (const token of text.split(/[,，\s]+/).filter(Boolean)) {
    if (!/^\d+$/.test(token)) fail(`不是编号：${token}`);
    const persona = personas[Number(token) - 1];
    if (!persona) fail(`编号超出范围：${token}`);
    if (!picked.includes(persona)) picked.push(persona);
  }
  return picked;
}

async function pickInteractively(personas) {
  printCatalog(personas);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("要安装哪些？输入编号（逗号分隔）、all 或直接回车取消：");
    return parseAnswer(answer, personas);
  } finally {
    rl.close();
  }
}

async function pickFromStdin(personas) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return parseAnswer(Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0] ?? "", personas);
}

async function selectPersonas(personas, opts) {
  if (opts.only) {
    const ids = opts.only.split(/[,，\s]+/).filter(Boolean);
    return ids.map((id) => personas.find((persona) => persona.id === id) ?? fail(`unknown persona ${id}`));
  }
  if (opts.all) return personas;
  if (opts.stdin) return pickFromStdin(personas);
  if (!process.stdin.isTTY) fail("no TTY for the interactive prompt; pass --only <ids>, --all, or --stdin");
  return pickInteractively(personas);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const personas = loadPersonas();
  const toolset = loadToolset();

  if (opts.list) {
    console.log(JSON.stringify(personas.map(({ id, name, description, order, file }) => ({ id, name, description, order, file })), null, 2));
    return;
  }

  if (opts.sync) {
    writeFileSync(join(ROOT, "cordis.patch.yml"), buildPatch(personas, toolset));
    console.log(`synced repo-root cordis.patch.yml with ${personas.length} personas`);
    return;
  }

  const picked = await selectPersonas(personas, opts);
  if (!picked || !picked.length) {
    console.log("cancelled");
    return;
  }
  picked.sort((a, b) => a.order - b.order);

  const outDir = resolve(opts.out);
  const ids = picked.map((persona) => persona.id);
  const hash = createHash("sha1").update(ids.join(",")).digest("hex").slice(0, 6);
  const name = opts.name ?? `dsh-persona-pack-${hash}`;
  const description = `${picked.map((persona) => persona.name).join(" / ")} — DSH persona presets`;

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "cordis.patch.yml"), buildPatch(picked, toolset));
  writeFileSync(join(outDir, "package.json"), buildManifest({ name, version: opts.version, description, personaIds: ids }));
  writeFileSync(join(outDir, "README.md"), buildReadme(picked, name));

  console.log(`\nbuilt ${name} (${picked.length} personas) -> ${outDir}`);
  for (const persona of picked) console.log(`  preset-persona-${persona.id}  ${persona.name}`);
  console.log(`\ninstall with plugin_manager install_bundle target=${outDir}`);
}

await main();
