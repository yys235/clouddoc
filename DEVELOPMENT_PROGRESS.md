# CloudDoc Development Progress

## Workflow

- Continue feature development without waiting for manual confirmation.
- Run automated tests after each completed feature.
- Record the feature scope, changed areas, and test results in this file.

## Progress Log

### 2026-04-08 17:12 CST

- Completed the user-system implementation round based on `user-system-design.md`:
  - added cookie-session auth routes:
    - `POST /api/auth/register`
    - `POST /api/auth/login`
    - `POST /api/auth/logout`
    - `GET /api/auth/me`
    - `GET /api/auth/require`
    - `POST /api/auth/dev-bootstrap`
  - added `user_sessions` persistence and session management routes:
    - `GET /api/sessions`
    - `DELETE /api/sessions/{id}`
  - added organization management routes:
    - `POST /api/organizations`
    - `GET /api/organizations/current`
    - `GET /api/organizations/{id}/members`
    - `POST /api/organizations/{id}/invite`
    - `PATCH /api/organizations/{id}/members/{member_id}`
  - switched document/comment/template/space paths to current-user-aware request handling instead of default-user service shortcuts
  - added login/register pages and browser auth bootstrap
  - added organization management UI for:
    - creating organizations
    - inviting members
    - listing sessions
    - listing members
    - updating member role/status
    - revoking sessions
- Automated verification:
  - `cd /Users/yys235/projects/clouddoc/apps/api && .venv/bin/pytest -q`
    - Result: `16 passed`
  - `cd /Users/yys235/projects/clouddoc/apps/web && npm run build`
    - Result: success

### 2026-04-08 17:34 CST

- Tightened comment-delete permissions to the requested two-rule model:
  - a user can delete their own comment
  - the document owner can delete any comment on that document
  - removed the previous broader organization admin/owner override from backend permission checks
- Exposed document `owner_id` to the frontend document model so the comment sidebar can show delete controls for document owners as well as comment authors
- Added regression coverage for comment-delete permissions:
  - outsider cannot delete another user comment
  - document owner can delete comments on their document
  - comment author can delete their own comment
- Automated verification:
  - `cd /Users/yys235/projects/clouddoc/apps/api && .venv/bin/pytest -q`
    - Result: `17 passed`
  - `cd /Users/yys235/projects/clouddoc/apps/web && npm run build`
    - Result: success

### 2026-04-08 17:52 CST

- Upgraded comments from flat thread replies to nested replies:
  - added `comments.parent_comment_id`
  - reply API now accepts `parent_comment_id`
  - frontend comment sidebar now renders threaded replies with indentation
  - per-comment reply action now targets a specific parent comment instead of only replying at the thread root
- Implemented parent-delete behavior for nested replies:
  - deleting a parent comment keeps child replies
  - deleted parent comments now remain visible as a placeholder: `该评论已删除`
  - thread deletion still happens only when all comments in the thread are deleted
- Added runtime schema patching for existing databases so `parent_comment_id` is added automatically at startup and during test initialization
- Automated verification:
  - `cd /Users/yys235/projects/clouddoc/apps/api && .venv/bin/pytest -q`
    - Result: `18 passed`
  - `cd /Users/yys235/projects/clouddoc/apps/web && npm run build`
    - Result: success

### 2026-03-26 18:58 CST

- Established the local canonical workspace at `/Users/yys235/projects/clouddoc`.
- Resolved the SMB-mounted drive Node.js dependency issue by moving active development to local disk.
- Brought up the real development servers:
  - Frontend: `http://127.0.0.1:3000`
  - Backend: `http://127.0.0.1:8000`
- Completed the first interactive frontend pass:
  - Sidebar navigation is clickable.
  - `+ 新建文档` creates a real document through the API.
  - Home document cards open real detail pages.
  - Document page supports edit, save, share, and local favorite feedback.
- Automated verification:
  - `npm run build` in `apps/web`
  - API create/update integration check against FastAPI + PostgreSQL

### 2026-03-26 19:08 CST

- Completed recycle bin v1:
  - `DELETE /api/documents/{doc_id}` now performs soft delete.
  - `POST /api/documents/{doc_id}/restore` restores soft-deleted documents.
  - `GET /api/documents?state=active|trash|all` supports active/trash filtering.
  - Home page now loads real trash data.
  - Trash section supports one-click restore.
  - Document detail page supports moving a document to trash.
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `1 passed`
  - `cd apps/web && npm run build`
    - Result: success

### 2026-03-26 19:18 CST

- Completed favorites v1:
  - Added persistent `document_favorites` storage.
  - `POST /api/documents/{doc_id}/favorite` favorites a document.
  - `DELETE /api/documents/{doc_id}/favorite` removes a favorite.
  - Document list/detail responses now expose `is_favorited`.
  - Home page favorites section now renders real favorite documents.
  - Document detail page favorite button now uses the real backend state.
- Test baseline improvement:
  - Added `apps/api/tests/conftest.py` so API tests always initialize schema before running.
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `2 passed`
  - `cd apps/web && npm run build`
    - Result: success

### 2026-03-27 09:24 CST

- QA subagent `qa_browser` completed browser validation and reported two confirmed issues.
- Fix in progress:
  - Extended API CORS allowlist to include `http://127.0.0.1:3000`.
  - Added app icon asset to eliminate `/favicon.ico` 404 noise in the browser.

### 2026-03-27 09:26 CST

- Fixed browser-blocking issues from QA round 1:
  - Confirmed and fixed CORS preflight rejection for `http://127.0.0.1:3000`.
  - Added explicit favicon handling so the browser no longer receives a 404 at `/favicon.ico`.
  - Repaired corrupted Next.js dev cache by restarting the dev server and rebuilding `.next`.
- Automated verification:
  - CORS preflight to `POST /api/documents/{id}/favorite`
    - Result: `200 OK` with `access-control-allow-origin: http://127.0.0.1:3000`
  - API regression script for create/save/favorite/delete/restore
    - Result: all requests succeeded
  - `cd apps/web && npm run build`
    - Result: success

### 2026-03-27 09:33 CST

- Completed search v1:
  - Added `GET /api/documents/search?q=` for title + latest-content search.
  - Search results now return excerpt text and favorite state.
  - Added homepage search entry.
  - Added dedicated `/search` results page.
  - Deleted documents are excluded from search results.
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `3 passed`
  - `cd apps/web && npm run build`
    - Result: success

### 2026-03-27 09:46 CST

- Completed templates v1:
  - Added `GET /api/templates`.
  - Added `POST /api/templates/{template_id}/instantiate`.
  - Seeded built-in templates: `需求文档`, `会议纪要`.
  - Added `/templates` page and connected the home/template navigation entry.
  - Template instantiation now creates a real document and opens the editor page.
  - Fixed template title rule so instantiated documents keep the template title instead of appending `- 新建`.
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` confirmed template instantiation works and the title rule issue is resolved.

### 2026-03-27 10:16 CST

- Completed Feishu-style block editor research and implementation round 1:
  - Added the detailed research and requirement split report:
    - `/Users/yys235/projects/clouddoc/feishu-doc-block-research-report.md`
  - Refined the document editor toward a Feishu-like block model:
    - kept continuous document presentation
    - added slash command menu triggered by `/`
    - added lighter row-level controls with left-gutter insertion
    - expanded block types to include `检查项` and `引用`
    - preserved structured block persistence for the new block types
  - Fixed a persistence regression reported by QA:
    - empty checklist blocks now survive save + refresh instead of being dropped
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` validated:
    - edit mode is block-based rather than a single large textarea
    - `/` command menu opens and converts block types
    - quote block works
    - checklist block survives save + refresh
    - no new console errors were observed

### 2026-03-27 10:30 CST

- Completed a document-page UI density and style review round against the Feishu-style target.
- Implemented two visual reduction passes:
  - reduced the document page from a heavy three-column management layout toward a content-first layout
  - removed the bottom block action wall
  - reduced block-row chrome and moved actions into lighter hover menus
  - hid the outline column in edit mode to increase content focus
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` confirmed the page is lighter than before
  - remaining high-priority issue:
    - block controls are still visually too strong, so edit mode still feels closer to a block-editing panel than Feishu's content-first document canvas
- Next focus:
  - replace explicit per-block controls with a more implicit interaction model based on cursor context, lighter left-gutter affordances, and fewer always-discoverable actions

### 2026-03-27 10:48 CST

- Completed keyboard behavior for block editing:
  - `Enter` now splits the current block and creates a new block below it
  - `Shift+Enter` keeps the newline inside the current block
  - slash-command handling now has higher priority than block splitting
  - slash-command parsing now also works in checklist blocks whose default content starts with `[ ]`
- Debugging notes:
  - used terminal-driven browser automation to reproduce the exact failure path in checklist blocks
  - confirmed the root cause was slash parsing on values like `[ ] /`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` confirmed:
    - `Enter` creates a new block
    - `Shift+Enter` inserts an in-block newline
    - slash command opens and `Enter` executes the command instead of splitting the block

