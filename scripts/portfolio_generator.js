#!/usr/bin/env node
const fs = require("fs").promises;
const path = require("path");

const BASE = path.join(process.cwd(), "docs", "portfolios");

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeIfNotExists(filePath, content) {
  try {
    await fs.access(filePath);
    return false;
  } catch {
    await fs.writeFile(filePath, content, "utf8");
    return true;
  }
}

function templateFor(name, type) {
  const title = name;
  switch (type) {
    case "front":
      return `# ${title}\n\n## Front Page\n\n- Student: [Your name]\n- Course: [Course]\n- Instructor: [Instructor]\n- Date: [Date]\n\n## Overview\n\n[Write a short overview of this folder/project]\n`;
    case "rubrics":
      return `# ${title} - Rubrics\n\n## Rubrics\n\n- Rubric 1: [Describe]\n- Rubric 2: [Describe]\n\n### Notes\n\n[Place rubric-related notes here]\n`;
    case "activity":
      return `# Activity: ${title}\n\n- Date: [Insert Date]\n- Description: [Insert Description]\n- Notes: [Insert Notes]\n\n## Evidence\n\n- [Add files, images, links]\n`;
    case "peta":
      return `# ${title} - PETA\n\n## PETA (Planning, Evidence, Thoughts, Action)\n\n- Planning: [Write planning notes]\n- Evidence: [Attach or reference]\n- Thoughts: [Reflection]\n- Action: [Next steps]\n`;
    case "quiz":
      return `# ${title} - Quiz\n\n## Quiz details\n\n1. Question 1\n\n- Answer: [Write answer]\n\n`;
    case "reflection":
      return `# ${title} - Reflection\n\n## Reflection\n\n- What I learned:\n- Challenges:\n- Next steps:\n`;
    case "last":
      return `# ${title} - Last Page\n\n## Final Remarks\n\n- Summary of accomplishments\n- Links to highlights\n`;
    default:
      return `# ${title}\n\n[Content goes here]\n`;
  }
}

async function generateTOC(folderPath) {
  const files = await fs.readdir(folderPath);
  // Prioritize specific filenames
  const order = [
    "front-page.md",
    "rubrics.md",
    // activities (activity-*.md) inserted here
    "peta.md",
    "quiz.md",
    "reflection.md",
    "last-page.md",
  ];

  const activities = files.filter((f) => /^activity(-|_)?/i.test(f));
  const others = files.filter(
    (f) => !order.includes(f) && !activities.includes(f),
  );

  const seq = [];
  for (const name of order) {
    if (files.includes(name)) seq.push(name);
    if (name === "rubrics.md") {
      // insert activities after rubrics
      seq.push(...activities.sort());
    }
  }
  // append any remaining files
  seq.push(...others.sort());

  const tocLines = [];
  tocLines.push(`# ${path.basename(folderPath)}\n\n## Table of Contents\n`);
  seq.forEach((f, i) => {
    const display = getDisplayName(folderPath, f);
    tocLines.push(`${i + 1}. [${display}](${encodeURI(f)})`);
  });

  tocLines.push("\n---\n");

  // Append simple links to each section (could be enhanced)
  await fs.writeFile(
    path.join(folderPath, "README.md"),
    tocLines.join("\n"),
    "utf8",
  );
}

function getDisplayName(folderPath, filename) {
  const name = filename.replace(/\.md$/i, "");
  if (/^activity(-|_)?/i.test(name)) {
    // try to read the file and get its first heading
    try {
      const content = require("fs").readFileSync(
        path.join(folderPath, filename),
        "utf8",
      );
      const m = content.match(/^#\s*(.+)/m);
      if (m) return `Activity: ${m[1].replace(/^Activity:\s*/i, "").trim()}`;
    } catch (e) {
      // ignore
    }
    return "Activity";
  }
  switch (name) {
    case "front-page":
      return "Front Page";
    case "rubrics":
      return "Rubrics";
    case "peta":
      return "PETA";
    case "quiz":
      return "Quiz";
    case "reflection":
      return "Reflection";
    case "last-page":
      return "Last Page";
    default:
      return name.replace(/[-_]/g, " ");
  }
}

async function initFolder(folderName) {
  const dir = path.join(BASE, folderName);
  await ensureDir(dir);

  // Create standard files
  await writeIfNotExists(
    path.join(dir, "front-page.md"),
    templateFor(folderName, "front"),
  );
  await writeIfNotExists(
    path.join(dir, "rubrics.md"),
    templateFor(folderName, "rubrics"),
  );
  await writeIfNotExists(
    path.join(dir, "activity-1.md"),
    templateFor("Title of Activity 1", "activity"),
  );
  await writeIfNotExists(
    path.join(dir, "peta.md"),
    templateFor(folderName, "peta"),
  );
  await writeIfNotExists(
    path.join(dir, "quiz.md"),
    templateFor(folderName, "quiz"),
  );
  await writeIfNotExists(
    path.join(dir, "reflection.md"),
    templateFor(folderName, "reflection"),
  );
  await writeIfNotExists(
    path.join(dir, "last-page.md"),
    templateFor(folderName, "last"),
  );

  await generateTOC(dir);
  console.log("Initialized portfolio folder:", dir);
}

async function addActivity(folderName, title) {
  const dir = path.join(BASE, folderName);
  await ensureDir(dir);
  const slug = slugify(title) || `activity-${Date.now()}`;
  const filename = `activity-${slug}.md`;
  const full = path.join(dir, filename);
  await fs.writeFile(full, templateFor(title, "activity"), "utf8");
  await generateTOC(dir);
  console.log("Added activity:", full);
}

async function regenAll() {
  try {
    const folders = await fs.readdir(BASE);
    for (const f of folders) {
      const full = path.join(BASE, f);
      const stat = await fs.stat(full);
      if (stat.isDirectory()) await generateTOC(full);
    }
    console.log("Regenerated TOCs for all portfolios.");
  } catch (e) {
    console.error("No portfolios directory found. Run init first.");
  }
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd) {
    console.log(
      'Usage: portfolio_generator.js init "Work Immersion" | add-activity "Work Immersion" "Title" | regen',
    );
    process.exit(0);
  }

  if (cmd === "init") {
    const name = rest.join(" ") || "Work Immersion";
    await initFolder(name);
    return;
  }

  if (cmd === "add-activity") {
    const name = rest[0];
    const title = rest.slice(1).join(" ") || "New Activity";
    if (!name) {
      console.error("Folder name required");
      process.exit(1);
    }
    await addActivity(name, title);
    return;
  }

  if (cmd === "regen") {
    await regenAll();
    return;
  }

  console.log("Unknown command");
}

if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
