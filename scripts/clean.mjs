import { access, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const isStandard = args.has("--standard") || args.has("--shallow");
const isDeep = !isStandard;
const isNuke = args.has("--nuke");
const platform = process.platform;
const isTty = Boolean(process.stdout.isTTY);
const useColor = isTty && !process.env.NO_COLOR;

const color = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);

const ui = {
  title: (text) => color("1;36", text),
  section: (text) => color("1;34", text),
  ok: (text) => color("1;32", text),
  warn: (text) => color("1;33", text),
  muted: (text) => color("2", text),
};

const artifactTargets = [
  "dist",
  ".turbo",
  "apps/web/.next",
  "apps/web/out",
  "apps/web/.turbo",
  "apps/web/tsconfig.tsbuildinfo",
  "apps/server/dist",
  "apps/server/.turbo",
  "packages/contracts/dist",
];

const deepTargets = [
  "pnpm-lock.yaml",
  "apps/web/node_modules",
  "apps/server/node_modules",
  "packages/contracts/node_modules",
];

// Root node_modules is kept separate: on NTFS mounts, pnpm hard-links native
// binaries (esbuild, rollup) and ntfs-3g creates .fuse_hidden tombstones that
// block rmdir. Use --nuke to include it only when explicitly needed.
const nukeTargets = ["node_modules"];

const targets = isDeep
  ? [...artifactTargets, ...deepTargets, ...(isNuke ? nukeTargets : [])]
  : artifactTargets;

const stats = {
  removed: 0,
  missing: 0,
  failed: 0,
};

const exists = async (targetPath) => {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

console.log(ui.title("\n=== Workspace Clean ==="));
console.log(
  `${ui.section("Mode")}: ${isDeep ? "deep" : "standard"}  ${ui.section("Platform")}: ${platform}`,
);
console.log(
  `${ui.section("Targets")}: ${targets.length}${isNuke ? ` ${ui.warn("(+ root node_modules)")}` : ""}`,
);
console.log(ui.muted("-----------------------"));

// Kill any lingering esbuild/tsx service processes that hold native binary
// file descriptors open — these cause ENOTEMPTY when deleting node_modules.
if (platform !== "win32") {
  spawnSync(
    "sh",
    [
      "-c",
      `pkill -f 'esbuild --service' 2>/dev/null; pkill -f 'tsx watch' 2>/dev/null; true`,
    ],
    { stdio: "inherit" },
  );
  // ntfs-3g creates .fuse_hidden* tombstone files when a file is deleted while
  // still open. These block rmdir until removed. Clean them up first.
  spawnSync(
    "sh",
    [
      "-c",
      `find ${JSON.stringify(cwd + "/node_modules")} -name '.fuse_hidden*' -delete 2>/dev/null; true`,
    ],
    { stdio: "inherit" },
  );
}

for (const relativePath of targets) {
  const absolutePath = path.join(cwd, relativePath);
  if (!(await exists(absolutePath))) {
    stats.missing += 1;
    continue;
  }

  console.log(`${ui.muted("->")} ${relativePath}`);

  if (platform !== "win32") {
    // On mounted/NTFS drives pnpm's native binary dirs can be undeletable
    // (locked by OS). Use find -depth -delete (children-before-parents) and
    // fall back to rm -rf. Never crash on partial failure — warn and continue.
    try {
      const s1 = spawnSync(
        "sh",
        [
          "-c",
          `find ${JSON.stringify(absolutePath)} -depth -delete 2>/dev/null`,
        ],
        { stdio: "pipe" },
      );
      if (s1.status !== 0) {
        const s2 = spawnSync("rm", ["-rf", absolutePath], { stdio: "pipe" });
        if (s2.status !== 0) {
          const stderr = s2.stderr?.toString().trim();
          console.warn(
            `${ui.warn("[WARN]")} Partial removal of ${relativePath}${stderr ? `: ${stderr.split("\n")[0]}` : ""}`,
          );
          console.warn(
            `${ui.warn("[HINT]")} You may need to run: sudo rm -rf "${absolutePath}"`,
          );
          stats.failed += 1;
          continue;
        }
      }
    } catch (err) {
      console.warn(
        `${ui.warn("[WARN]")} Could not remove ${relativePath}: ${err.message}`,
      );
      stats.failed += 1;
      continue;
    }
  } else {
    try {
      await rm(absolutePath, { recursive: true, force: true });
    } catch (err) {
      console.warn(
        `${ui.warn("[WARN]")} Could not remove ${relativePath}: ${err.message}`,
      );
      stats.failed += 1;
      continue;
    }
  }
  stats.removed += 1;
  console.log(`${ui.ok("[OK]")} Removed ${relativePath}`);
}

console.log(ui.muted("-----------------------"));
console.log(ui.title("Clean completed."));
console.log(
  `${ui.ok("Removed")}: ${stats.removed}  ${ui.muted("Missing")}: ${stats.missing}  ${ui.warn("Failed")}: ${stats.failed}`,
);