### 2026-03-27 10:52 CST

- Completed document navigation interaction improvements:
  - made the document-page breadcrumb clickable
  - added keyboard navigation across blocks at block boundaries
  - supported cross-block caret movement with:
    - `ArrowUp` / `ArrowDown`
    - `ArrowLeft` / `ArrowRight` at start/end boundaries
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` confirmed:
    - breadcrumb navigation works
    - block-boundary arrow navigation works in edit mode

### 2026-03-27 11:31 CST

- Fixed the checklist new-block default marker bug:
  - root cause: checklist blocks were initialized with a hard-coded default text of `[ ] `
  - removed the hard-coded default marker from block creation and block splitting
  - updated checklist serialization so empty checklist blocks can still persist without injecting `[ ]` into the editor text
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` confirmed new checklist blocks no longer auto-insert `[ ]`

### 2026-03-27 11:42 CST

- Reworked the block command menu to be closer to the provided reference style:
  - top quick-switch strip for block type conversion
  - grouped lower actions instead of a flat command list
  - preserved real implemented actions only:
    - duplicate
    - delete
    - move up / move down
    - add below
  - kept slash-command entry working through the same visual container
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- Verification note:
  - browser QA for this visual round timed out, so only code/build verification is confirmed in this entry

### 2026-03-27 11:51 CST

- Refined the left block control to better match the Feishu-style reference:
  - replaced the isolated left-side `+` affordance with a compact block handle panel
  - moved the main action entry onto the left block handle
  - kept the add-below affordance under the handle
- Implemented drag-and-drop block reordering through the left block handle
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` confirmed:
    - the left block control now looks closer to the requested reference
    - blocks can be reordered by dragging the left handle

### 2026-03-27 12:08 CST

- Completed the next block-type implementation batch based on the analyzed video:
  - added `有序列表`
  - added `分割线`
  - added `链接`
  - added `图片`
- Connected the full chain for the new blocks:
  - slash/menu creation
  - structured content serialization
  - read-mode rendering
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` confirmed:
    - slash menu can create the new block types
    - save works
    - read mode renders the new block types correctly

### 2026-03-27 12:17 CST

- Refined the left block handle again to match the video reference more closely:
  - collapsed the left control into a single circular icon
  - removed the separate secondary `+` icon
  - kept add-below available through the action menu instead of a second visible control
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` confirmed the left side now keeps only one icon entry

### 2026-03-27 12:24 CST

- Refined the left block handle icon states further:
  - content blocks now show a `T + single vertical menu icon` style closer to the reference image
  - empty blocks keep the `+` icon state
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
- QA verification:
  - `qa_browser` confirmed the populated-block icon is now closer to the provided reference

### 2026-03-27 12:55 CST

- Fixed two editor interaction issues in the block toolbar flow:
  - changing block type from the action menu now preserves the current block text instead of resetting it
  - toolbar visibility is now driven only by the left handle and menu hover state, with a `1.5s` delayed hide after pointer leave
- Implementation details:
  - removed textarea `focus/change` paths that were forcing the toolbar visible
  - switched toolbar hover handling from mouse events to pointer events for more stable browser behavior
  - delayed menu close now also starts the hide timer
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - Playwright CLI direct regression:
    - opened `/docs/11111111-1111-1111-1111-111111111111`
    - entered edit mode
    - hovered the left toolbar handle, then moved to the text area
    - waited `2.2s`
    - evaluated the handle DOM style
    - Result: `opacity = 0`, `hovered = false`
- QA verification:
  - `qa_browser` confirmed block-type switching no longer loses block text
  - `qa_browser` reported an inconsistent result on the delayed-hide check; direct Playwright DOM verification on the latest restarted dev server passed

### 2026-03-27 13:05 CST

- Fixed malformed link-card navigation in read mode:
  - root cause: plain text stored in `href` was treated by the browser as a relative path such as `/docs/测试文档内容块1`
  - renderer now only makes link cards clickable when the target is a valid external URL
  - domain-like inputs such as `openai.com` are normalized to `https://openai.com`
  - invalid or empty href values now render as static cards instead of navigable links
  - save pipeline now normalizes link block URLs before persisting them
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success

### 2026-03-27 13:45 CST

- Fixed a homepage/dev-server runtime failure caused by corrupted Next.js dev cache:
  - symptom: `/` returned `500`
  - root cause: `.next/server` referenced a missing chunk for `app/icon.svg` (`Cannot find module './447.js'`)
  - action taken: stopped the dev server, removed `apps/web/.next`, and restarted `next dev`
- Verification:
  - `curl -I http://127.0.0.1:3000/`
    - Result: `200 OK`
  - `curl -I http://127.0.0.1:3000/docs/11111111-1111-1111-1111-111111111111`
    - Result: `200 OK`

### 2026-03-27 13:57 CST

- Switched the default PostgreSQL database name from `postgres` to `clouddoc`
- Created the `clouddoc` database and migrated the current CloudDoc application data from `postgres`
- Updated default connection references in:
  - `apps/api/app/core/config.py`
  - `apps/api/.env`
  - `README.md`
  - `apps/api/README.md`
  - `cloud-doc-prd.md`
  - `cloud-doc-content-model.md`
- Migrated data summary in `clouddoc.public`:
  - `documents = 8`
  - `document_contents = 18`
  - `document_versions = 18`
  - `document_favorites = 2`
  - `templates = 2`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - runtime verification:
    - backend `settings.database_url` resolved to `postgresql+psycopg://<redacted>@localhost:5432/clouddoc`
    - `curl http://127.0.0.1:8000/health`
      - Result: `{"status":"ok"}`
    - `curl -I http://127.0.0.1:3000/`
      - Result: `200 OK`
    - `curl -I http://127.0.0.1:3000/docs/11111111-1111-1111-1111-111111111111`
      - Result: `200 OK`

### 2026-03-27 14:05 CST

- Refined the editor block presentation to read as a continuous document instead of stacked cards
- Styling changes in edit mode:
  - removed visible card styling from block containers
  - removed box-like input styling from `link`, `image`, `quote`, and `code_block` editors
  - reduced inter-block gap and wrapper emphasis
  - only the active block now shows a light blue background highlight
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification:
    - entered edit mode on `/docs/11111111-1111-1111-1111-111111111111`
    - confirmed the editor renders as a continuous document with only the focused block highlighted

### 2026-03-27 14:18 CST

- Added a dedicated full test plan for the document editor page:
  - file: `document-editor-test-plan.md`
  - covers page-level actions, block editor behaviors, block types, keyboard interactions, persistence, exceptions, UI regression, and regression pack strategy
- Output structure includes:
  - scope
  - environment
  - coverage matrix
  - detailed test cases
  - automation recommendations
  - entry/exit criteria

### 2026-03-27 14:41 CST

- Started an automated test run for the current editor build
- Executed automated checks:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - health and route checks:
    - `GET /health` -> `200`
    - `GET /` -> `200`
    - `GET /docs/11111111-1111-1111-1111-111111111111` -> `200`
- Browser automation smoke tests executed against production-mode frontend on `http://127.0.0.1:3100`
  - verified document page load
  - verified enter-edit-mode
  - verified save action success
  - verified favorite / unfavorite success
  - verified homepage load success
- Found and fixed one real issue during automated testing:
  - production-mode browser writes from `3100` were blocked by CORS
  - added `http://127.0.0.1:3100` to backend CORS allowlist in:
    - `apps/api/app/core/config.py`
    - `apps/api/.env`

### 2026-03-27 15:15 CST

- Fixed empty block persistence in document edit mode
- Root cause:
  - `contentFromBlocks()` skipped empty blocks during serialization
  - newly inserted empty blocks were lost after save/reload
- Fix:
  - empty blocks are now serialized with `preservedEmpty` markers
  - editor reconstructs them after save and re-entering edit mode
  - read mode hides preserved-empty placeholders so the rendered document stays clean
- Files updated:
  - `apps/web/components/editor/document-page.tsx`
  - `apps/web/components/editor/document-renderer.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser automation on `http://127.0.0.1:3100`
    - before insert: `5` blocks
    - after `Enter` on the last block: `6` blocks
    - after save and re-enter edit mode: `6` blocks
    - Result: empty block persisted successfully
  - test document state restored after verification

### 2026-03-27 15:32 CST

- Refactored the workspace left navigation and content routing
- Sidebar updates:
  - converted the left sidebar to a fixed `aside`
  - main content now reserves left space instead of scrolling the sidebar away
  - improved active-item styling for route-based selection
- Navigation routes changed from same-page anchors to standalone pages:
  - `/` 工作台
  - `/recent`
  - `/documents`
  - `/spaces`
  - `/favorites`
  - `/templates`
  - `/trash`
- Refactored dashboard content:
  - home page now only shows workspace overview and recent documents
  - added dedicated pages for recent documents, all documents, spaces, favorites, and trash
  - added reusable dashboard section components
  - moved trash restore UI into its own component
