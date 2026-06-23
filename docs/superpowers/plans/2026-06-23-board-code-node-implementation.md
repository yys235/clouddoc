# Board Code Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `type: "code"` board node that displays and edits multi-line code without changing ordinary text shapes.

**Architecture:** Keep Code Node as a board node type in `board-document-page.tsx`, storing source code in `node.text` and code-specific settings on the node. Reuse the document editor's code language sanitizer/list by exporting those helpers. Avoid backend changes because no external resources are introduced.

**Tech Stack:** Next.js React client components, TypeScript, existing board SVG/foreignObject rendering, existing board autosave/history pipeline.

---

### Task 1: Shared Code Helpers

**Files:**
- Modify: `apps/web/components/editor/block-editor.tsx`

- [ ] Export `CODE_LANGUAGE_OPTIONS` and `codeLanguageLabel`.
- [ ] Keep `sanitizeCodeLanguage` and `sanitizeCodeHeight` as the shared validation boundary.
- [ ] Run `npm run build` after board integration.

### Task 2: Board Code Node Data Model

**Files:**
- Modify: `apps/web/components/board/board-document-page.tsx`

- [ ] Import code helpers from `block-editor`.
- [ ] Add `"code"` to `BoardNodeType` and shape palette.
- [ ] Add `codeLanguage`, `codeWrap`, `codeCollapsed`, and `codeHeight` to `BoardNode`.
- [ ] Normalize these fields only for code nodes.
- [ ] Make code node default size `520x280`, manual sized, and keep board `version: 2`.

### Task 3: Code Node Rendering And Editing

**Files:**
- Modify: `apps/web/components/board/board-document-page.tsx`

- [ ] Add code editing state separate from ordinary `editingNodeId`.
- [ ] Render code nodes with a rounded rectangle, header, line numbers, monospace content, internal scroll, and textarea edit mode.
- [ ] Support double-click/Enter to edit, Esc/blur/canvas click to commit, Tab/Shift+Tab indentation, and code wheel event isolation.
- [ ] Keep ordinary text node editing unchanged.

### Task 4: Code Node Toolbar

**Files:**
- Modify: `apps/web/components/board/board-document-page.tsx`

- [ ] Add toolbar panel for code language.
- [ ] For selected code nodes, show code-specific controls: language, wrap, copy code, collapse/expand, fill, stroke, more.
- [ ] Hide text formatting controls for code nodes.
- [ ] Add copy-code fallback notice when clipboard write is blocked.

### Task 5: Verification

**Commands:**
- `apps/web npm run build`
- `git diff --check`

- [ ] Confirm build passes.
- [ ] Confirm only intended source/doc changes remain staged or modified.
