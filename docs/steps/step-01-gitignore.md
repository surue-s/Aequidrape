# Step 01 — Update `.gitignore`

## What was done
- Added a few common local-only and editor-only patterns to `.gitignore`.
- Kept project documentation files tracked so build notes and step logs stay in the repo.

## What it does
- Prevents temporary files like swap files and generic temp files from being committed.
- Ignores common IDE folders such as `.idea/` and `.cursor/`.
- Keeps environment files, logs, build output, and Python cache out of git.

## Why this matters
- Keeps the repository clean.
- Reduces accidental commits of local machine artifacts.
- Makes the project easier to review and maintain while we build step by step.