- Files added:
  - `apps/web/components/dashboard/dashboard-sections.tsx`
  - `apps/web/components/dashboard/trash-list.tsx`
  - `apps/web/app/recent/page.tsx`
  - `apps/web/app/documents/page.tsx`
  - `apps/web/app/spaces/page.tsx`
  - `apps/web/app/favorites/page.tsx`
  - `apps/web/app/trash/page.tsx`
- Files updated:
  - `apps/web/components/layout/app-shell.tsx`
  - `apps/web/components/layout/sidebar-nav.tsx`
  - `apps/web/components/dashboard/workspace-overview.tsx`
  - `apps/web/app/page.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - production route checks on `http://127.0.0.1:3100`
    - `/` -> `200`
    - `/recent` -> `200`
    - `/documents` -> `200`
    - `/spaces` -> `200`
    - `/favorites` -> `200`
    - `/templates` -> `200`
    - `/trash` -> `200`

### 2026-03-27 15:38 CST

- Fixed duplicate title rendering on the document detail page
- Root cause:
  - the page header rendered the document title
  - the document body also rendered the first `H1` node from content
  - this produced two identical titles in read mode
- Fix:
  - in read mode, when the first content node is an `H1` matching the page title, it is omitted from the body renderer
- File updated:
  - `apps/web/components/editor/document-page.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - page header kept the single document title
    - body no longer rendered the duplicate title node

### 2026-03-27 15:45 CST

- Fixed the document detail page layout jump when toggling into edit mode
- Root cause:
  - the outer page grid switched layout based on `isEditing`
  - the left page-directory aside was hidden in edit mode
  - clicking `编辑` changed the whole page structure instead of only switching the content area from read mode to edit mode
- Fix:
  - keep the same two-column document layout in both read and edit mode
  - keep the left page-directory aside mounted and visible on `xl` screens
  - only switch the title/body region between readonly renderer and block editor
- File updated:
  - `apps/web/components/editor/document-page.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - before clicking `编辑`, the left page-directory column was visible
    - after clicking `编辑`, the left page-directory column stayed visible
    - only the title/body region changed into editable controls

### 2026-03-27 15:52 CST

- Fixed block size inflation after entering edit mode on the document page
- Root cause:
  - editable blocks used larger minimum heights than the readonly renderer
  - non-code blocks also forced a minimum of `2` textarea rows
  - switching to edit mode made single-line blocks expand into visibly taller controls
- Fix:
  - aligned editable block font size and line height with readonly rendering
  - removed inflated minimum heights from normal block types
  - changed non-code blocks to default to `1` row instead of `2`
- File updated:
  - `apps/web/components/editor/block-editor.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - first paragraph block in edit mode now reports `rows = 1`
    - computed `line-height = 32px`
    - computed `font-size = 16px`
    - single-line block no longer expands into a two-line-high control

### 2026-03-27 16:02 CST

- Refined the document editor so edit mode keeps the same body layout as readonly mode
- Root cause:
  - block action controls occupied a real layout column inside the editor
  - the editor rendered an extra footer hint line
  - entering edit mode therefore changed the document body's width, indentation, and trailing content
- Fix:
  - moved block controls to an overlay outside the text flow
  - kept the document body aligned to the same text column as readonly mode
  - removed the footer hint row from the article body
  - limited the visual difference to the active block highlight and editable controls themselves
- File updated:
  - `apps/web/components/editor/block-editor.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - readonly mode body stayed left-aligned to the normal document text column
    - edit mode body kept the same text column without an extra toolbar column
    - footer hint text was removed

### 2026-03-27 16:12 CST

- Reduced vertical spacing between document blocks to about one-fifth of the previous value
- Fix:
  - changed the main block stack spacing from `space-y-5` to `space-y-1` in both readonly and edit renderers
  - reduced horizontal-rule outer spacing to match the denser block rhythm
- Files updated:
  - `apps/web/components/editor/block-editor.tsx`
  - `apps/web/components/editor/document-renderer.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `4 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - readonly and edit mode both render with tighter block spacing

### 2026-03-27 16:30 CST

- Added a new `pdf` document type with upload-only workflow
- Backend changes:
  - added `pdf` to supported document types
  - mounted `/uploads` static file serving for uploaded PDF assets
  - added `POST /api/documents/upload-pdf` multipart upload endpoint
  - stored PDF file metadata in `document_contents.content_json.file`
  - returned `file_url`, `file_name`, `mime_type`, and `file_size` in document detail
  - restricted normal `POST /api/documents` creation to `doc` documents only
- Frontend changes:
  - `+ 新建文档` now opens a type chooser
  - users can create a normal document or upload a PDF
  - document detail page now renders a read-only PDF preview and disables edit for PDF documents
  - frontend resolves relative upload URLs to the API origin for preview
- Files updated:
  - `apps/api/pyproject.toml`
  - `apps/api/app/core/config.py`
  - `apps/api/app/main.py`
  - `apps/api/app/api/routes/documents.py`
  - `apps/api/app/schemas/document.py`
  - `apps/api/app/services/document_service.py`
  - `apps/api/app/sql/001_init.sql`
  - `apps/api/tests/test_documents_api.py`
  - `apps/web/lib/api.ts`
  - `apps/web/lib/mock-document.ts`
  - `apps/web/components/layout/sidebar-nav.tsx`
  - `apps/web/components/editor/document-page.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `5 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - new document panel showed `普通文档` and `PDF 文档`
    - PDF file upload completed successfully
    - uploaded PDF navigated to a read-only preview page with `pdf` type badge and disabled edit state

### 2026-03-27 16:32 CST

- Changed the new-document type selector from an inline sidebar panel to a modal dialog
- Fix:
  - sidebar now only triggers the create flow
  - document type selection is shown in a centered modal overlay
  - closing the modal also clears staged PDF title/file state
- File updated:
  - `apps/web/components/layout/sidebar-nav.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `5 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - clicking `+ 新建文档` opened a modal dialog
    - sidebar navigation remained unchanged and did not expand inline

### 2026-03-27 16:36 CST

- Fixed the create-document modal positioning so it renders at the viewport center instead of being constrained by the left sidebar
- Root cause:
  - the modal DOM was still rendered inside the sidebar component tree
  - this kept the overlay grouped with the left navigation container in accessibility/layout snapshots
- Fix:
  - moved the modal layer out of the sidebar `aside`
  - rendered the modal as a sibling overlay with its own page-level stacking context
- File updated:
  - `apps/web/components/layout/sidebar-nav.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `5 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - the `dialog` node now renders outside the sidebar tree
    - modal content appears as a centered page overlay

### 2026-03-27 17:30 CST

- Widened the document detail page content area
- Fix:
  - increased the shared max width for the document header and article body from `840px` to `980px`
  - kept readonly and edit mode on the same wider content column
- File updated:
  - `apps/web/components/editor/document-page.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `5 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - document detail page renders with the updated wider content container

### 2026-03-27 17:36 CST

- Changed PDF document viewing from embedded iframe preview to opening the original PDF in a new browser tab
- Fix:
  - removed the in-page embedded PDF viewer
  - replaced it with explicit actions for `新标签打开 PDF` and `打开原始文件`
  - kept the PDF detail page as a lightweight metadata and launch surface
- File updated:
  - `apps/web/components/editor/document-page.tsx`
- Automated verification:
  - `cd apps/api && .venv/bin/pytest -q`
    - Result: `5 passed`
  - `cd apps/web && npm run build`
    - Result: success
  - browser verification on `http://127.0.0.1:3100`
    - PDF detail page no longer renders an iframe
    - page shows links that open the uploaded PDF in a new tab

### 2026-03-30 10:30 CST

- Investigated team-space related functionality with focus on the `/spaces` page
- Findings:
  - `/spaces` returned `500 Internal Server Error` when the backend spaces API was unavailable
  - root cause was missing fallback/error handling in `fetchSpaces()` on the frontend
- Fix:
  - added frontend fallback data for spaces
  - added `try/catch` handling in `fetchSpaces()`
  - normalized `updatedAt` formatting for successful space API responses to match other dashboard pages
- File updated:
  - `apps/web/lib/api.ts`
- Verification:
  - `cd apps/web && npm run build`
    - Result: success
  - route check
    - `GET http://127.0.0.1:3100/spaces` -> `200 OK`
  - browser/content verification
    - `/spaces` now renders the team page shell correctly
    - fallback spaces `产品团队` and `我的空间` are visible when backend data is unavailable
- Note:
  - backend pytest in the current environment did not complete because the backend startup path is hanging on external dependencies; frontend route verification was completed against the running `3100` service

### 2026-03-30 10:45 CST

- Audited remaining SSR data-fetch interfaces for graceful degradation when the backend API is unavailable
- Findings:
  - `/templates` could return `500` because `fetchTemplates()` threw on failed API responses
  - `/search` could return `500` because `searchDocuments()` threw on failed API responses
  - backend `8000` is currently not listening, which provided a direct failure scenario to verify frontend fallback behavior
