# Installation Guide

## Runtime Requirements
- **Node.js**: v18.0.0 or later (Node 20+ recommended)
- **npm**: v9.0.0 or later
- **Operating System**: Linux, macOS, or Windows

---

## Installation Options

### Option 1: On-demand execution with `npx` (Recommended)
You can run TRACE in any repository without installing it globally:
```bash
npx @amvelt/trace init
npx @amvelt/trace feature payments
```

### Option 2: Global Installation
To have the `trace` command available system-wide:
```bash
npm install -g @amvelt/trace
# or using the canonical package:
npm install -g @anubhavm/trace
```
Verify installation:
```bash
trace --version
```

### Option 3: Local Project Dependency
Install TRACE as a devDependency in your repository:
```bash
npm install --save-dev @amvelt/trace
```
Add convenience scripts to your `package.json`:
```json
{
  "scripts": {
    "trace:status": "trace status",
    "trace:update": "trace update",
    "trace:validate": "trace validate"
  }
}
```

---

## Verification & Health Check
Run `trace doctor` to verify your environment, node version, and parser capabilities:
```bash
trace doctor
```
