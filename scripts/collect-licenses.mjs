import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const lock = JSON.parse(
  await readFile(path.join(root, "package-lock.json"), "utf8"),
);
const seen = new Set();
const sections = [
  "CashGap third-party notices\n\nThe following installed runtime and build dependencies retain their original license notices. Inclusion does not imply that every package is shipped in the browser bundle. Individual package licenses govern their respective code.\n",
];
for (const relative of Object.keys(lock.packages).sort()) {
  if (!relative.startsWith("node_modules/")) continue;
  const directory = path.join(root, relative);
  let metadata;
  try {
    metadata = JSON.parse(
      await readFile(path.join(directory, "package.json"), "utf8"),
    );
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  const identity = `${metadata.name}@${metadata.version}`;
  if (seen.has(identity)) continue;
  seen.add(identity);
  const files = (await readdir(directory))
    .filter((name) => /^(licen[cs]e|copying|notice)(?:[._-]|$)/i.test(name))
    .sort();
  sections.push(
    `\n${"=".repeat(72)}\n${identity}\nSPDX/package declaration: ${typeof metadata.license === "string" ? metadata.license : JSON.stringify(metadata.license ?? "See package source")}\n`,
  );
  for (const filename of files)
    if ((await stat(path.join(directory, filename))).isFile())
      sections.push(
        `\n--- ${filename} ---\n${await readFile(path.join(directory, filename), "utf8")}\n`,
      );
}
assert.ok(
  seen.has("next@16.4.3") && seen.has("idb@8.0.4"),
  "Expected framework/storage notices are missing",
);
await mkdir(path.join(root, "public", "licenses"), { recursive: true });
await copyFile(
  path.join(root, "node_modules", "@fontsource-variable", "geist", "LICENSE"),
  path.join(root, "public", "licenses", "geist-OFL.txt"),
);
await writeFile(
  path.join(root, "public", "third-party-licenses.txt"),
  sections.join("\n"),
);
console.log(
  `Retained third-party notices for ${seen.size} installed packages and the original Geist OFL.`,
);