- Fix:
  - added `try/catch` and fallback data to `fetchTemplates()`
  - added `try/catch` and fallback search results to `searchDocuments()`
  - kept client-side write actions unchanged; those already surface local error messages instead of crashing the page shell
- File updated:
  - `apps/web/lib/api.ts`
- Verification:
  - `cd apps/web && npm run build`
    - Result: success
  - backend availability check
    - `GET :8000` listener check -> not running
  - route checks on `http://127.0.0.1:3100`
    - `GET /` -> `200 OK`
    - `GET /spaces` -> `200 OK`
    - `GET /templates` -> `200 OK`
    - `GET /search?q=文档` -> `200 OK`
  - content verification
    - `/templates` renders fallback templates `需求文档` and `会议纪要`
    - `/search?q=文档` renders fallback results instead of failing
    - `/search?q=nomatch-keyword` renders the no-results state instead of failing

### 2026-03-30 14:10 CST

- Removed frontend fallback/mock business data and switched page rendering to use only real backend responses
- Changes:
  - deleted fake fallback behavior in `apps/web/lib/api.ts`
  - `fetchDocument()` now returns `null` when the backend is unavailable instead of returning a mock document
  - list/search/template/space fetchers now return empty arrays on backend failure instead of fake records
  - document detail route now renders an explicit unavailable state when backend data cannot be loaded
  - workspace overview metrics now derive from real document data instead of hard-coded demo counts
  - template center now renders an empty state instead of demo templates when backend data is unavailable
  - document view model defaults were cleaned so no mock document content is injected on successful responses with sparse payloads
- Files updated:
  - `apps/web/lib/api.ts`
  - `apps/web/lib/mock-document.ts`
  - `apps/web/app/docs/[docId]/page.tsx`
  - `apps/web/components/dashboard/workspace-overview.tsx`
  - `apps/web/components/templates/template-gallery.tsx`
- Verification:
  - `cd apps/web && npm run build`
    - Result: success
  - restarted the single frontend server on `http://127.0.0.1:3100`
  - with backend `8000` unavailable:
    - `/` renders zero-count real-data cards and no fake documents
    - `/templates` renders empty state and no demo templates
    - `/spaces` renders empty state and no fake spaces
    - `/search?q=文档` renders no-results state and no fake search hits
    - `/docs/11111111-1111-1111-1111-111111111111` renders explicit unavailable state instead of fake document content

### 2026-03-30 14:25 CST

- Restored the backend API service on `127.0.0.1:8000`
- Findings:
  - PostgreSQL `clouddoc` contained real data (`documents=15`, `document_contents=58`, `document_versions=58`, `templates=2`, `spaces=1`)
  - frontend `3100` was empty because the API service was not listening on `8000`, not because the database lacked data
- Verification:
  - `GET http://127.0.0.1:8000/health` -> `{"status":"ok"}`
  - `GET /api/documents` returned real document rows
  - `GET /api/templates` returned real template rows
  - `GET /api/spaces` returned real space rows
  - `GET http://127.0.0.1:3100/` now shows real document records such as `我的测试文档` and `CloudDoc V1 产品简介`
  - `GET http://127.0.0.1:3100/templates` now shows real templates `需求文档` and `会议纪要`
- 2026-03-30 17:46 CST: 统一文档阅读态与编辑态界面结构。标题和正文块改为同一套 input/textarea 与 BlockEditor DOM，阅读态通过 readOnly + caret-transparent 禁止编辑并保持排版一致；重建前端并重启 3100，后端 pytest 5 passed，前端 build 通过，Playwright 回归确认只读态与编辑态正文容器一致，仅编辑态显示块工具按钮与保存/取消按钮。
- 2026-03-30 17:58 CST: 修复文档阅读态行尾多余 `|`。原因是历史 `link_card/image_block` 空地址仍按 `标题 | 地址` 文本格式展示；在阅读态显示层对空地址分隔符做清洗，并同步清洗顶部摘要标签中的旧 `plain_text` 残留。前端重新 build 并重启 3100 验证通过。
- 2026-03-30 18:09 CST: 文档模式切换改为下拉选择（只读/编辑），移除手动保存/取消按钮。编辑态引入 1.2s 自动保存；切回只读时如果存在未提交变更，会等待自动提交完成后再切换。前端 build 通过，后端 pytest 5 passed，Playwright 回归验证了两条链路：1) 编辑后自动触发 PUT /content 并保存；2) 编辑后立即切回只读，后端仍会收到并保存最新修改。示例文档已恢复原内容。
- 2026-03-30 18:12 CST: 文档页顶部“回收站”按钮改为“删除”，并新增删除确认弹窗。用户点击删除后不会立即执行，需在弹窗中二次确认才会移入回收站。前端 build 通过，后端 pytest 5 passed，Playwright 回归确认按钮文案和确认弹窗均生效。
- 2026-03-30 18:18 CST: 重做文档模式切换控件，对齐参考视频样式。原生 select 替换为胶囊按钮 + 自定义浮层菜单，加入图标、当前项高亮、右侧勾选、箭头旋转以及菜单淡入下滑动画；同时补了点击外部与 Esc 关闭。前端 build 通过，后端 pytest 5 passed，Playwright 截图回归确认新样式已生效。
- 2026-03-30 18:26 CST: 统一把前端按钮、模式菜单、弹窗和相关矩形状态块的圆角从 `rounded-xl` 再收小一档到 `rounded-lg`，整体更接近矩形按钮风格。前端 build 通过，后端 pytest 5 passed，Playwright 截图回归确认 3100 上圆角已变小。

## 2026-03-30 19:21 CST
- 调整文档模式记忆规则：首次打开文档默认进入编辑模式，已打开过的文档按该文档上次模式恢复。
- 模式状态按文档 ID 持久化到浏览器本地存储，PDF 文档继续固定只读。
- 文档切换时重置草稿和模式加载状态，避免不同文档之间串模式。
- 自动化验证：`apps/web` 执行 `npm run build` 通过；`apps/api` 执行 `pytest -q` 通过（5 passed）；Playwright 验证首次打开显示“编辑”，切换到“只读”后刷新仍保持“只读”。

## 2026-03-31 09:52 CST
- 基于链接卡片视频实现第一版：空块粘贴 URL 自动转为链接块，并调用后端抓取 metadata。
- 新增后端接口 `POST /api/documents/link-preview`，返回 title、description、site_name、icon、image。
- 链接块新增 4 种展示模式：`链接视图 / 标题视图 / 卡片视图 / 预览视图`。
- 链接块新增工具栏：刷新预览、视图切换，以及占位的布局/更多/评论入口。
- 自动化验证：`apps/api` 执行 `pytest -q` 通过（7 passed）；`apps/web` 执行 `npm run build` 通过；Playwright 验证空块粘贴 `https://example.com` 后自动转链接块，并可切换到 `卡片视图` 显示 `Example Domain`。

## 2026-03-31 09:58 CST
- 运行真实浏览器回归时发现旧示例文档被整页渲染成链接块；根因是历史内容里混入了 `href` 为空的 `link_card` 节点。
- 修复前端加载链路：`blocksFromDocument()` 遇到无有效 URL 的 `link_card` 时，直接降级为普通段落，避免阅读态和编辑态把普通文本错误显示为链接块。
- 同步修复备用阅读渲染器：`document-renderer.tsx` 中无有效 URL 的 `link_card` 不再显示链接样式，只按普通文本渲染。
- 自动化验证：`apps/api` 执行 `pytest -q` 通过（7 passed）；`apps/web` 执行 `npm run build` 通过；重启 `3100` 后用 Playwright 复测 `CloudDoc V1 产品简介`，确认只保留一个真实链接块，其余文本块恢复正常显示。

## 2026-03-31 10:03 CST
- 新增“末尾真实空块”规则：编辑模式下，如果最后一个块变成非空内容，会自动在文档尾部追加一个真实空段落块。
- 该空块直接进入 `draftBlocks`，属于真实文档结构，自动保存后会落库；刷新后仍会保留。
- 实现位置：`document-page.tsx` 增加 `blockHasMeaningfulContent()` 和编辑态尾块补齐 effect，仅处理文档尾部，不改动中间块。
- 自动化验证：`apps/api` 执行 `pytest -q` 通过（7 passed）；`apps/web` 执行 `npm run build` 通过；Playwright 创建临时文档后验证末尾输入内容会保留一个新的空块，自动保存成功，刷新后仍存在。

## 2026-03-31 10:18 CST
- 顶部模式菜单新增“鼠标离开后 1.5 秒自动关闭”行为，沿用现有淡出动画，不再停留在打开状态。
- `document-page.tsx` 新增 `modeMenuHideTimerRef`、`keepModeMenuOpen()` 和 `hideModeMenuWithDelay()`，并把 pointer enter/leave 绑定到菜单容器和浮层本身。
- 自动化验证：`apps/api` 执行 `pytest -q` 通过（7 passed）；`apps/web` 执行 `npm run build` 通过；Playwright 验证菜单打开后移出 1.7 秒，样式从 `opacity:1 / pointer-events:auto` 变成 `opacity:0 / pointer-events:none`。

