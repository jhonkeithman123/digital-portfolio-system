# Documentary: Google Drive–style Portfolio Storage

This document explains the changes implemented to add Google Drive–style storage for student portfolios.

## Overview

- Added a lightweight generator script at `scripts/portfolio_generator.js`.
- Portfolios live in `docs/portfolios/<Folder Name>/` as Markdown files.
- Each folder mirrors a portfolio: Front Page, Rubrics, Activities, PETA, Quiz, Reflection, Last Page.
- A dynamic Table of Contents (`README.md`) is generated for each folder and updates when activities are added.

## What the script does

- `init "Folder Name"` — Creates a new portfolio folder with template Markdown files and generates `README.md` (TOC).
- `add-activity "Folder Name" "Activity Title"` — Adds a new activity file (`activity-<slug>.md`) and regenerates the TOC.
- `regen` — Regenerates TOCs for all portfolios under `docs/portfolios`.

## Why this approach

- Markdown-first: makes files easy to edit, review, and commit.
- Simple script with no external dependencies — runs with Node.js.
- Keeps portfolio structure explicit and version-controlled under `docs/`.

## Integration notes

- The frontend can read `docs/portfolios` or a server endpoint that serves these files if you want an app UI.
- For now, the generator provides the content and TOC; integrating an editor or upload UI can be done later.

## How to use

1. Create the folder and default pages:

```bash
node scripts/portfolio_generator.js init "Work Immersion"
```

1. Add a new activity:

```bash
node scripts/portfolio_generator.js add-activity "Work Immersion" "My New Activity"
```

1. Regenerate all TOCs:

```bash
node scripts/portfolio_generator.js regen
```

## Files created

- `scripts/portfolio_generator.js` — generator script
- `docs/portfolios/<Folder Name>/` — individual portfolio folders with Markdown files
- `docs/portfolio_documentary.md` — this documentary file

## Next steps

- Add a backend endpoint to serve these Markdown files as JSON for the frontend.
- Add a simple frontend UI to create folders and upload files directly from the webapp.
- Add authentication checks for file edits (admins/teachers only).
