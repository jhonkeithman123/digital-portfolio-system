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

const artifactTargets = [
  "dist",
  ".turbo",
  "apps/web/.next",
  "apps/web/out",
  "apps/web/.turbo",
  "apps/web/tsconfig.tsbuildinfo",
  "apps/server/dist",
  "apps/server/.turbo",
  "apps/legacy-web/dist",
  "apps/legacy-web/.turbo",
  "apps/legacy-web/node_modules/.vite",
  "packages/contracts/dist",
];

const deepTargets = [
  "pnpm-lock.yaml",
  "apps/web/node_modules",
  "apps/server/node_modules",
  "apps/legacy-web/node_modules",
  "packages/contracts/node_modules",
];

// Root node_modules is kept separate: on NTFS mounts, pnpm hard-links native
// binaries (esbuild, rollup) and ntfs-3g creates .fuse_hidden tombstones that
// block rmdir. Use --nuke to include it only when explicitly needed.
const nukeTargets = ["node_modules"];

const targets = isDeep
  ? [...artifactTargets, ...deepTargets, ...(isNuke ? nukeTargets : [])]
  : artifactTargets;

const exists = async (targetPath) => {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

console.log(
  `Cleaning workspace on ${platform} (${isDeep ? "deep" : "standard"} mode)...`,
);

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
    continue;
  }

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
            `  ⚠ Partial removal of ${relativePath}${stderr ? `: ${stderr.split("\n")[0]}` : ""}`,
          );
          console.warn(
            `  → You may need to run: sudo rm -rf "${absolutePath}"`,
          );
          continue;
        }
      }
    } catch (err) {
      console.warn(`  ⚠ Could not remove ${relativePath}: ${err.message}`);
      continue;
    }
  } else {
    try {
      await rm(absolutePath, { recursive: true, force: true });
    } catch (err) {
      console.warn(`  ⚠ Could not remove ${relativePath}: ${err.message}`);
      continue;
    }
  }
  console.log(`Removed: ${relativePath}`);
}

console.log("Clean completed.");