## 2026-03-31 10:24 CST
- 调整块工具菜单交互：
  - 悬浮块时显示左侧工具入口。
  - 悬浮工具入口时自动展开块工具菜单，不再强依赖点击。
  - 工具入口宽度增至 `42px`，比原来更宽。
  - 工具菜单在鼠标移出后延迟 `1.5s` 自动关闭，并带淡出位移动画。
- 实现位置：`block-editor.tsx` 新增 `closingCommandMenuBlockId`、`hideCommandMenuWithDelay()`、`openActionsMenu()` 和对应的 pointer enter/leave 逻辑。
- 自动化验证：`apps/api` 执行 `pytest -q` 通过（7 passed）；`apps/web` 执行 `npm run build` 通过；Playwright 验证块入口悬浮即可展开菜单，移出 `1.55s` 后菜单进入淡出，`250ms` 后完全卸载。

## 2026-03-31 10:29 CST
- 进一步优化块工具菜单关闭逻辑：
  - 鼠标移出后延时从 `1.5s` 改为 `1s`。
  - 点击菜单外任意区域时，也会走淡出关闭，而不是直接硬切。
- 实现位置：`block-editor.tsx` 新增 `commandMenuRef` 和 actions 菜单的全局 `pointerdown` / `Escape` 监听；关闭统一走 `closeCommandMenuWithFade()`。
- 自动化验证：`apps/api` 执行 `pytest -q` 通过（7 passed）；`apps/web` 执行 `npm run build` 通过；Playwright 验证鼠标移出 `1.1s` 后菜单已进入淡出状态，点击页面其他区域后菜单直接进入淡出并卸载。

## 2026-03-31 10:34 CST
- 调整块工具菜单定位：
  - 菜单改为基于工具按钮的 `fixed` 定位。
  - 优先显示在工具按钮左侧。
  - 如果左侧空间不足，则自动回退并裁剪到浏览器可视区域内，避免超出窗口。
- 实现位置：`block-editor.tsx` 新增 `handleButtonRefs`、`commandMenuPosition` 和基于 `getBoundingClientRect()` 的定位计算，同时监听 `resize` / `scroll` 动态更新位置。
- 自动化验证：`apps/api` 执行 `pytest -q` 通过（7 passed）；`apps/web` 执行 `npm run build` 通过；Playwright 验证工具菜单使用 `fixed` 定位并保持在视口内。

## 2026-03-31 10:39 CST
- 收紧块工具菜单样式密度：
  - 顶部块类型按钮改为纯图标，文字说明移除，提示改用浏览器 `title` 悬浮提示。
  - 顶部图标区从 `6` 列改为更紧凑的 `5` 列布局。
  - 下方命令列表和操作列表缩小内边距、行高、段间距，整体更接近紧凑样式。
- 实现位置：`block-editor.tsx` 中命令菜单的顶部图标区、命令列表区、操作列表区样式类全面收紧。
- 自动化验证：`apps/api` 执行 `pytest -q` 通过（7 passed）；`apps/web` 执行 `npm run build` 通过；`GET http://127.0.0.1:3100/docs/11111111-1111-1111-1111-111111111111` 返回 `200`。
- 备注：本轮 Playwright MCP 在本机临时目录初始化时报 `ENOENT: mkdir '/.playwright-mcp'`，浏览器级样式回归被环境问题阻断，待工具环境恢复后补跑。

## 2026-03-31 11:50 CST
- 针对块工具栏跑了一轮终端版 Playwright 专项回归，覆盖：
  - hover 打开工具菜单
  - 顶部块类型切换（正文 -> 标题）
  - 底部操作：在下方添加 / 复制 / 删除
  - 点击页面其他区域关闭菜单
- 回归结果：
  - 菜单可正常打开
  - 顶部“标题”切换后占位文案变为 `输入标题块`
  - `在下方添加` 后块数 `4 -> 5`
  - `复制` 后块数 `5 -> 6`
  - `删除` 后块数 `6 -> 5`
  - 外部点击后菜单状态 `1 -> 0`
  - 终端版 Playwright 控制台检查：`0 errors`
- 结论：本轮块工具栏专项测试未发现新的产品级 bug；测试临时文档已删除。

## 2026-03-31 17:20 CST
- 修复链接块删除入口异常：块手柄由 click 改为 mouseDown 打开动作菜单，并在手柄/块容器离开时尊重 pinned 菜单状态，避免链接块菜单刚打开就被关闭，导致删除入口不可达。
- 自动化验证：apps/api `pytest -q` => 7 passed；apps/web `npm run build` => passed；3100 已重启到最新构建。

## 2026-03-31 17:36 CST
- 新增标题层级支持：文档块支持 H1-H6 层级持久化，工具菜单顶部根据当前标题级别显示 Hx 到 Hx+3，最多 H6；非标题块默认显示 H1-H4。
- 调整工具菜单顶部样式：移除胶囊按钮感，改为直接文本/图标行样式，保持紧凑布局。
- 自动化验证：apps/api `pytest -q` => 7 passed；apps/web `npm run build` => passed；3100 已重启到最新构建。

## 2026-03-31 17:48 CST
- 修正标题级别工具条：不再按当前级别截断，始终显示完整 H1-H6，避免选到 H4 后 H1-H3 消失。
- 自动化验证：apps/api `pytest -q` => 7 passed；apps/web `npm run build` => passed；3100 已切到最新构建。
- 浏览器回归受本机 playwright-cli session socket 异常影响，未完成可视化自动校验。

## 2026-04-01 10:22 CST
- Added explicit API-unavailable handling in `apps/web/lib/api.ts` so list/detail fetches distinguish empty data from backend failures.
- Added shared warning banner `apps/web/components/common/api-unavailable-notice.tsx` and surfaced it on workspace, list, space, template, search, trash, and document detail pages.
- Marked all API-backed pages as `force-dynamic` to prevent `next start` from serving stale build-time data when the backend goes down.
- Verified true degradation by stopping `8000`, confirming `3100` rendered warning banners on `/` and `/search?q=abc`, then restored backend.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.

## 2026-04-02 09:36 CST
- Updated block editor textareas to auto-resize to content height and hide internal scrollbars.
- Multi-line text blocks now fully expand instead of showing a nested scroll area.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-02 10:04 CST
- Added structured multi-line paste handling in the block editor.
- Pasting large text now splits by newline and maps common patterns into matching block types: headings (`#`), ordered lists, bullet lists, check lists, dividers, and paragraphs.
- Paste insertion preserves surrounding text before/after the current selection and keeps the resulting document structure aligned with the pasted content.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-02 10:11 CST
- Changed block editor placeholders to only appear on the active block.
- Inactive empty blocks no longer show the default command hint.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-02 10:18 CST
- Fixed read-only block editor state leakage: read mode no longer sets active block focus state or shows edit-mode background highlight.
- Added `tabIndex={-1}` for read-only block textareas so reading keeps the same layout without entering editable focus behavior.
- Root cause: reused edit DOM without fully disabling read-only interaction state.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-02 14:32 CST
- Fixed empty paragraph visibility in read mode by making block textarea auto-height keep at least one line height.
- Root cause: auto-resize used only `scrollHeight`, so empty blocks collapsed to zero height in read mode.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-02 14:38 CST
- Added hover activation styling for blocks in edit mode so block boundaries are visible before focus.
- Edit mode now shows a light blue hover background per block; read mode remains unchanged.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-02 14:45 CST
- Fixed loss of blank lines in empty text blocks by persisting raw paragraph/blockquote text as `attrs.raw_text` in document content.
- Empty multi-line blocks now round-trip through save, refresh, and mode switching without collapsing to a single empty line.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-02 14:53 CST
- Added HTML-aware paste parsing in the block editor.
- Paste now preserves top-level structure from clipboard HTML for headings, ordered lists, unordered lists, check lists, quotes, code blocks, dividers, and paragraphs instead of flattening everything to plain text.
- Root cause: previous paste logic only consumed `text/plain`, so hierarchy from rich clipboard content was discarded.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-03 11:48 CST
- Reworked document header layout so action buttons no longer reduce the available title width.
- Switched the document title field from single-line input to auto-resizing textarea, allowing long titles to wrap naturally instead of clipping abruptly.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-03 11:56 CST
- Widened the left outline sidebar and reduced horizontal whitespace around the document canvas.
- Increased document header/body max width from 980px to 1120px and reduced section padding for a denser reading layout.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-03 12:01 CST
- Further widened the left outline sidebar to 260px and reduced document page horizontal padding again.
- Increased document header/body max width from 1120px to 1240px for a wider content canvas.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-03 12:09 CST
- Fixed block drag-reorder regression by removing `preventDefault()` from the drag handle mousedown path.
- Root cause: opening the block action menu on `mousedown` blocked the browser drag gesture before `dragstart` could fire.
- Behavior now: hover still reveals the menu, click pins/opens the menu, drag reordering works again from the same handle.
- Automated checks: `apps/api .venv/bin/pytest -q` => 7 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-07 09:54 CST
- Added direct image paste support in the block editor.
- Clipboard image files now upload through a new backend endpoint `POST /api/documents/upload-image` and are inserted as real `image_block` nodes.
- Reused the existing uploads directory/static file serving instead of adding a separate storage path.
- Added backend coverage for image upload and verified the returned `/uploads/*.png` asset is immediately accessible.
- Automated checks: `apps/api .venv/bin/pytest -q` => 8 passed; `apps/web npm run build` => passed.
- Restarted backend `8000` and frontend `3100` to serve the latest code.

