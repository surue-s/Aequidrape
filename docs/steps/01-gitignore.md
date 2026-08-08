# Step 01 — Updated `.gitignore`

## What was done
Expanded the repository ignore rules to better fit a TypeScript + Node project with a Python helper environment.

### Added ignore rules for:
- `node_modules/`
- `dist/`
- `coverage/`
- `*.tsbuildinfo`
- `.env` and `.env.*`
- `*.log`
- `.DS_Store`
- `.vscode/`
- Python cache folders like `__pycache__/` and `.pytest_cache/`
- `.venv/`

## How it works
Git uses `.gitignore` to skip files and folders when tracking changes. That means:
- dependency installs stay local
- build output is not committed
- environment secrets stay out of the repo
- editor and OS noise do not clutter commits

## Why this matters here
This project will generate:
- compiled app output in `dist/`
- installed packages in `node_modules/`
- local test/runtime files
- optional Python helper artifacts

Ignoring them keeps the repository clean while still tracking source files, docs, and the demo assets we actually want to ship.
