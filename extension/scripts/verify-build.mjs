import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(".output/chrome-mv3");
const manifest = JSON.parse(await fs.readFile(path.join(outputDir, "manifest.json"), "utf8"));
const expectedPermissions = ["activeTab", "contextMenus", "scripting"];

assert.equal(manifest.manifest_version, 3, "extension must build as Manifest V3");
assert.deepEqual([...manifest.permissions].sort(), expectedPermissions, "permissions must stay minimal");
assert.equal(manifest.host_permissions, undefined, "extension must not request persistent host access");
assert.equal(manifest.content_scripts, undefined, "extension must only inject after an explicit user action");
assert.equal(manifest.background?.service_worker, "background.js");
assert.equal(manifest.action?.default_title, "切换落点高亮");

const expectedIcons = {
  "16": "icon/16.png",
  "32": "icon/32.png",
  "48": "icon/48.png",
  "128": "icon/128.png"
};
assert.deepEqual(manifest.icons, expectedIcons, "manifest must expose every Chrome icon size");
assert.deepEqual(manifest.action?.default_icon, {
  "16": "icon/16.png",
  "32": "icon/32.png"
});
for (const filename of Object.values(expectedIcons)) {
  const icon = await fs.readFile(path.join(outputDir, filename));
  assert.ok(icon.byteLength > 100, `${filename} must contain a rendered PNG`);
}

const runtimeFiles = ["background.js", "highlighter.js"];
for (const filename of runtimeFiles) {
  const source = await fs.readFile(path.join(outputDir, filename), "utf8");
  assert.doesNotMatch(source, /https?:\/\//, `${filename} must not contain remote endpoints`);
}

console.log(
  JSON.stringify({
    manifestVersion: manifest.manifest_version,
    permissions: manifest.permissions,
    hostPermissions: [],
    runtimeFiles,
    icons: Object.values(expectedIcons)
  })
);