## 2026-04-07 10:02 CST
- Fixed image block rendering after paste.
- Root cause: pasted images were uploaded correctly, but the editor still rendered the block's raw source text (`file_name | url`) instead of an image preview.
- Image blocks now render as actual image previews in the editor and no longer expose the raw source string as a textarea.
- Automated checks: `apps/api .venv/bin/pytest -q` => 8 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-07 10:14 CST
- Tightened image block layout so images no longer sit inside an oversized bordered card with large horizontal blank space.
- Added an image hover toolbar at the top-right of the image with left/center/right alignment controls, open-original, copy-link, and delete actions.
- Persisted image alignment into document content so read mode and edit mode keep the same image placement.
- Automated checks: `apps/api .venv/bin/pytest -q` => 8 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-07 10:18 CST
- Fixed image alignment persistence.
- Root cause: image alignment was written into document content, but the frontend dirty-check signature ignored `imageAlign`, so auto-save never fired after changing alignment.
- Added `imageAlign` into both draft and saved block signatures so alignment changes now trigger save and survive refresh.
- Automated checks: `apps/api .venv/bin/pytest -q` => 8 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-07 10:24 CST
- Fixed focus loss after pressing Enter to create a new block.
- Root cause: the 1.2s autosave replaced the local editor block tree with a fresh server-derived block array, which remounted the new textarea and dropped focus.
- Autosave now keeps the existing in-memory draft block tree and stable block ids instead of replacing it from the save response.
- Automated checks: `apps/api .venv/bin/pytest -q` => 8 passed; `apps/web npm run build` => passed.
- Restarted frontend `3100` to serve the latest build.

## 2026-04-07 10:43 CST
- Implemented `P0` comment threads for document text selections.
- Added backend comment thread/comment tables, routes, service methods, and API coverage for create/list/reply/status-update flows.
- Added stable persisted `block_id` attributes to document content nodes so comment anchors survive save/refresh.
- Added a right-side comment sidebar, read-only text selection comment toolbar, thread badges on blocks, and block/thread bidirectional activation.
- Automated checks: `apps/api .venv/bin/pytest -q` => 9 passed; `apps/web npm run build` => passed.
- Restarted backend `8000` and frontend `3100` to serve the latest build.

## 2026-04-07 10:58 CST
- Switched read-only text blocks from `textarea` to a dedicated text layer so inline comment highlights can render directly in document content.
- Added range-based comment highlight segmentation per block using persisted comment anchors; clicking a highlighted range activates the corresponding thread.
- Moved read-only selection-to-comment offset calculation onto the rendered text layer instead of textarea selection APIs.
- Automated checks: `apps/api .venv/bin/pytest -q` => 9 passed; `apps/web npm run build` => passed.

## 2026-04-07 15:58 CST
- Switched frontend API base configuration from absolute `127.0.0.1:8000/api` to relative `/api` in runtime defaults and root env files.
- Kept uploaded asset URLs relative, so image and file access now stays proxy-friendly across different network segments.
- Automated checks: `apps/api .venv/bin/pytest -q` => 9 passed; `apps/web npm run build` => passed.

## 2026-04-07 16:48 CST
- Added Next.js rewrites for `/api/*` and `/uploads/*` so direct access to local `3100` also proxies correctly to backend `8000`.
- Added centralized `CLOUDDOC_BACKEND_ORIGIN` config to root env files for the local frontend-to-backend proxy target.
- Automated checks: `apps/api .venv/bin/pytest -q` => 9 passed; `apps/web npm run build` => passed.

## 2026-04-07 16:53 CST
- Fixed SSR data fetching after switching frontend API config to relative `/api`.
- Browser requests still use relative `/api`, but server-rendered pages now resolve relative API paths against `CLOUDDOC_BACKEND_ORIGIN` so direct access to local `3100` no longer falls into the API-unavailable state.
- Automated checks: `apps/api .venv/bin/pytest -q` => 9 passed; `apps/web npm run build` => passed.

## 2026-04-07 16:59 CST
- Removed the read-only-only restriction from text selection comments.
- Comment creation now works in both edit mode and read mode for text blocks, which matches the current default document opening mode.
- Automated checks: `apps/api .venv/bin/pytest -q` => 9 passed; `apps/web npm run build` => passed.

## 2026-04-07 17:07 CST
- Tightened the right-side comment sidebar spacing, textarea heights, and action button sizes for a denser review panel.
- Added automatic scroll-to-thread behavior when a commented text range activates a thread, so clicking commented text now locates the corresponding sidebar thread.
- Added backend comment-thread synchronization during document save: threads now relocate when possible and are deleted together with their comments when the quoted text is actually removed from the document.
- Added API coverage for comment-thread removal when quoted text is deleted.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-07 17:14 CST
- Fixed comment creation visibility in edit mode by removing the remaining read-only-only guard from the selection toolbar rendering path.
- Added bidirectional hover linkage between inline comment highlights and sidebar threads so text hover and thread hover now share the same highlight state.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-07 17:20 CST
- Fixed read-mode empty-line loss after switching text blocks to the custom read-only text layer.
- Read-only text blocks now preserve minimum height based on the real line count from the stored block text, so blank paragraphs and newline-only blocks remain visible.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-07 17:28 CST
- Restored comment visibility in edit mode by rendering inline comment highlight underlays for editable text blocks.
- Clicking inside a commented text range in edit mode now activates the corresponding comment thread based on caret offset.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-07 17:46 CST
- Added the unified text-surface design document at `text-block-unified-surface-design.md` and started the refactor against that plan.
- Removed the dedicated read-only text-layer branch from `block-editor`; text blocks now use the same textarea surface in both read and edit modes, with `readOnly` as the behavior switch.
- Comment highlighting, empty-line preservation, selection handling, and thread activation now stay on that single text surface instead of splitting between read-only text spans and editable textareas.
- Added explicit divider rendering while keeping text blocks on the unified surface.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-08 10:08 CST
- Continued the unified text-surface refactor by removing the remaining read-only value branching from text blocks.
- Added a single `showsUnifiedTextSurface()` gate so text blocks now pass through one visible surface branch, while `link/image/divider` stay on their specialized renderers.
- Simplified text value handling so the unified surface always reads from the same stored block text, reducing the chance of mode-specific divergence returning later.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-08 10:18 CST
- Extracted the unified text rendering branch into a dedicated `TextBlockSurface` component inside `block-editor`.
- Moved comment highlight underlay, textarea surface wiring, and readOnly/editable switching behind that component so later text-surface changes are centralized in one place.
- Fixed a React-vs-DOM keyboard event type collision introduced during the extraction.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-08 10:29 CST
- Centralized unified text-surface event logic by extracting change, paste, focus, blur, selection, and keydown handling into dedicated handlers in `block-editor`.
- `TextBlockSurface` now consumes a stable handler set instead of large inline JSX callbacks, reducing the chance of read/edit behavior drifting apart again.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-08 10:39 CST
- Moved `TextBlockSurface` into its own file: `apps/web/components/editor/text-block-surface.tsx`.
- Moved the comment range type and the unified text underlay rendering logic with it, so text-surface changes no longer require editing the larger `block-editor` file.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-08 10:48 CST
- Moved text-surface helper functions into `apps/web/components/editor/text-block-surface-utils.ts`.
- `block-editor` now imports text display, placeholder, row sizing, min-height, and unified-surface predicates instead of defining them inline.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-08 10:55 CST
- Moved slash-command parsing and quick-command definitions into `apps/web/components/editor/block-command-utils.ts`.
- `block-editor` now imports command-query and quick-command helpers instead of carrying that text-surface-adjacent logic inline.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-08 11:03 CST
- Moved text-surface selection helpers into `apps/web/components/editor/text-block-selection-utils.ts`.
- Thread hit testing and selection-toolbar anchor construction are now isolated from `block-editor`, further reducing text-surface-specific logic in the main editor file.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-08 11:13 CST
- Extracted the inline comment-selection popover into `apps/web/components/editor/comment-selection-toolbar.tsx`.
- `block-editor` now delegates selection-toolbar rendering instead of carrying that UI inline.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.

## 2026-04-08 11:20 CST
- Made comment thread count badges visible in both read mode and edit mode so annotated blocks keep the same information structure across modes.
- Automated checks: `apps/api .venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed.
- 2026-04-08 11:32 CST: moved bullet/ordered list line markers into the unified TextBlockSurface so read/edit share the same surface layout and gutter treatment.
- 2026-04-08 11:47 CST: moved checklist markers and toggle handling into the unified TextBlockSurface so check-list blocks share the same read/edit surface and preserve checked state through display-text edits.
- 2026-04-08 12:02 CST: made active comment-thread selection scroll and select the unified text surface in both read and edit mode so comment navigation no longer diverges by mode.
- 2026-04-08 12:11 CST: mapped checklist comment offsets between stored raw text and displayed text so comment highlighting, selection, and thread activation stay aligned after moving checklist rendering into the unified text surface.
- 2026-04-08 12:24 CST: replaced fixed list/check gutter widths with dynamic unified-surface gutter sizing so ordered lists with multi-digit indices keep read/edit alignment without hard-coded padding.
- 2026-04-08 12:39 CST: removed the unused legacy read-only document renderer component to eliminate stale dual-rendering code paths after the unified text-surface refactor.
- 2026-04-08 12:46 CST: added a final cleanup pass by removing the unused legacy read-only renderer and including frontend lint in the closing validation set for the unified text-surface work.
- 2026-04-08 12:58 CST: removed the partial ESLint bootstrap artifacts after confirming lint dependency installation is environment-blocked, keeping the repo free of half-configured tooling state.
- 2026-04-08 13:08 CST: added user-system-design.md to define the authentication, session, organization, membership, and permission model needed to replace the current default-user flow and support comment ownership/deletion safely.
- 2026-04-08 15:42 CST: implemented backend auth/session foundations with `user_sessions`, cookie-based auth routes (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/dev-bootstrap`), PBKDF2 password hashing, and current-user resolution with development fallback.
- 2026-04-08 15:42 CST: replaced document/comment/template/space default-user route wiring with current-user-aware dependencies, updated template/document creation ownership paths, and aligned SQL bootstrap schema with the new `user_sessions` table.
- 2026-04-08 15:42 CST: added backend auth API coverage (`apps/api/tests/test_auth_api.py`) and browser-side auth session bootstrap in `apps/web/app/layout.tsx` so the browser can establish a same-origin session without a dedicated login page yet.
- 2026-04-08 15:42 CST: automated checks completed after auth rollout: `apps/api .venv/bin/pytest -q` => 13 passed; `apps/web npm run build` => passed.
- 2026-04-08 16:20 CST: added organization read/manage APIs for current organization, members, organization creation, invitations, and member updates; added `organization_invitations` schema/model and backend coverage for session listing/revocation and organization management.
- 2026-04-08 16:20 CST: added frontend user pages and shell integration: `/login`, `/register`, sidebar current-user card with logout, team-space organization/member overview, organization management panel, and session list display.
- 2026-04-08 16:20 CST: added comment deletion through authenticated ownership checks and surfaced comment delete actions in the right-hand comment sidebar.
- 2026-04-08 16:20 CST: automated checks after organization/user UI rollout: `apps/api .venv/bin/pytest -q` => 16 passed; `apps/web npm run build` => passed.
- 2026-04-08 16:52 CST: unified destructive confirmations across the current UI surface: document deletion, block/image deletion, comment deletion, and session revoke/exit now all require explicit confirmation before executing.
- 2026-04-08 16:52 CST: fixed the comment sidebar delete-confirmation wiring by moving the nested comment delete trigger to an explicit callback instead of a missing local setter reference.
- 2026-04-08 16:52 CST: automated checks after destructive-action confirmation rollout: `apps/api .venv/bin/pytest -q` => 18 passed; `apps/web npm run build` => passed.
- 2026-04-08 17:06 CST: added resolved-thread folding in the right comment sidebar, with automatic expansion when the active thread is already resolved.
- 2026-04-08 17:06 CST: changed comment-thread ordering to follow document position (`block_id + start_offset`) instead of raw creation time so the sidebar matches reading order.
- 2026-04-08 17:06 CST: added lightweight `@成员` autocomplete in new-comment and reply composers, backed by real organization members on the document page.
- 2026-04-08 17:06 CST: automated checks after comment-sidebar improvements: `apps/api .venv/bin/pytest -q` => 18 passed; `apps/web npm run build` => passed.
 - 2026-04-09 09:41 CST: fixed notification/comment/document deletion cleanup ordering so comment thread removal clears dependent notifications before deleting comments and threads, eliminating foreign-key failures in comment-delete and notification tests.
 - 2026-04-09 09:41 CST: extended test cleanup for document fixtures to delete comment notifications, comments, and threads before removing the document record.
 - 2026-04-09 09:41 CST: completed the notification UX loop so opening a notification marks it as read before navigating to the target document thread.
 - 2026-04-09 09:41 CST: automated checks after notification cleanup and read-on-open flow: `apps/api .venv/bin/pytest -q` => 19 passed; `apps/web npm run build` => passed.
 - 2026-04-09 15:48 CST: implemented the document permission and sharing flow from `document-permission-sharing-prd.md`, including backend `visibility` handling, share-link state/password/expiry management, and a dedicated `/share/[token]` route that reuses the same document page surface in forced read-only mode.
 - 2026-04-09 15:48 CST: refactored backend document detail construction into a shared helper so normal document access, deleted-document access, and share-token access all reuse the same payload builder without diverging capability flags.
 - 2026-04-09 15:48 CST: added the frontend permission/share dialog with visibility toggles, share enable/disable, expiry, password, rotate-link, and copy-link controls, and wired `DocumentPage` to capability flags (`canEdit`, `canManage`, `canComment`, `isSharedView`) instead of static buttons.
 - 2026-04-09 15:48 CST: added backend coverage for anonymous public access and password-protected share access; updated API tests to bootstrap an authenticated default session explicitly now that document read routes no longer rely on development fallback.
 - 2026-04-09 15:48 CST: restarted local frontend/backend services onto the latest code and verified runtime smoke checks for `3100`, `8000`, and `/share/[token]`.
 - 2026-04-09 15:48 CST: automated checks after the permissions/sharing rollout: `apps/api .venv/bin/pytest -q` => 21 passed; `apps/web npm run build` => passed.
 - 2026-04-09 16:03 CST: added explicit backend coverage for share-link rotation, disabled-share responses, and expired-share responses, and aligned successful password verification with access-count / last-access tracking.
 - 2026-04-09 16:03 CST: final automated checks after the full permissions/sharing implementation: `apps/api .venv/bin/pytest -q` => 22 passed; `apps/web npm run build` => passed.
 - 2026-04-10 09:34 CST: added `clouddoc-mcp-design.md`, defining a phased MCP integration plan for CloudDoc covering read-only tools, controlled write tools, service-token auth, permission reuse, audit logging, and knowledge-workflow evolution.
 - 2026-04-10 09:34 CST: automated checks after MCP design documentation update: `apps/api .venv/bin/pytest -q` => 22 passed; `apps/web npm run build` => passed.
2026-04-10 09:43 CST: added document-folder-hierarchy-prd.md to define folder-based hierarchy using existing documents.parent_id and a new folder document_type, including migration of existing root documents into /newdoc per space.
2026-04-10 09:50 CST: upgraded document-folder-hierarchy-prd.md to a folder-separate architecture: new folders table, documents.folder_id, root-folder migration strategy, and a unified tree API for long-term cloud-drive evolution.
2026-04-10 18:02 CST: implemented the folder hierarchy backend: added `folders` model/schema/service/routes, `documents.folder_id`, runtime schema upgrades, root/tree/ancestors APIs, folder creation/rename/delete/move flows, and automatic `/newdoc` migration for existing root-level documents in each space.
2026-04-10 18:02 CST: implemented the folder hierarchy frontend: added `/documents` tree workspace, `/folders/[folderId]` folder page, folder CRUD and document move actions, root/folder tree browsing, and dynamic breadcrumb paths on document detail pages using folder ancestors.
2026-04-10 18:02 CST: restarted local services onto the latest folder-hierarchy build, verified runtime responses for `/api/spaces/{space_id}/root-children`, `/api/spaces/{space_id}/tree`, `/documents`, `/folders/[folderId]`, and `/docs/[docId]`, and cleaned historical `pytest-*` folders/documents from the development database.
2026-04-10 18:02 CST: automated checks after the full folder-hierarchy implementation: `apps/api .venv/bin/pytest -q` => 26 passed; `apps/web npm run build` => passed.
2026-04-10 18:14 CST: completed folder hierarchy Phase 4 enhancements: added `documents.sort_order`, folder move, bulk move, sibling reorder APIs, folder visibility update with recursive descendant inheritance, and document/PDF visibility inheritance on create or move into folders.
2026-04-10 18:14 CST: upgraded the folder workspace UI with drag-and-drop tree moves, current-directory drag reorder, batch move for mixed folder/document selection, and folder visibility controls.
2026-04-10 18:14 CST: ran runtime verification for move/reorder/visibility inheritance against the live backend, then cleaned the temporary `runtime-*` folders/documents from the development database.
2026-04-10 18:14 CST: automated checks after folder hierarchy Phase 4: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-10 18:20 CST: added collapsible folder tree behavior to the `/documents` left navigation so every folder level can be expanded or collapsed independently without leaving the unified tree view.
2026-04-10 18:18 CST: tightened the `/documents` workspace layout by removing the centered max-width wrapper, widening the left tree panel, and letting the main content area fill the window so the page sits closer to the left edge with less wasted whitespace.
2026-04-10 18:18 CST: automated checks after the `/documents` layout tightening: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 10:25 CST: implemented CloudDoc MCP Phase 1 as a read-only stdio MCP package under `apps/mcp`, exposing document list/search/detail, comments, spaces, and shared-document reads through the existing backend service layer.
2026-04-13 10:25 CST: added MCP bridge tests and documentation updates for installation, actor identity, and the read-only tool set; installed the MCP package into the local API virtualenv and verified `FastMCP` server construction.
2026-04-13 10:25 CST: automated checks after MCP Phase 1: `apps/mcp` bridge tests => 3 passed; `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 10:25 CST: implemented CloudDoc MCP Phase 2 controlled write tools for document creation, content updates, comment creation/replies, and document favorites, while keeping delete-class MCP tools unavailable.
2026-04-13 10:25 CST: added `mcp_audit_logs` runtime schema/model support and write-tool audit logging for success and error outcomes.
2026-04-13 10:25 CST: automated checks after MCP Phase 2: `apps/mcp` bridge tests => 4 passed; `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 10:33 CST: upgraded the `/spaces` page from placeholder copy to a real space directory overview, showing each accessible space with its folder/document tree and direct links into `/documents`, folders, and documents.
2026-04-13 10:33 CST: automated checks after `/spaces` directory overview: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 10:36 CST: fixed document outline anchor targets by adding stable DOM ids to block containers, so the left page directory can navigate to heading blocks reliably.
2026-04-13 10:36 CST: automated checks after outline anchor fix: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 10:59 CST: fixed MCP default actor resolution so missing `CLOUDDOC_MCP_ACTOR_EMAIL` uses the built-in `guest@clouddoc.local` user with no organization membership or document grants, instead of falling back to the first enabled user.
2026-04-13 10:59 CST: updated MCP tests and docs to make privileged tool calls pass an explicit user email and added regression coverage that the default guest cannot read private documents.
2026-04-13 10:59 CST: automated checks after MCP guest actor fix: `apps/mcp` bridge tests => 5 passed; `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 11:01 CST: final validation after cleanup: `apps/mcp` bridge tests => 5 passed; `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 11:02 CST: tightened the MCP guest bootstrap to clear any historical organization memberships or direct document grants for `guest@clouddoc.local`, preserving the no-permission default actor contract.
2026-04-13 11:02 CST: automated checks after guest grant cleanup: `apps/mcp` bridge tests => 5 passed; `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 12:13 CST: switched CloudDoc MCP from stdio-default startup to Streamable HTTP default startup at `http://127.0.0.1:8010/mcp`, with env/CLI controls for transport, host, port, path, stateless mode, and JSON responses.
2026-04-13 12:13 CST: added MCP server configuration tests, updated MCP docs and `.env.example`, ignored generated Python egg-info metadata, and made Ctrl-C shutdown exit without a traceback.
2026-04-13 12:13 CST: automated checks after Streamable HTTP MCP switch: `apps/mcp` tests => 7 passed; `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; runtime Streamable HTTP initialize request to `/mcp` => HTTP 200.
2026-04-13 12:19 CST: expanded MCP into controlled CRUD by adding actor-owned document delete/restore and actor-owned comment update/delete tools, while filtering ordinary document read/list/search/comment access to actor-owned documents only.
2026-04-13 12:19 CST: added MCP ownership-boundary tests so public documents owned by another user are still blocked from ordinary MCP document tools, and comment update/delete can only target comments authored by the actor.
2026-04-13 12:19 CST: automated checks after controlled MCP CRUD expansion: `apps/mcp` tests => 8 passed; `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; runtime Streamable HTTP `tools/list` confirmed the new CRUD tools are registered.
2026-04-13 12:36 CST: extended the same owner-only document/comment permission boundary to ordinary REST APIs by making document view/edit/manage/comment checks require the current user to be the document owner/creator, and making comment deletion author-only.
2026-04-13 12:36 CST: updated API tests so normal public document URLs no longer allow anonymous read access, cross-user document comments are rejected even with legacy edit permissions, and share-token routes remain the explicit read-only external access path.
2026-04-13 12:36 CST: automated checks after REST API permission tightening: `apps/mcp` tests => 8 passed; `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 12:36 CST: documented in README that ordinary REST API and ordinary MCP tools now both use owner/creator-only document access, with external read-only access routed through share links.
2026-04-13 15:46 CST: adjusted MCP document read scope so list/search/detail can read actor-owned documents plus public documents, with `folder_id` filtering for list/search, while document update/delete and comment mutation remain actor-owned only.
2026-04-13 15:46 CST: added MCP regression coverage for public read access, private document denial, folder-filtered listing, and non-owner update/delete rejection.
2026-04-13 15:46 CST: automated checks after MCP read-scope adjustment: `apps/mcp` tests => 8 passed; `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed.
2026-04-13 15:54 CST: updated README MCP permission notes to document public document reads, `folder_id` list/search filtering, and owner-only write/delete boundaries.
2026-04-13 16:28 CST: added document-level undo/redo support in the editor draft layer, covering title edits and block-tree changes such as text edits, type changes, paste splitting, image alignment, deletion, duplication, and drag reordering.
2026-04-13 16:28 CST: added editor toolbar controls for 撤销/重做 plus keyboard shortcuts `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`, and `Ctrl+Y`, while keeping autosave bound to the restored draft state.
2026-04-13 16:28 CST: automated checks after undo/redo implementation: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed. Browser CLI smoke was attempted, but the Playwright CLI wrapper stalled during package/session startup, so validation used build/type checks plus backend tests.
2026-04-13 17:00 CST: restarted the local Next dev server after `next build` invalidated dev chunks in `.next`; verified `/documents` and `/docs/9b075ee5-0bdf-42cc-8e13-3964941ccae4` both return HTTP 200 on port 3100.
2026-04-13 17:03 CST: changed the link block toolbar from an in-flow row to a floating top-right overlay inside the link block, so link blocks no longer add an extra toolbar line to the document layout.
2026-04-13 17:03 CST: automated checks after link toolbar overlay adjustment: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; restarted local Next dev server and verified `/documents` plus `/docs/9b075ee5-0bdf-42cc-8e13-3964941ccae4` return HTTP 200 on port 3100.
2026-04-13 17:34 CST: fixed the extra blank/raw-text row below link cards by hiding the unified text surface for populated link blocks and removing the link preview wrapper margin; empty link blocks still show the input placeholder.
2026-04-13 17:34 CST: automated checks after link extra-row fix: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; restarted local Next dev server and verified `/documents` plus `/docs/9b075ee5-0bdf-42cc-8e13-3964941ccae4` return HTTP 200 on port 3100.
2026-04-13 17:38 CST: added immediate outside-click dismissal for editor floating windows while preserving delayed pointer-leave dismissal; this covers block action menus, slash menus, link block overlay toolbars, link view menus, and comment selection toolbars.
2026-04-13 17:38 CST: automated checks after floating-window dismissal update: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; restarted local Next dev server and verified `/documents` plus `/docs/9b075ee5-0bdf-42cc-8e13-3964941ccae4` return HTTP 200 on port 3100.
2026-04-13 17:40 CST: simplified the link block `链接视图` presentation to browser-like inline blue underlined text, removing the previous white card background, border, icon, and extra vertical padding.
2026-04-13 17:40 CST: automated checks after link-view compaction: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; restarted local Next dev server and verified `/documents` plus `/docs/9b075ee5-0bdf-42cc-8e13-3964941ccae4` return HTTP 200 on port 3100.
2026-04-13 17:43 CST: added heading-level indentation to the document page outline so H1-H6 entries show clearer hierarchy while preserving anchor navigation.
2026-04-13 17:43 CST: automated checks after outline indentation: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; restarted local Next dev server and verified `/documents` plus `/docs/9b075ee5-0bdf-42cc-8e13-3964941ccae4` return HTTP 200 on port 3100.
2026-04-13 17:46 CST: strengthened in-document H1-H6 visual hierarchy by widening heading font-size/weight/color differences and adding level-specific vertical padding in the unified text block surface.
2026-04-13 17:46 CST: automated checks after heading hierarchy update: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; restarted local Next dev server and verified `/documents` plus `/docs/9b075ee5-0bdf-42cc-8e13-3964941ccae4` return HTTP 200 on port 3100.
