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
2026-04-13 17:54 CST: made the document page outline sticky with its own viewport-height scroll area, so the left outline no longer scrolls away with the document body.
2026-04-13 17:54 CST: fixed outline anchor navigation by making outline ids prefer persisted `block_id`, saving heading anchors as block ids, and adding `id="intro"` to the title surface for the top document-title outline entry.
2026-04-13 17:54 CST: automated checks after sticky outline and anchor fix: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; restarted local Next dev server and verified `/documents` plus `/docs/9b075ee5-0bdf-42cc-8e13-3964941ccae4` return HTTP 200 on port 3100.
2026-04-13 18:08 CST: changed outline navigation from default hash jumps to intercepted smooth scrolling with `scrollIntoView({ behavior: "smooth" })` while still updating the URL hash for shareable anchors.
2026-04-13 18:08 CST: automated checks after smooth outline navigation: `apps/api .venv/bin/pytest -q` => 28 passed; `apps/web npm run build` => passed; restarted local Next dev server and verified `/documents` plus `/docs/9b075ee5-0bdf-42cc-8e13-3964941ccae4` return HTTP 200 on port 3100.
2026-04-14 00:00 CST: fixed the private-document original-link bypass by disabling implicit development default-user fallback for normal auth dependencies and making `/api/auth/me` non-bootstrap by default; explicit demo bootstrap remains available through `/api/auth/me?bootstrap=true` and `/api/auth/dev-bootstrap`.
2026-04-14 00:00 CST: updated the web auth probe to avoid creating a demo session automatically and added regression coverage that probing `/api/auth/me` without bootstrap does not unlock a leaked private document URL.
2026-04-14 00:00 CST: automated checks after auth bootstrap hardening: `apps/api .venv/bin/pytest -q` => 30 passed; `apps/web npm run build` => passed.
2026-04-14 00:00 CST: restarted local API and web dev servers after the build; runtime check confirmed `/api/auth/me` returns `null` without setting `clouddoc_session`, the leaked private document URL returns 404 without bootstrap, and explicit `/api/auth/me?bootstrap=true` still enables demo access for development.
2026-04-15 00:00 CST: documented the MCP/API boundary refactor target: MCP remains an independent protocol service, REST and MCP share API service/domain code, permissions centralize in `permission_service.py`, and REST/MCP identities normalize through `ActorContext`.
2026-04-15 00:00 CST: added `ActorContext` and `permission_service.py`, migrated document/folder permission wrappers to delegate to the centralized permission service, and added MCP-specific document list/search/detail service functions.
2026-04-15 00:00 CST: added the `clouddoc.create_folder` MCP tool with write audit coverage, updated MCP docs/README, and added MCP bridge regression coverage for folder creation.
2026-04-15 00:00 CST: used the Streamable HTTP MCP service to create a `clouddoc` root folder under the demo product space, created category folders, and imported 15 root-level project Markdown documents as CloudDoc documents.
2026-04-15 00:00 CST: automated checks after MCP folder import and permission refactor: `apps/api .venv/bin/pytest -q` => 30 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 9 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-15 00:00 CST: restarted local API and web dev servers; verified `/documents` returns HTTP 200, `/api/auth/me` returns `null` without bootstrap, and MCP `clouddoc.get_document` can read the imported `CloudDoc MCP 接入设计文档`.
2026-04-15 00:00 CST: created a local `已归档` folder and moved the project design/research Markdown documents that were already imported into CloudDoc online docs; kept root `README.md` and `DEVELOPMENT_PROGRESS.md` in place for repository onboarding and development history, and updated README archive links.
2026-04-15 11:39 CST: added system-admin visibility support with `users.is_super_admin`; system admins can read/search/list all active documents, while document edit/delete/comment mutation remains owner/creator-only.
2026-04-15 11:39 CST: extended organization-admin visibility for team-space private documents through the centralized permission service, while keeping organization admins read-only for documents they do not own.
2026-04-15 11:39 CST: added REST and MCP regression coverage for admin read-only access, including list/detail/search visibility and update/delete rejection; fixed test user cleanup to remove user folders before deleting spaces.
2026-04-15 11:39 CST: automated checks after admin visibility implementation: `apps/api .venv/bin/pytest -q` => 32 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 10 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-15 11:44 CST: added repository-level `AGENTS.md` collaboration rules requiring all future project document revisions to be synchronized between local files and the online CloudDoc platform; synchronized the same rule into the online `CloudDoc 项目协作规则` document (`5e232bf1-ee60-42c5-94a4-5fc997956915`).
2026-04-15 11:50 CST: updated local PRD/UI/content-model docs to mark historical version query, preview, diff, manual named versions, and restore as deferred requirements; current scope keeps only version data model and autosave snapshot preparation. Synchronized the same changes to online CloudDoc documents `在线云文档产品设计文档` (`14119fb3-0c76-42d6-bb80-b2c7a3622d9a`), `云文档功能设计与 UI 设计详细文档` (`348e059b-7456-4898-b508-6056f9c7418f`), and `CloudDoc 内容模型与版本管理设计` (`89ae5813-c1ec-48ab-b1b3-ac30bc02b7ef`).
2026-04-15 11:57 CST: optimized MCP document reading for external AI clients by adding `format=markdown|plain_text|content_json|full` to `clouddoc.get_document`, defaulting to Markdown for AI reading while preserving `content_json` for precise block editing. Added MCP markdown conversion coverage; checks: `apps/mcp ../api/.venv/bin/pytest -q` => 11 passed; `apps/api .venv/bin/pytest -q` => 32 passed; `apps/web npm run build` => passed.
2026-04-15 11:57 CST: updated local README and MCP design docs with the new MCP read formats and synchronized them to online CloudDoc documents `CloudDoc` (`672c8bc1-2272-4834-8d0f-7ede79d232e5`) and `CloudDoc MCP 接入设计文档` (`0110cd53-5d5c-453e-9da4-2990e457a604`).
2026-04-15 15:52 CST: implemented left folder-tree drag and drop for moving documents/folders into a target folder and reordering nodes before/after siblings, reusing existing move and reorder APIs. Synchronized the folder hierarchy PRD to online CloudDoc document `文档文件夹层级 PRD` (`31527c12-5acf-4ddc-9762-22123076327b`). Checks: `apps/api .venv/bin/pytest -q` => 32 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 11 passed; `apps/web npm run build` => passed.
2026-04-15 16:06 CST: updated collaboration rules so all future online CloudDoc document syncs use the existing top-level `clouddoc` folder (`6c5bdd27-95c3-426d-93dc-d9e03739ab9a`) as the fixed root; new classification folders may only be created under that folder. Synchronized and moved the online `CloudDoc 项目协作规则` document (`5e232bf1-ee60-42c5-94a4-5fc997956915`) into the `clouddoc` folder.
2026-04-15 16:08 CST: moved the previously synchronized folder hierarchy PRD document (`31527c12-5acf-4ddc-9762-22123076327b`) out of product-space `newdoc` and into `clouddoc / 产品需求`; verified the product-space `newdoc` folder no longer contains project docs. Updated and synchronized collaboration rules to require migrating any historical project docs found under `newdoc` back into `clouddoc` classifications.
2026-04-15 16:10 CST: fixed left folder-tree row alignment by giving toggle, icon, and title fixed grid columns and consistent child indentation, so folder/document icons and text align across nested levels. Checks: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q` => 32 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 11 passed; `git diff --check` => passed.
2026-04-15 16:24 CST: fixed folder-child reorder isolation. The reorder API now rejects partial/cross-parent reorder payloads instead of silently skipping mismatched nodes, and folder/document children render through a shared mixed-node sort so one folder's ordering cannot accidentally appear to affect another folder. Added regression coverage for same-parent reorder isolation and cross-parent rejection. Checks: `apps/api .venv/bin/pytest -q` => 33 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 11 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-15 17:58 CST: added a document-tree open-mode preference on the folder workspace. Users can choose whether documents opened from the left file tree open in the current page or a new browser tab/window; the preference is stored in browser localStorage and applies immediately to tree document links. Checks: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q` => 33 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 11 passed; `git diff --check` => passed.
2026-04-15 18:04 CST: moved personal document-tree open-mode preference from browser localStorage into backend user preferences. Added `user_preferences` persistence, `/api/preferences/me` get/update endpoints, a `/settings` personal configuration page, sidebar navigation entry, and wired folder tree document links to the saved backend preference. Checks: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q` => 34 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 11 passed; `git diff --check` => passed.
2026-04-16 16:21 CST: added the `CloudDoc LLM Wiki 产品需求文档` PRD locally at `已归档/llm-wiki-prd.md` and synchronized it to online CloudDoc document `70c62cc8-c3bf-4bec-8206-f788bba8a7e6` under `clouddoc / 产品需求`. The PRD defines how to introduce Karpathy's LLM Wiki methodology into CloudDoc, including raw sources, wiki pages, schema/index/log, ingest/query/lint/compile workflows, data model extensions, MCP tools, permissions, phases, risks, and acceptance criteria. Checks: `git diff --check` => passed; online document fetch verified title, folder, and content.
2026-04-16 17:05 CST: updated the `CloudDoc LLM Wiki 产品需求文档` PRD with the product integration model: per-user AI Provider configuration, encrypted personal API keys, LLM Wiki workspace entities, explicit authorized read scopes, workspace output `llm-wiki` folders, run records, and stricter AI permission boundaries. Synchronized the update to online CloudDoc document `70c62cc8-c3bf-4bec-8206-f788bba8a7e6`. Checks: `git diff --check` => passed; online document update returned the expected document ID, title, and expanded content length.
2026-04-16 17:07 CST: fixed document deletion navigation. Deleting a document no longer forces navigation to the dashboard; it now returns to browser history previous page, with fallback to the document's parent folder or space document list when no history is available. Checks: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q` => 34 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 11 passed; `git diff --check` => passed.
2026-04-16 17:16 CST: researched Feishu/Lark cloud-document permission capabilities and upgraded the local `文档权限与分享专项需求文档` PRD into a Feishu-inspired permission roadmap covering permission members, document-level permission settings, link sharing scope, external access, comments, copy/export/download/print controls, owner transfer, audit logs, REST/MCP permission unification, UI tabs, APIs, phases, and tests. Synchronized the PRD to online CloudDoc document `3e439bbe-f46d-414c-8151-68d8b6781810` under `clouddoc / 产品需求`.
2026-04-16 17:47 CST: added the `CloudDoc 文档库事件流 SSE 产品需求文档` PRD locally at `已归档/document-library-event-stream-prd.md` and synchronized it to online CloudDoc document `8d1c104b-b3fa-481d-b27f-26230b2d08fe` under `clouddoc / 产品需求`. The PRD defines a non-collaborative SSE event stream for document library, folder tree, list, comment, notification, and permission-change awareness with local UI updates instead of full page reloads.
2026-04-17 09:53 CST: implemented the first development pass for the document permission/sharing PRD. Added document permission settings, permission audit logs, collaborator CRUD/batch APIs, owner transfer API, unified capability fields, permission-change SSE events, a five-tab permission/share dialog, owner-transfer UI, and capability-driven delete/share controls. Updated local `已归档/document-permission-sharing-prd.md` with implementation status.
2026-04-17 09:53 CST: implemented the first development pass for the document library SSE PRD. Added `GET /api/events/stream`, in-memory event bus, `event_logs`, heartbeat/connection-ready events, document/folder/comment/notification/permission event publishing, folder-workspace local event updates, document-page external-update notices, and real-time notification badge/list updates. Updated local `已归档/document-library-event-stream-prd.md` with implementation status.
2026-04-17 09:53 CST: automated checks after permission and SSE implementation: `apps/api .venv/bin/pytest -q` => 37 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 11 passed; `apps/web npm run build` => passed. Added backend regression coverage for notification SSE event persistence and target-user filtering.
2026-04-17 09:53 CST: synchronized the updated local permission PRD, SSE PRD, and development progress log to online CloudDoc documents `3e439bbe-f46d-414c-8151-68d8b6781810`, `8d1c104b-b3fa-481d-b27f-26230b2d08fe`, and `631d841f-25d8-4093-a1f5-46c985b6e506` under the existing `clouddoc` document tree.
2026-04-17 10:18 CST: fixed SSE follow-up behavior for document deletion across dashboard-style pages. Home, recent, favorites, and trash document lists now maintain client-side live state and subscribe to document SSE events so deleted documents are removed from active lists and inserted into trash without a manual refresh. Verification: `apps/web npm run build` with Node v20.20.2 => passed; targeted API SSE tests => 2 passed; `git diff --check` => passed; restarted local 3100 dev server after build cache cleanup and verified `/`, `/documents`, `/trash`, and `/api/auth/me?bootstrap=false` all return HTTP 200.
2026-04-17 10:31 CST: restored local 3100/8000 services and fixed a space-permission regression that made `/documents` show `apiUnavailable=true` when an unauthenticated page selected an inaccessible organization space. `list_spaces` now filters spaces through the unified permission service and includes public spaces for authenticated users. Added regression coverage for anonymous/user space visibility. Verification: targeted API folder/space tests => 10 passed; `apps/web npm run build` with Node v20.20.2 => passed; restarted the 3100 dev server after `.next` cleanup; verified `/`, `/documents`, `/docs/dafb5382-769a-4225-b9e1-d1489009a005`, and `/api/auth/me?bootstrap=false` return HTTP 200.
2026-04-17 10:41 CST: fixed page-freeze risk on initial system open by stopping unauthenticated SSE connection attempts. Dashboard, recent, favorites, trash, and notifications now only start document-library SSE when a current user exists; public read-only document pages no longer start SSE unless the user has edit/comment/manage capabilities. All EventSource consumers now close the stream on errors to avoid browser auto-reconnect loops after 401 or temporary backend failures. Verification: `apps/web npm run build` with Node v20.20.2 => passed; `git diff --check` => passed; restarted 3100 after `.next` cleanup; Playwright opened `http://127.0.0.1:3100/` and confirmed no `/api/events/stream` console errors, then 3100 CPU returned to 0%.
2026-04-17 11:12 CST: confirmed backend slowdowns were caused by the SSE implementation, not by SSE capability itself. The old `/api/events/stream` loop used `asyncio.to_thread(subscriber.get, True, 25)` for every subscriber, which held Starlette/FastAPI threadpool workers for long periods and competed with sync REST handlers. Reworked the event bus to use per-subscriber `asyncio.Queue` plus `loop.call_soon_threadsafe(...)`, and changed the stream route to `await asyncio.wait_for(subscriber.get(), timeout=25)` so SSE no longer occupies the worker pool. Also hardened startup by skipping invalid `space/owner` pairs when ensuring default `newdoc` folders, preventing a foreign-key crash on reload. Verification: targeted API tests => 3 passed; `GET /api/documents?state=active` dropped from ~0.53s observed before the fix to ~0.31-0.35s after the fix; `GET /api/spaces` stays ~0.015-0.021s; backend restarted successfully and `/health` returns 200.
2026-04-17 12:05 CST: fixed the second backend slowdown/root-lock path. `list_space_root_children` and `get_space_tree` no longer run `ensure_default_newdoc_folders()` on every read request, and tree rendering now resolves actor/space/document permissions in batch instead of issuing per-node permission queries. Measured service-layer tree cost for the current product space dropped from ~243/255 SQL statements and ~1.48s/1.39s to 6 SQL statements and ~0.20s/~0.19s for root-children/tree.
2026-04-17 12:05 CST: fixed the remaining SSE database leak. `/api/events/stream` no longer authenticates through a long-lived dependency-held SQLAlchemy session; it now resolves the current user in a short explicit session and closes the transaction before starting the stream, eliminating PostgreSQL `idle in transaction` sessions from EventSource connections.
2026-04-17 12:05 CST: fixed startup/runtime schema lock amplification by removing the duplicate `ensure_runtime_schema()` call from FastAPI lifespan and changing runtime schema checks to inspect existing columns before issuing `ALTER TABLE` statements. This prevents every API restart/test startup from taking relation locks on `users` and `documents` when the columns already exist.
2026-04-17 12:05 CST: automated verification after API/tree/SSE lock fixes: `apps/api .venv/bin/pytest -q` => 39 passed; targeted API regression tests => 5 passed; `apps/web npm run build` with Node v20.20.2 => passed; `git diff --check` => passed. Runtime checks: `/health` => 200 in ~0.001s, `/` => 200 in ~0.447s, `/documents` => 200 in ~0.034s, browser CLI opened `http://127.0.0.1:3100/documents`, and an authenticated 3-second SSE probe left 0 PostgreSQL `idle in transaction` sessions from this host.
2026-04-17 12:05 CST: synchronized this development-progress update to online CloudDoc document `631d841f-25d8-4093-a1f5-46c985b6e506`.
2026-04-17 12:18 CST: completed the first collaborator search UI pass in the document permission dialog. The collaborators tab now searches current organization members by name, email, or user ID, supports click-to-select before adding permissions, renders readable member identity for existing collaborators, and uses the same searchable member picker for owner transfer.
2026-04-17 12:18 CST: updated the local permission/share PRD (`已归档/document-permission-sharing-prd.md`) to mark collaborator search as completed and keep batch-add/export-download-print/external-share hardening as remaining work.
2026-04-17 12:18 CST: automated verification after collaborator search UI: `apps/web npm run build` with Node v20.20.2 => passed; `apps/api .venv/bin/pytest -q` => 39 passed; `git diff --check` => passed.
2026-04-17 14:51 CST: added front-end and back-end duplicate-submission protection for backend-interactive buttons. The shared web `apiFetch` now treats POST/PUT/PATCH/DELETE as guarded mutations, auto-generates `X-CloudDoc-Submission-Key`, and blocks the same in-flight mutation request. The API now rejects concurrent duplicate mutation submissions with the same session, path, method, and submission key using an in-process TTL guard.
2026-04-17 14:51 CST: added loading/disabled protection to high-frequency backend write buttons in the folder workspace and permission/share dialog, including create document/folder, upload PDF, move/bulk move, delete folder confirmation, collaborator add/update/delete, owner transfer, and share-link save/rotate/disable actions.
2026-04-17 14:51 CST: automated verification after duplicate-submission protection: targeted API duplicate-submission tests => 2 passed; `apps/api .venv/bin/pytest -q` => 40 passed; `apps/web npm run build` with Node v20.20.2 => passed; `git diff --check` => passed.
2026-04-17 15:00 CST: added explicit creation-location confirmation for new documents. Folder workspace and global sidebar creation now open a modal with a default location, existing-folder selection, and a "create new folder then create document" path so documents are not silently created in the wrong place. The folder workspace now disables create/upload actions when no writable space is available. Updated local UI and folder hierarchy docs and synchronized them to online CloudDoc documents `云文档功能设计与 UI 设计详细文档` (`348e059b-7456-4898-b508-6056f9c7418f`), `文档层级与文件夹专项 PRD` (`31527c12-5acf-4ddc-9762-22123076327b`), and this progress document (`631d841f-25d8-4093-a1f5-46c985b6e506`). Verification: browser automation confirmed the global create modal exposes space, title, existing-folder, and new-folder location choices; unauthenticated/no-space folder workspace buttons are disabled; `apps/api .venv/bin/pytest -q` => 40 passed; `apps/web npm run build` with Node v20.20.2 => passed; `git diff --check` => passed.
2026-04-17 16:03 CST: fixed cross-tab document deletion awareness. Document detail pages now listen for `document.deleted` and automatically leave the deleted document, while folder workspace/dashboard lists also subscribe to a same-origin browser broadcast fallback. Deleting a document through one tab publishes a `BroadcastChannel`/`localStorage` event so other Chrome tabs remove or leave the deleted document even if SSE is temporarily disconnected or throttled. Updated and synchronized the SSE PRD with the deletion fallback behavior.
2026-04-17 16:11 CST: completed a first visual-density pass across the web UI. Added a global no-rounded-corners baseline, moved the color palette from warm sand to professional cool gray/blue, weakened panel shadows, narrowed the fixed sidebar, compacted dashboard/search/settings/folder workspace containers, and widened main work areas. Updated the UI design document with the new visual style baseline.
2026-04-17 18:33 CST: fixed the folder-click regression in the folder workspace. The left tree no longer nests the expand/collapse button inside a navigation link, and folder/document links now stop click propagation and disable link dragging so surrounding draggable rows do not intercept normal navigation. Browser automation verified clicking folders from both the left tree and the current-directory list navigates to `/folders/:id`. Verification: `apps/api .venv/bin/pytest -q` => 40 passed; `apps/web npm run build` with Node v20.20.2 => passed; `git diff --check` => passed.
2026-04-17 18:33 CST: synchronized this development-progress update to online CloudDoc document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the same online document after update and confirmed content length.
2026-04-20 09:37 CST: adjusted the folder workspace layout so the left document tree and the right workspace content scroll independently inside the viewport. The workspace root now uses a fixed viewport-height overflow boundary, the document tree has its own vertical scroll container, and the right content section has its own vertical scroll container. Verification: browser automation confirmed body height stays at viewport height, the left tree scroller is `overflow-y:auto` with scrollable content, and the right section is independently scrollable; `apps/api .venv/bin/pytest -q` => 40 passed; `apps/web npm run build` with Node v20.20.2 => passed after clearing stale `.next`; `git diff --check` => passed.
2026-04-20 09:53 CST: added the local `CloudDoc AI 接入与开放平台 PRD` at `已归档/ai-integration-open-platform-prd.md`. The PRD defines the path from the current MCP/Markdown-read MVP to a Notion-like external AI integration platform, covering Personal Access Token, Integration Token, authorization scopes, MCP enhancements, REST Open API, Markdown write support, webhook events, audit logs, data model, phases, tests, risks, and acceptance criteria.
2026-04-20 09:53 CST: synchronized the AI integration open-platform PRD to online CloudDoc document `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` under `clouddoc / 技术架构与 MCP`, and updated the README document index with the new local PRD link.
2026-04-20 10:46 CST: investigated and fixed slow backend document-list responses. Root cause: `/api/documents` executed N+1 permission queries, returning 34 documents with 169 SQL statements, including 136 repeated `document_permission_settings` queries. Optimized `list_documents` to batch load spaces, organization memberships, document permissions, and permission settings, reducing service-layer cost to 6 SQL statements and about 0.04s. HTTP `/api/documents` dropped from about 0.90s authenticated to about 0.13-0.16s. Added regression coverage to keep the document list query count bounded. Verification: `apps/api .venv/bin/pytest -q` => 41 passed; `git diff --check` => passed.
2026-04-20 11:05 CST: fixed SSE delivery through the 3100 web server. Root cause: the generic Next.js rewrite proxy for `/api/:path*` buffered or stalled `text/event-stream`, so direct `8000/api/events/stream` received `document.deleted` immediately while `3100/api/events/stream` did not even deliver `connection.ready`. Added a dedicated Next route handler at `/api/events/stream` that forwards cookies and streams the backend SSE body directly with `text/event-stream`, `no-transform`, and `X-Accel-Buffering: no`. Verification: authenticated 3100 SSE probe received `connection.ready` and `document.deleted` immediately after deletion; `apps/web npm run build` with Node v20.20.2 => passed; targeted API SSE test => passed; `git diff --check` => passed.
2026-04-20 11:05 CST: synchronized the SSE PRD proxy-streaming update to online CloudDoc document `8d1c104b-b3fa-481d-b27f-26230b2d08fe` and synchronized this progress log to online CloudDoc document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents and confirmed the 3100 SSE proxy fix text is present.
2026-04-20 12:15 CST: started implementing the `CloudDoc AI 接入与开放平台 PRD`. First pass added Integration/PAT data models and runtime schema, token hash authentication, token/integration/scope management APIs, `/api/open/*` document/search/folder endpoints, Markdown-to-block conversion, token-scoped Integration permission checks, basic token rate limiting, integration audit logs, MCP Markdown create/update tools, MCP token authentication for document list/detail, and a personal-settings “AI 与开放接入” UI section. Verification: `apps/api .venv/bin/pytest -q` => 43 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 12 passed; `apps/web npm run build` => passed; `git diff --check` => passed. Updated the local AI integration PRD implementation status; remaining work includes full Web scope picker, document permission Integration tab, webhook delivery, OAuth flow, and Embedding/RAG integration.
2026-04-20 12:15 CST: synchronized the updated AI integration PRD to online CloudDoc document `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and synchronized this progress update to online CloudDoc document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both documents and confirmed the implementation-status text is present.
2026-04-20 12:35 CST: extended the personal-settings AI access UI with Integration authorization-scope management. Users can load spaces and folder trees, choose public documents, a space, a folder, or a document, assign view/edit permission, add the scope, and remove existing scopes. Verification: `apps/web npm run build` => passed.
2026-04-20 12:35 CST: synchronized the AI integration PRD and development-progress update to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and `631d841f-25d8-4093-a1f5-46c985b6e506`.
2026-04-20 13:02 CST: added document-level Integration visibility to the permission/share dialog. The API now exposes `/api/documents/{document_id}/integrations`, resolving whether each owned Integration can access the current document through public-document scope, direct document scope, space scope, or folder-derived scope, and includes write capability plus recent successful access time from integration audit logs. The Web permission dialog now shows an “开放接入” tab with this data so owners can inspect AI/app reachability without leaving the document page. Verification: `apps/api .venv/bin/pytest -q` => 43 passed; `apps/mcp ../api/.venv/bin/pytest -q` => 12 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 13:02 CST: synchronized the AI integration PRD and development-progress update to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents after update and confirmed the new “开放接入” dialog text exists.
2026-04-20 13:21 CST: added the first open-platform audit-log UI in personal settings. Users can now select a Token or Integration and load recent audit entries, including source, operation, target, status, timestamp, IP, and error message. Verification: `apps/api .venv/bin/pytest -q` => 43 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 13:38 CST: implemented Integration Webhook endpoint management. Added backend webhook create/list/update/delete APIs with supported-event validation and one-time secret return, plus settings-page UI for creating endpoint URLs, showing the one-time secret, enabling/disabling endpoints, and confirmed-delete removal. Added regression coverage for webhook CRUD. Verification: `apps/api .venv/bin/pytest -q` => 44 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 13:38 CST: synchronized the AI integration PRD and development-progress update to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents after update and confirmed the webhook-management text exists.
2026-04-20 14:05 CST: implemented the first Webhook delivery chain. Added `secret_value` runtime storage for signing, fixed the `fastapi.Request` vs `urllib.request.Request` name collision that previously caused every delivery attempt to fail before network I/O, added `deliver_webhook_event()` and event-triggered delivery dispatch from the central event publisher, and exposed `/api/integrations/{integration_id}/webhooks/{webhook_id}/deliveries` for delivery-log queries. The settings page now supports loading per-webhook delivery logs. Verification: targeted webhook delivery regression => passed; `apps/api .venv/bin/pytest -q` => 45 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 14:05 CST: synchronized the AI integration PRD and development-progress update to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents after update and confirmed the webhook-delivery text exists.
2026-04-20 14:18 CST: added manual webhook replay. The API now exposes `POST /api/integrations/{integration_id}/webhooks/{webhook_id}/deliveries/{delivery_id}/retry`, which replays a single logged delivery as a fresh outbound request and creates a new delivery record. The settings page now provides a “重放” action on each webhook delivery row. Verification: `apps/api .venv/bin/pytest -q` => 45 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 14:18 CST: synchronized the AI integration PRD and development-progress update to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents after update and confirmed the webhook-replay text exists.
2026-04-20 16:12 CST: fixed the `/documents` page runtime 500 in local Next.js development. Root cause: the current Node process exposes a server-side `globalThis.localStorage` object without `getItem`, causing Next's development overlay to crash during SSR with `localStorage.getItem is not a function`. Added a server-only normalization shim in the web root layout that hides this invalid server-side localStorage shape while leaving browser `window.localStorage` untouched. Restarted local API and web dev servers; verified `http://127.0.0.1:8000/health` returns 200 and `http://127.0.0.1:3100/documents` returns 200. Verification: `apps/api uv run pytest -q` => 45 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 16:16 CST: fixed the follow-up unstyled `/documents` page caused by a stale/corrupted Next.js incremental cache. After the localStorage fix, the dev server still had `.next/server/webpack-runtime.js` referencing missing chunks such as `./243.js`, so CSS/JS static resource requests returned 500 and the browser rendered plain HTML. Stopped the web dev server, cleared `apps/web/.next`, restarted port 3100, and verified the real `/documents` HTML-referenced resources all return 200, including layout CSS, webpack/main chunks, app layout chunk, documents page chunk, polyfills, and icon SVG.
2026-04-20 16:29 CST: compacted the left folder/document tree layout. Reduced the tree sidebar width from 360px to 320px, tightened node vertical spacing, row padding, icon size, nested indentation, and space header spacing so the document tree shows more entries with less blank space. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; restarted the 3100 dev server after clearing `.next` and verified `/documents` plus all real HTML-referenced CSS/JS/icon resources return 200.
2026-04-20 16:43 CST: updated the folder hierarchy PRD with a Feishu-inspired left document-tree context menu improvement plan. The new section defines hover `...` and right-click menu entry points, compact menu visual rules, document/PDF/folder menu items, permission and disabled-state behavior, delete confirmation requirements, duplicate/move/rename/favorite/pin/shortcut/ownership actions, backend/data-model extensions, SSE synchronization, component split, accessibility, acceptance criteria, and automated test coverage. Synchronized the updated PRD and this progress entry to online CloudDoc documents `文档层级与文件夹专项 PRD` (`31527c12-5acf-4ddc-9762-22123076327b`) and `DEVELOPMENT_PROGRESS` (`631d841f-25d8-4093-a1f5-46c985b6e506`).
2026-04-20 16:53 CST: implemented the first version of the left document-tree more-actions menu. Folder/document tree nodes now support hover `⋯` and right-click context menu entry points, with copy-link, move, rename, delete-confirm, open-in-new-tab, and document favorite actions. The tree menu uses permission-aware disabled states and keeps non-implemented future actions such as duplicate and pin as disabled placeholders. Added `PATCH /api/documents/{doc_id}` for document rename and a regression test for owner rename. Improved the `⋯` button visibility with a bordered white button and blue active/hover state. Verification: `apps/api uv run pytest -q` => 46 passed; `apps/web npm run build` => passed; `git diff --check` => passed; restarted 3100 after clearing `.next` and verified `/documents` plus all real HTML-referenced CSS/JS/icon resources return 200.
2026-04-20 17:15 CST: continued the document-tree menu implementation. Added real document duplicate support through `POST /api/documents/{doc_id}/duplicate`, copying the source document metadata and latest content snapshot into the same folder as a new owner-created document. Added user-scoped tree pinning with `user_tree_pins`, `/api/folders/pins` pin/unpin endpoints, `is_pinned` tree payloads, and pinned-first sorting in folder trees and current-folder children. The Web menu now enables "创建副本" for documents and toggles "添加到置顶 / 取消置顶" for folders and documents. Added API regression coverage for duplicate and pin/unpin. Verification: `apps/api uv run pytest -q` => 48 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 17:22 CST: synchronized the folder hierarchy PRD implementation-status update and this development-progress update to online CloudDoc documents `31527c12-5acf-4ddc-9762-22123076327b` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents after update and confirmed the expected implementation-status/progress text is present. The API process had stale long-lived local connections before sync, so it was restarted and `/health` was verified before the sync.
2026-04-20 17:39 CST: completed folder favorites for the left document-tree menu. Added the `folder_favorites` data model and runtime schema, `POST/DELETE /api/folders/{folder_id}/favorite`, `GET /api/folders/favorites`, tree `is_favorited` payloads for folders and documents, menu-level favorite/unfavorite support for folders and documents, and a favorites page section for favorite folders. Updated the folder hierarchy PRD implementation status. Verification: `apps/api uv run pytest -q` => 49 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 17:41 CST: synchronized the folder hierarchy PRD and this development-progress update to online CloudDoc documents `31527c12-5acf-4ddc-9762-22123076327b` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents and confirmed the folder-favorite implementation text is present.
2026-04-20 17:55 CST: linked the document-tree context menu to the existing permission/share dialog. Document menu actions now open the unified dialog directly on the share-link, collaborators/owner-transfer, or security/settings tab, so share, transfer-owner, and security/classification entry points no longer require navigating into the document first. The documents and folder pages now pass organization members into the tree workspace for owner-transfer candidate selection. Verification: `apps/api uv run pytest -q` => 49 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 17:57 CST: synchronized the folder hierarchy PRD and this development-progress update to online CloudDoc documents `31527c12-5acf-4ddc-9762-22123076327b` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents and confirmed the document-tree share/owner/security entry text is present.
2026-04-20 18:08 CST: added the backend tree-menu action summary endpoint. `GET /api/folders/actions/{node_type}/{node_id}` now returns server-side executable-action booleans for document and folder nodes, including open, share, copy link, duplicate, move, shortcut placeholder, pin, favorite, transfer owner, rename, security settings, delete, and non-empty-folder delete-disabled reason. Added regression coverage for document/folder action summaries. Verification: `apps/api uv run pytest -q` => 50 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 18:10 CST: synchronized the folder hierarchy PRD and this development-progress update to online CloudDoc documents `31527c12-5acf-4ddc-9762-22123076327b` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents and confirmed the tree-menu action-summary text is present.
2026-04-20 18:22 CST: improved left document-tree keyboard accessibility. Tree nodes are now focusable treeitems; Enter opens the node, ArrowRight expands folders, ArrowLeft collapses folders, and ContextMenu/Shift+F10 opens the same context menu as right-click/hover actions. Fixed a TypeScript event-type conflict between React keyboard events and native `document.addEventListener` keyboard events. Verification: `apps/api uv run pytest -q` => 50 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 18:24 CST: synchronized the folder hierarchy PRD and this development-progress update to online CloudDoc documents `31527c12-5acf-4ddc-9762-22123076327b` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents and confirmed the keyboard-accessibility text is present.
2026-04-20 18:55 CST: implemented the first shortcut-node workflow for the document tree. Added `tree_shortcuts` runtime schema/model, shortcut create/delete APIs, shortcut nodes in folder children and full space trees, shortcut action summaries, shortcut open/copy/delete behavior in the Web tree, and an “添加快捷方式到” modal. Shortcuts point to the original document/folder and deleting a shortcut does not delete the target. Drag/reorder is intentionally disabled for shortcut nodes in this first pass to avoid mixing shortcut ordering with physical folder/document ordering. Verification: `apps/api uv run pytest -q` => 51 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 18:57 CST: synchronized the folder hierarchy PRD and this development-progress update to online CloudDoc documents `31527c12-5acf-4ddc-9762-22123076327b` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents and confirmed the shortcut-node workflow text is present.
2026-04-20 19:04 CST: added the first folder classification entry from the tree menu. Folder nodes now expose “设置密级”, reusing the folder rename dialog to maintain the folder private/public visibility setting alongside the title. This keeps the current folder visibility model consistent without introducing a separate folder-share-link system yet. Verification: `apps/api uv run pytest -q` => 51 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-20 19:06 CST: synchronized the folder hierarchy PRD and this development-progress update to online CloudDoc documents `31527c12-5acf-4ddc-9762-22123076327b` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both online documents and confirmed the folder-classification entry text is present.
2026-04-20 20:11 CST: completed the open-platform webhook retry worker. Added API lifecycle background polling with configurable retry interval/attempt limit, extracted reusable webhook-attempt logic, and implemented automatic retry scheduling with `1 / 5 / 15` minute backoff plus final-state stop conditions for max-attempt, disabled webhook, and disabled integration. Verification: `apps/api uv run pytest tests/test_integrations_api.py -q` => 5 passed; `apps/api uv run pytest -q` => 52 passed.
2026-04-20 20:26 CST: improved the personal-settings open-platform management UX. Audit logs now support backend and frontend filtering by source, response status, target type, and free-text query; the Integration scope picker now supports client-side resource search; audit rows now show serialized request summaries for debugging. Verification: `apps/api uv run pytest tests/test_integrations_api.py -q` => 5 passed; `apps/web npm run build` => passed.
2026-04-20 20:49 CST: implemented OAuth Phase 1 backend. Integrations can now store OAuth redirect URIs and a rotated one-time client secret; the API now supports `PATCH /api/integrations/{id}/oauth-config`, `POST /api/oauth/authorize`, `POST /api/oauth/token` for both authorization-code and refresh-token grants, and `POST /api/oauth/revoke`. Added runtime schema for authorization codes and refresh tokens, and verified the full auth-code -> access token/refresh token -> refresh -> revoke chain. Verification: `apps/api uv run pytest tests/test_integrations_api.py -q` => 6 passed; `apps/api uv run pytest -q` => 53 passed; `apps/web npm run build` => passed.
2026-04-20 21:18 CST: completed the next MCP enhancement batch from the AI integration PRD. Added `clouddoc.append_document_markdown`, `clouddoc.list_folders`, `clouddoc.get_folder_tree`, `clouddoc.get_integration_context`, and `clouddoc.list_authorized_scopes`, and let `clouddoc.search_documents` accept `mcp_token`. Also fixed MCP token resolution precedence so explicit `user_email` is not overridden by `CLOUDDOC_MCP_TOKEN`. Verification: `apps/api uv run pytest -q` => 53 passed; `apps/mcp ../api/.venv/bin/pytest tests/test_mcp_bridge.py tests/test_mcp_server.py -q` => 13 passed; `apps/web npm run build` => passed. Note: running `apps/api` and `apps/mcp` test suites in parallel hit a PostgreSQL DDL deadlock inside `ensure_runtime_schema`; sequential verification is required for now.
2026-04-20 21:29 CST: synchronized the updated AI integration PRD, MCP design document, README, and development-progress log to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c`, `0110cd53-5d5c-453e-9da4-2990e457a604`, `672c8bc1-2272-4834-8d0f-7ede79d232e5`, and `631d841f-25d8-4093-a1f5-46c985b6e506`. Verification fetched all four online documents after update and confirmed titles plus non-zero plain-text lengths.
2026-04-21 10:22 CST: completed the OAuth Phase 1 web surface. Personal Settings now lets owners enable OAuth per Integration, edit redirect URIs, and rotate one-time client secrets. Added `GET /api/oauth/clients/{client_id}` so the frontend can render OAuth client metadata, and shipped a working `/oauth/authorize` page that displays application name, requested scopes, and supports allow/deny redirect handling. Verification: `apps/api uv run pytest tests/test_integrations_api.py -q` => 6 passed; `apps/web npm run build` => passed; `git diff --check` => pending after doc sync.
2026-04-21 10:29 CST: synchronized the updated AI integration PRD, README, and development-progress log to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c`, `672c8bc1-2272-4834-8d0f-7ede79d232e5`, and `631d841f-25d8-4093-a1f5-46c985b6e506`. Verification fetched the online documents after update and confirmed plain-text lengths `4692`, `3652`, and `92941`.
2026-04-21 10:37 CST: fixed the Integration authorization-history restore problem in Personal Settings. The “AI 与开放接入” section now auto-hydrates tokens, integrations, scopes, webhooks, and scope-target trees on page entry, and persists the last selected Integration in local storage so a refresh no longer makes existing授权范围 appear empty. Verification: `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-21 10:39 CST: synchronized the AI integration PRD and development-progress update for authorization-history restore to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and `631d841f-25d8-4093-a1f5-46c985b6e506`. Verification fetched both online documents after update and confirmed plain-text lengths `4692` and `93734`.
2026-04-21 10:46 CST: fixed the authorization-history overflow issue in Personal Settings. The Integration scope history list now shows a count, uses a fixed-height scroll container, wraps long resource IDs, and keeps the remove button stable even when history is long. Verification: `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-21 10:47 CST: synchronized the AI integration PRD and development-progress update for authorization-history overflow handling to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and `631d841f-25d8-4093-a1f5-46c985b6e506`. Verification fetched both online documents after update and confirmed plain-text lengths `4692` and `94429`.
2026-04-21 11:01 CST: refined the Integration authorization-history UX. The settings page now shows only the latest 5 scope entries and links to a dedicated history page at `/settings/integrations/{integrationId}/scopes`. Scope summaries now include `resource_title` from the backend, so the detail page can search by resource name, and the history page supports keyword filtering plus incremental “加载更多” rendering. Verification: `apps/api uv run pytest tests/test_integrations_api.py -q` => 6 passed; `apps/web npm run build` => passed; `git diff --check` => pending after doc sync.
2026-04-21 11:03 CST: synchronized the AI integration PRD and development-progress update for the scope-history detail page to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and `631d841f-25d8-4093-a1f5-46c985b6e506`. Verification fetched both online documents after update and confirmed plain-text lengths `4692` and `95368`.
2026-04-21 11:16 CST: compacted the top-level “AI 与开放接入” overview. The Personal Access Token and Integration sections now show only the most recent 5 items on the settings page and link to dedicated detail pages at `/settings/open-access/tokens` and `/settings/open-access/integrations`, each with keyword search and incremental “加载更多” rendering. Verification: `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-21 11:18 CST: synchronized the AI integration PRD and development-progress update for the compact open-access overview to online CloudDoc documents `72e02fd1-ee06-4a32-a231-b70bf6c8c45c` and `631d841f-25d8-4093-a1f5-46c985b6e506`. Verification fetched both online documents after update and confirmed plain-text lengths `4692` and `96140`.
2026-04-21 11:24 CST: adjusted the settings-page action wording. The three entry buttons in “AI 与开放接入” now use “查看更多” instead of “查看详情” to better match the summary-to-list navigation pattern. Verification: `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-21 14:05 CST: implemented the first DOCX import workflow. Added `POST /api/documents/import-docx`, a standard-library DOCX parser that converts `.docx` headings, paragraphs, and basic ordered/bullet lists into CloudDoc block JSON, document creation with permission/folder validation and SSE creation events, Web API binding, and upload/import entries in both the global sidebar create modal and folder workspace toolbar. Updated README, product PRD, and UI design documentation with the supported scope and current limitations. Verification: targeted DOCX import API test => passed; `apps/api .venv/bin/pytest -q` => 54 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-21 14:06 CST: synchronized the DOCX import documentation updates to online CloudDoc documents `CloudDoc` (`672c8bc1-2272-4834-8d0f-7ede79d232e5`), `在线云文档产品设计文档` (`14119fb3-0c76-42d6-bb80-b2c7a3622d9a`), `云文档功能设计与 UI 设计详细文档` (`348e059b-7456-4898-b508-6056f9c7418f`), and this progress document (`631d841f-25d8-4093-a1f5-46c985b6e506`). Verification fetched the online documents after update and confirmed non-zero plain-text lengths.
2026-04-21 14:55 CST: optimized the new-document/upload-import modal UI. The global sidebar creation modal now uses a compact two-zone layout with location/title settings on the left and document-type cards for DOC/PDF/DOCX on the right; the folder workspace upload/import modal now uses two compact PDF/DOCX cards. This removes the previous narrow, vertically long form shown on the documents page. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; Playwright logged in as the demo user, opened the modal, and captured `output/playwright/create-document-modal-optimized.png`; 3100 was restarted after clearing `.next` because running `next build` while the dev server was active invalidated dev chunks.
2026-04-21 17:46 CST: improved document-tree expand/collapse visuals. Folder rows now rotate the disclosure arrow with a short transition, and child subtrees use CSS grid-row, opacity, and slight translate transitions so opening/closing folders no longer jumps instantly. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; restarted 3100 after clearing `.next` and verified `/documents` returns 200.
2026-04-21 18:20 CST: fixed DOCX import content loss for Word tables. The importer now walks `word/document.xml` body children in order instead of only direct paragraphs, preserves title/subtitle blocks, keeps text bullets/numbered items, and converts Word tables into editable monospaced table code blocks so table content and row/column relationships are not dropped. Verified the parser against the reported source file `/Users/yys235/Downloads/feishu_flowchart_whiteboard_prd.docx`; the parsed content now includes the first metadata table and later comparison/planning tables. The previously reported imported document `2ee422b2-f604-46ac-a884-8811137770bb` is currently marked deleted in the database, so it was not restored or overwritten. Verification: targeted DOCX import API test => passed; source-file parser check confirmed `7` table blocks and table text such as `文档版本`, `输出日期`, `能力层`, and `飞书现状` present in plain text; `apps/api .venv/bin/pytest -q` => 54 passed; `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-21 18:21 CST: synchronized the DOCX import fidelity documentation updates to online CloudDoc documents `CloudDoc` (`672c8bc1-2272-4834-8d0f-7ede79d232e5`), `在线云文档产品设计文档` (`14119fb3-0c76-42d6-bb80-b2c7a3622d9a`), `云文档功能设计与 UI 设计详细文档` (`348e059b-7456-4898-b508-6056f9c7418f`), and this progress document (`631d841f-25d8-4093-a1f5-46c985b6e506`). Verification fetched the online documents after update and confirmed plain-text lengths `3804`, `2150`, `2201`, and `100111`.
2026-04-21 18:29 CST: fixed document-tree space switching behavior. Folder expansion state is now stored per space in browser local storage instead of being reset by every tree refresh, and the tree uses the current space's server tree while live SSE state catches up to avoid cross-space expansion-state races. Added a short fade/slide animation when the active space tree mounts. Verification: Playwright collapsed `newdoc` in one space, switched to another space, switched back, and confirmed `aria-expanded=false` persisted with `clouddoc:folder-tree:expanded:v1`; `apps/web npm run build` => passed.
2026-04-21 18:38 CST: corrected document-tree expansion persistence semantics. The previous implementation could write an empty expansion list during the same render cycle as a space switch, causing a space to reopen as fully collapsed instead of restoring its prior state. Persistence now happens with the computed next expansion state, and explicit folder toggles persist only valid folder IDs for the active space. Verification: Playwright cleared tree expansion storage, opened the product space and confirmed its `8` folders defaulted expanded, collapsed `newdoc` in another space, switched between spaces, and confirmed product remained expanded while `newdoc` stayed collapsed; `apps/web npm run build` => passed.
2026-04-21 19:28 CST: completed deep research PRD for Feishu Docs board/whiteboard capability. Added local document `已归档/feishu-board-whiteboard-prd.md`, covering the research plan, source confidence levels, Feishu Docs board positioning, interface and feature decomposition, and three iterative CloudDoc PRD versions: V1 document-embedded basic board, V2 professional flowchart/review board, and V3 real-time collaboration plus AI/API board. Sources include Feishu official cloud-doc capability material and public Feishu board ecosystem references. Verification: local document created with structured V1/V2/V3 scope and acceptance criteria.
2026-04-21 19:30 CST: synchronized the Feishu board/whiteboard research PRD to online CloudDoc under the existing top-level `clouddoc` folder. Online document ID: `42c15e58-20e6-437e-8e67-53945bff5cf8`. Verification fetched the online document after update and confirmed plain-text length `3063`.
2026-04-21 19:48 CST: completed a second Feishu Docs board/whiteboard research pass focused on page style and feature planning. Extended `已归档/feishu-board-whiteboard-prd.md` with five improved PRD versions: V1 document-embedded board preview block, V2 basic flowchart editor, V3 compact professional board workspace, V4 review collaboration and presentation mode, and V5 AI generation/template marketplace/open API. The update emphasizes visual layout, toolbar density, hover states, object panels, comment sidebar, presentation mode, AI panel, and feature acceptance criteria. Verification: local PRD updated with a V1-V5 priority matrix and UI decision section.
2026-04-22 09:28 CST: created a scoped V1 PRD for standalone basic board functionality at `已归档/basic-board-v1-prd.md`. This version explicitly excludes collaboration and embedding boards inside ordinary documents. The PRD defines `document_type = board`, document-library/file-tree entry points, `/docs/{id}` type-based rendering, basic SVG-style board editing, shapes, connectors, autosave, permission handling, API expectations, test plan, milestones, and acceptance criteria. Verification: local PRD created and scope reviewed against the requested constraints.
2026-04-22 09:30 CST: synchronized the standalone basic board V1 PRD to online CloudDoc under the existing top-level `clouddoc` folder. Online document ID: `509728b0-b9d5-4e42-8bb3-d33570500f35`. Verification fetched the online document after update and confirmed plain-text length `3347`.
2026-04-22 10:14 CST: implemented standalone basic board V1. The API now supports `document_type = board`, creates default board JSON content, returns board content through existing document detail APIs, and validates board payloads on content update. The Web app now routes board documents through a dedicated board editor on `/docs/{id}`, adds board creation to the global and folder workspace create modals, displays board entries in the tree/list, and supports text/rectangle/round-rectangle/ellipse/diamond nodes, node movement, connectors, pan, zoom, undo/redo, color properties, object deletion, autosave, manual save, and permission-aware read-only mode.
2026-04-22 10:14 CST: automated verification for basic board V1: `apps/api .venv/bin/pytest -q` => 55 passed; targeted board document API test => passed; `apps/web npm run build` => passed; Playwright authenticated as the demo user, created a board from `/documents`, placed a rectangle and text node on the canvas, saved, reloaded the page, and confirmed both board nodes persisted. During verification the 3100 dev server was restarted after clearing `.next` because running `next build` while Next dev was active invalidated development chunks.
2026-04-22 10:15 CST: synchronized the basic board implementation documentation updates to online CloudDoc documents `CloudDoc` (`672c8bc1-2272-4834-8d0f-7ede79d232e5`), `CloudDoc 基础画板 V1 PRD` (`509728b0-b9d5-4e42-8bb3-d33570500f35`), and this progress document (`631d841f-25d8-4093-a1f5-46c985b6e506`). Verification fetched the online documents after update and confirmed plain-text lengths `3928`, `3390`, and `105586`.
2026-04-22 10:21 CST: tightened the board content update validator so board documents require a valid board JSON envelope, viewport, node list, connector list, legal node types, numeric positions/sizes, and connector endpoints that reference existing nodes. Verification after this validator pass: `apps/api .venv/bin/pytest -q` => 55 passed; `apps/web npm run build` => passed; `git diff --check` => passed; local services restored with `/health` => 200 and `http://127.0.0.1:3100/documents` => 200.
2026-04-22 14:06 CST: analyzed the user-provided Feishu Docs board usage video `/Volumes/ForBackUp/飞书文档-画板-演示视频.mp4` and created `已归档/feishu-board-video-improvement-prd.md`. The PRD captures visible Feishu board style/function details including the lightweight top bar, fixed left icon toolbar, dotted infinite canvas, compact shape palette, selected-object floating toolbar, anchor-based connectors, line/arrow menus, inline text editing, color palette, object more menu, current CloudDoc gaps, phased implementation plan, acceptance criteria, and automated test plan.
2026-04-22 14:08 CST: synchronized `已归档/feishu-board-video-improvement-prd.md` to online CloudDoc under `clouddoc / 产品需求`. Online document ID: `d93ced04-a331-4d09-b656-65875c918028`. Verification queried the online document after sync and confirmed it exists in the target folder.
2026-04-22 18:01 CST: implemented the first Feishu-style board improvement pass from `已归档/feishu-board-video-improvement-prd.md`. The board editor now uses a lightweight top bar, left icon toolbar, dotted canvas, compact shape palette, selected-object floating toolbar, inline multi-line object text editing, resize handles, shape/style/color menus, copy/cut/paste/duplicate/layer/delete actions, and expanded shape types including cylinder, triangle, star, arrow, parallelogram, hexagon, and plus. Board connectors now use node-anchor endpoints with straight/orthogonal routing, arrow, dashed-line, width, and color settings; backend board validation accepts the new node and connector schema while rejecting invalid references.
2026-04-22 18:01 CST: automated verification for the Feishu-style board pass: Playwright created a board, added rectangle and ellipse nodes, connected them, saved, reloaded, and confirmed `connectorsBeforeSave = 1` and `connectorsAfterReload = 1`; `apps/api .venv/bin/pytest -q` => 55 passed; `apps/web npm run build` => passed. After build, the 3100 dev server was restored by clearing `apps/web/.next`; `http://127.0.0.1:3100/documents` returns 200 and `http://127.0.0.1:8000/health` returns `{"status":"ok"}`.
2026-04-22 18:03 CST: cleaned up 6 temporary board documents created by the connector automation whose titles started with `pytest-board-connector-` or `debug-board-`; no user-created documents or folders were touched.
2026-04-22 18:18 CST: reworked the board editor UI to more closely replicate the Feishu board video. The board page now uses a full-window canvas workbench, separate floating top-left document/tab bar and top-right action bar, a narrow floating left icon toolbar, sparse gray dotted background, compact shape-library popover, thin selected-object toolbar, compact color/line/more popovers, and Feishu-like blue/gray active states. Fixed a UI layering bug where the selected-object toolbar intercepted clicks on the shape palette. Verification: Playwright created a board, added rectangle and rounded-rectangle nodes, connected them, captured `output/playwright/feishu-board-ui-pass.png`, and confirmed `nodes = 2` and `connectors = 1`; `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q` => 55 passed; local 3100 and 8000 services returned 200/healthy. Cleaned up 2 temporary `feishu-ui-board-` automation documents after testing.
2026-04-22 18:31 CST: refined the Feishu-style board menus and iconography. Replaced Unicode glyphs in the left toolbar, top action bar, shape palette, selected-object toolbar, and shape menu with a consistent inline SVG line-icon system. The shape palette now renders real line previews for rectangle, ellipse, diamond, rounded rectangle, cylinder, arrow, parallelogram, hexagon, triangle, star, and plus. Verification: `apps/web npm run build` => passed; Playwright opened a new board, expanded the shape palette, captured `output/playwright/feishu-board-icons-menu.png`, and confirmed SVG icons render in both the toolbar and shape menu. Cleaned up 1 temporary `feishu-icons-board-` automation document after testing.
2026-04-22 18:47 CST: improved board hover ergonomics and left-toolbar clarity. Root cause of the previous “虚” visual feeling was weak icon stroke weight, weak border/shadow contrast, too many per-button separator lines, and click-only behavior for menus that Feishu exposes on hover. Updated the left board toolbar with stronger icon stroke, darker icon color, clearer grouped separators, and slightly stronger card contrast. Added hover-open and delayed-close behavior for the shape palette and selected-object submenus so common actions no longer require explicit clicks. Verification: `apps/web npm run build` => passed; Playwright confirmed hover on the shape tool opens the shape palette and hover on a selected object toolbar button opens its submenu, with screenshot `output/playwright/feishu-hover-review.png`; cleaned up 1 temporary `feishu-hover-board-` automation document after testing.
2026-04-22 18:56 CST: reshaped the board left sidebar to more closely match the Feishu screenshot. Replaced the generic semantic icon stack with a Feishu-like visual order including two colorful top icons and a longer vertical tool stack, moved undo/redo from the sidebar into the top action bar, and aligned the top-left document pills to the same colorful icon style. Verification: `apps/web npm run build` => passed; Playwright captured `output/playwright/feishu-sidebar-match.png` and confirmed the sidebar renders 13 SVG icons with the updated top action buttons; cleaned up 1 temporary `feishu-sidebar-match-` automation document after testing.
2026-04-22 19:15 CST: tightened the board sidebar against the second Feishu sidebar video. Based on the user's clarification, removed decorative colored sidebar icons and every unsupported placeholder tool so the board sidebar now exposes only real features: select, shape, text, connector, and pan. Also removed the previously added colorful icons from the top-left board header, replacing them with plain document/board semantics. Verification: `apps/web npm run build` => passed; Playwright captured `output/playwright/feishu-sidebar-final.png` and confirmed the sidebar now renders exactly 5 buttons with titles `选择`, `图形`, `文本`, `连接线`, `拖动画布`; cleaned up 1 temporary `feishu-sidebar-final-` automation document after testing.
2026-04-22 19:36 CST: refined the board sidebar density and icon geometry against the second Feishu sidebar video. Kept the 5 real tools only, but rebuilt their SVG paths to better match the video’s cursor, rectangle, text, bent-connector, and hand silhouettes; narrowed the floating toolbar card, reduced button height and icon size, softened the active state from a large blue tile into a smaller Feishu-style light-blue chip, and tightened the group separator spacing and border/shadow treatment. Verification: `apps/web npm run build` => passed; restarted the 3100 dev server after build by removing `apps/web/.next` and relaunching `next dev`; Playwright logged in with the demo account, opened board document `d3bac9d0-a7f9-4720-9f66-31c63bbb1f3c`, and captured `output/playwright/feishu-sidebar-refined.png`; `http://127.0.0.1:3100/documents` returns 200 and `http://127.0.0.1:8000/health` returns `{"status":"ok"}`.
2026-04-22 19:40 CST: synced the updated board sidebar progress and PRD documents to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` and `已归档/feishu-board-video-improvement-prd.md`. Verification: direct backend update completed for online documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `d93ced04-a331-4d09-b656-65875c918028`, and both returned the expected titles after writeback.
2026-04-23 09:52 CST: implemented the board-editor changes from video `20260423091420.mp4`. The board shape tool is now a flowchart-oriented entry, the shape palette was rebuilt into a compact 5-column flowchart library, and board node support was extended with `predefined_process`, `trapezoid`, `document`, `comment_bubble`, `cloud`, and `left_arrow`. New flowchart nodes now use centered `输入文本` placeholder text, type-specific default sizes, and immediate post-insert selection. The selected-object toolbar was rebuilt into a near-object toolbar with shape replace, fill, stroke, text color, font size, text-style placeholder, comment placeholder, and more actions; toolbar positioning now prefers below the object and flips above when space is limited. Text editing remains in-place on double click, with editing and static states sharing the same visual basis and wrapped text no longer truncated to a fixed small line count. Backend board validation was updated to accept the new node types.
2026-04-23 09:52 CST: verification for the `20260423091420` board pass completed. `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; `apps/api .venv/bin/pytest -q` => 55 passed; `git diff --check` => passed. Playwright created a temporary board document, opened the shape palette, inserted a `预定义流程` node, changed fill color to green, changed font size to `18`, saved, reloaded, and confirmed the object persisted. Evidence screenshot: `output/playwright/board-video-20260423091420-implementation.png`.
2026-04-23 09:55 CST: synchronized the board-video implementation updates to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` -> `631d841f-25d8-4093-a1f5-46c985b6e506`, `已归档/feishu-board-video-improvement-prd.md` -> `d93ced04-a331-4d09-b656-65875c918028`. Verification: direct backend writeback completed for both documents and returned the expected document titles after update.
2026-04-23 10:08 CST: analyzed the connector-editing video `/Volumes/ForBackUp/20260423095531_rec_.mp4` and created a dedicated local PRD `已归档/board-connector-editing-improvement-prd.md`. The new PRD focuses only on the UI and operation logic visible in the video: connector object state machine, anchor-driven creation, connector-only floating toolbar, routing modes, waypoint editing, rounded orthogonal paths, static/selected visual separation, persistence requirements, and browser/API test coverage.
2026-04-23 10:10 CST: synchronized the new connector-editing PRD to online CloudDoc under `clouddoc / 产品需求`. Online document ID: `490e0113-76d5-404d-bbe5-2e3c9342d34d`. Verification: backend create-or-update completed successfully and returned the expected title `CloudDoc 画板连接线编辑专项改进 PRD`.
2026-04-23 11:15 CST: implemented the first connector-editing PRD pass. The board connector model now supports `routingMode` (`straight`, `orthogonal`, `polyline`, `rounded-orthogonal`), persisted `waypoints`, and `style.cornerRadius`, while still normalizing legacy `routing` data. Connector rendering now separates static and selected visual states, uses connector-specific route points, supports rounded orthogonal paths, renders selected connector control points, and exposes draggable internal segment handles. Connector creation now auto-selects the newly created connector. The selected-connector toolbar was rebuilt as a dedicated near-object toolbar with route label, path settings, stroke color, connector text placeholder, and more menu; the path settings panel supports route mode switching, line width, dash toggle, start/end arrow toggles, and rounded-corner radius options. Backend board validation now rejects invalid connector route modes, malformed waypoints, invalid arrow fields, invalid dash fields, and invalid corner-radius values.
2026-04-23 11:18 CST: verified the connector-editing implementation. `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; `apps/api .venv/bin/pytest -q` => 55 passed; `git diff --check` => passed. Restored local services after the production build by clearing `apps/web/.next` and restarting Next dev on 3100 plus uvicorn on 8000; `http://127.0.0.1:3100/documents` returns 200 and `/health` returns ok. Playwright opened a temporary `pytest-connector-editor-*` board, selected the connector, opened the path panel, switched to rounded orthogonal routing, saved, and backend verification confirmed `routingMode = rounded-orthogonal` and `cornerRadius = 12`. Evidence screenshot: `output/playwright/connector-editor-rounded-route.png`. The temporary board document was deleted after verification.
2026-04-23 11:20 CST: synchronized the connector-editing implementation records to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` -> `631d841f-25d8-4093-a1f5-46c985b6e506`, `已归档/board-connector-editing-improvement-prd.md` -> `490e0113-76d5-404d-bbe5-2e3c9342d34d`. Verification: direct backend writeback completed for both documents and returned the expected document titles.
2026-04-23 11:35 CST: continued development from `board-connector-editing-improvement-prd.md` and completed the stage C/D connector-control pass. Selected connectors now show explicit start/end control points, intermediate waypoint points are directly draggable, internal segment handles remain draggable, and connector creation now highlights target anchors on hover while snapping the preview line to the hovered anchor. Backend validation now requires object connector endpoints to include explicit anchors and rejects missing-anchor or nonexistent-target-node connectors. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; `apps/api .venv/bin/pytest -q` => 55 passed; `git diff --check` => passed. Playwright opened a temporary `pytest-connector-control-*` board, selected a connector, dragged the first intermediate waypoint from `y=240` to `y=270`, saved, and backend verification confirmed persisted `waypoints` changed accordingly. Evidence screenshot: `output/playwright/connector-editor-waypoint-drag.png`. The temporary test board was deleted after verification.
2026-04-23 11:38 CST: synchronized the stage C/D connector-control implementation records to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` -> `631d841f-25d8-4093-a1f5-46c985b6e506`, `已归档/board-connector-editing-improvement-prd.md` -> `490e0113-76d5-404d-bbe5-2e3c9342d34d`. Verification: direct backend writeback completed for both documents and returned the expected document titles.
2026-04-23 12:11 CST: completed the connector endpoint reconnection pass from `board-connector-editing-improvement-prd.md`. Selected connector start/end points can now be dragged to another node anchor; the release handler computes the nearest valid anchor from the pointer coordinate, updates `from` or `to`, and regenerates `waypoints` for the current route mode. Fixed a hit-testing bug where endpoint controls were drawn below nodes and could not be dragged when they overlapped node borders by rendering selected connector controls again as a top-layer overlay. Playwright created a temporary `pytest-connector-endpoint-drag-*` board, dragged the source endpoint from `bottom` to `right`, saved with a real dev-bootstrap login session, and backend verification confirmed `from.anchor = right` and recalculated `waypoints`. Temporary endpoint-drag test boards were soft-deleted after verification.
2026-04-23 12:12 CST: synchronized the connector endpoint reconnection implementation records to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` -> `631d841f-25d8-4093-a1f5-46c985b6e506`, `已归档/board-connector-editing-improvement-prd.md` -> `490e0113-76d5-404d-bbe5-2e3c9342d34d`. Verification: direct backend writeback completed for both documents and returned the expected document titles and non-zero plain-text lengths.
2026-04-23 12:22 CST: cleaned up duplicate connector control rendering introduced by the endpoint overlay fix. Selected connector controls are now rendered only once in the top-layer overlay, preserving the node-overlap hit-testing fix while avoiding visually doubled endpoint/waypoint circles. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; Playwright created `pytest-connector-overlay-cleanup`, selected a connector, confirmed the selected connector renders exactly 5 control circles, dragged the source endpoint to the `right` anchor, saved, and backend verification confirmed `from.anchor = right` with recalculated `waypoints`. The temporary test board was soft-deleted.
2026-04-23 12:31 CST: updated the left board toolbar shape button so it reflects the currently selected shape instead of always showing a fixed default icon. After choosing a shape from the compact palette, the outer toolbar button now immediately displays that shape, matching the expected Feishu-style feedback loop. Verification: `apps/web npm run build` => passed; `git diff --check` => passed.
2026-04-23 12:40 CST: enforced orthogonal connector paths for board documents. Non-straight connector routes now fall back to default orthogonal routing if persisted waypoints would produce diagonal segments, midpoint circles are no longer free-draggable into diagonal paths, and backend board validation now rejects non-straight connectors whose adjacent path points change both `x` and `y`. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q` => 55 passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed when run serially; added a diagonal-waypoint negative case confirming the API returns 400. Note: the board-only and full API suites still cannot be run in parallel because `ensure_runtime_schema` may deadlock on PostgreSQL DDL.
2026-04-23 12:52 CST: strengthened the board left sidebar visual clarity to better match the Feishu reference. Increased the toolbar container width, corner radius, separator length, icon size, and button hit area; also raised border/shadow contrast and active/hover state separation so the five real board tools read larger and sharper against the canvas. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; `http://127.0.0.1:3100/documents` returned 200 and `http://127.0.0.1:8000/health` returned `{"status":"ok"}` after the update.
2026-04-23 15:32 CST: analyzed `/Volumes/ForBackUp/20260423145911_rec_.mp4` and added the local PRD `已归档/board-multi-selection-prd.md`. The PRD narrows this round to marquee box selection, multi-object bounds, top batch toolbar, type-filter dropdown, grouped dragging, batch delete/copy, and compatibility with the existing single-node/single-connector editing model. Synchronized the PRD to online CloudDoc under `clouddoc / 产品需求` as document `7590dc42-dfe5-4a97-8e1c-3f97390aff83`. Verification: backend create-or-update completed successfully and returned the expected title `CloudDoc 画板框选与多选编辑改进 PRD`.
2026-04-23 15:43 CST: implemented the first marquee multi-selection pass for the board editor. The select tool now supports dragging a translucent marquee rectangle on blank canvas, resolves node/connector hit results by rectangle intersection, and upgrades the selection model to support multi-node and multi-connector sets with a current type filter. Multi-select now renders a single aggregate bounds box, hides single-object resize/anchor controls, shows a top batch toolbar with filter / bring-to-front / send-to-back / more actions, supports filtering the active subset by node type or connector, and allows dragging the current active subset as a group while preserving node positions and connector waypoints. Batch delete and duplicate now work against the active multi-selection subset. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; `git diff --check` => passed; browser automation opened a temporary board, marquee-selected 2 nodes and 1 connector, confirmed the multi toolbar and filter menu counts `所有元素3 / 矩形1 / 圆角矩形1 / 连线1`, dragged the selected set, clicked save, and backend verification confirmed persisted node positions moved from `(220,160)/(420,180)` to `(340,230)/(540,250)`. Cleaned up temporary `pytest-board-multi-select` test boards after verification. Sync scope: `DEVELOPMENT_PROGRESS.md` and `已归档/board-multi-selection-prd.md` both updated locally and ready for CloudDoc writeback.
2026-04-23 16:07 CST: refined board dragging ergonomics and sidebar visual weight. The selected-object floating toolbar now hides immediately when a node, resize handle, connector endpoint/segment, anchor drag, or multi-selection bounds drag begins; continuous pointer movement keeps it hidden and it restores after one second of no movement even if the mouse is still held down, while pointer release restores it immediately. Added a direct DOM-level display fallback for the floating toolbar to avoid visible lag from React state batching. Enlarged the left board sidebar container and buttons again, increasing real tool icons from 20px to 24px. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; browser testing confirmed selected toolbar appears after node selection and the temporary drag-hide test board was cleaned up. Restored local 3100 dev service and 8000 API service after verification.
2026-04-23 17:43 CST: fixed board connector arrow/path adaptation during node movement based on the user-provided videos `/Volumes/usbshare1/20260423172937.mp4` and `/Volumes/usbshare1/20260423173217_rec_.mp4`. When a connected node is dragged or resized, related connectors now recompute their source/target anchors from current node center positions and regenerate orthogonal waypoints, so the arrow remains attached to the target node edge and follows the final segment direction. If both endpoint nodes are moved together as part of a multi-selection, existing connector waypoints are translated as a group to preserve the visual route. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; `git diff --check` => passed; browser verification moved a target node from the right of the source to above it and backend verification confirmed connector anchors changed from `right -> left` to `top -> bottom` with regenerated vertical waypoints. Temporary `pytest-board-connector-autofit` test board was cleaned up.
2026-04-23 18:08 CST: corrected the connector adaptation rule after the user clarified that connector anchor points must stay fixed and only the line route should adapt. Node drag/resize now preserves the original `from.anchor` and `to.anchor`, regenerating only orthogonal waypoints from those fixed endpoints; multi-selection movement still translates connector waypoints as a group. Added Feishu-like transient semi-transparent feedback for board shapes during drag, resize, connector creation, and connector endpoint reconnection. This opacity effect is render-only and is not saved into board JSON. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; local services checked healthy with `http://127.0.0.1:3100/documents` => 200 and API `/health` => ok.
2026-04-23 18:39 CST: analyzed the Feishu connector adaptation videos `/Volumes/usbshare1/20260423182400_rec_.mp4` and `/Volumes/usbshare1/20260423183336.mp4`. Reverted the over-aggressive outer-bounding-box connector routing attempt because it caused obvious long detours. Board connector auto-routing now follows the video behavior more closely: keep endpoint anchors fixed, extend a short stub outward from each anchor, then connect the stubs with the shortest axis-aligned near-field path. This preserves orthogonal lines while preventing sudden far-side reroutes during node dragging. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; `git diff --check` => passed; 3100 dev service restored and `/documents` returns 200, API `/health` returns ok.
2026-04-23 18:54 CST: fixed the connector auto-routing bug where existing saved `waypoints` kept the board on the old route even after the new self-adaptive algorithm was added. Root cause: `connectorGeometry`, connector creation, and route-mode switching still preferred persisted waypoints, so auto-routed connectors did not actually use the adaptive path. Auto modes (`orthogonal`, `rounded-orthogonal`) now always recalculate render/save waypoints from current node positions; manual segment/point dragging converts the connector to `polyline` so intentional custom paths remain preserved. Added a small obstacle-aware orthogonal router that tries near-field L routes first, then chooses the shortest valid outside route when a candidate would cross either connected node. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; `git diff --check` => passed; Playwright opened a temporary board whose connector deliberately stored invalid old waypoints `999,999` and confirmed the rendered SVG path ignored them and used the recalculated near-field route `M 375 240 L 375 204 L 224 204 L 224 131 L 260 131`. The temporary `pytest-board-autopath-render` document was soft-deleted. 3100 and 8000 were verified healthy after the fix.
2026-04-24 09:42 CST: changed board node rendering from interaction-only translucency to always-on translucent fills. The transient group-level opacity used during drag/resize/connector preview was removed, and the graph node shapes now render with a stable default fill opacity so the Feishu-style translucent look is visible in normal idle state as well. This keeps borders and text crisp because only the fill layer is translucent. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest -q tests/test_documents_api.py -k board` => passed; `git diff --check` => passed; 3100 dev server restored and `http://127.0.0.1:3100/documents` plus API `/health` both returned healthy responses.
2026-04-24 14:05 CST: implemented the board node quick-add interaction from `/Volumes/usbshare1/20260424112919_rec_.mp4`. When a single node is selected in select mode, hovering any side now shows a blue directional quick-add button, renders a semi-transparent preview node in that direction, and previews a dashed orthogonal connector. Clicking the directional button creates a real node that inherits the source node type, size, and style, connects it from the source anchor to the opposite target anchor, selects the new node, and persists the graph through autosave. Connector endpoint reconnection now uses a larger nearest-anchor snap radius to better match the video behavior. Also fixed an SVG path bug where arrow-shaped nodes emitted invalid `d` attributes. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k 'board or connector'` => passed; Playwright opened board `d3bac9d0-a7f9-4720-9f66-31c63bbb1f3c`, authenticated via dev bootstrap, selected a node, confirmed the right-side quick-add arrow appeared, clicked it, observed node count increase from `20` to `21`, reloaded, confirmed the `21` nodes persisted, and confirmed browser console errors = `0`. Local services verified healthy with `http://127.0.0.1:3100/documents` => 200 and API `/health` => ok.
2026-04-24 14:07 CST: synchronized the board quick-add implementation records to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` -> `631d841f-25d8-4093-a1f5-46c985b6e506`, `已归档/board-connector-editing-improvement-prd.md` -> `490e0113-76d5-404d-bbe5-2e3c9342d34d`. Verification: direct backend writeback completed for both documents; fetched plain text confirmed the connector PRD contains `节点快捷生长`, and progress plain text contains the `board node quick-add interaction` entry.
2026-04-24 14:51 CST: refined board node color and selected-state styling based on the user's Feishu reference image. Default board nodes now use a softer light-blue fill, brighter blue border, and slightly stronger stroke; legacy default-colored nodes and connectors are normalized at load time so existing boards adopt the improved palette without overwriting custom colors. The selected state no longer draws an outer rectangle around the node, avoiding the previous “框套框” visual; resize controls are now small square handles placed directly on the node border, and connection anchors use subtle pale-blue dots. Connector defaults were adjusted to a softer gray with a slightly stronger stroke, and the canvas dot grid color was tuned to match the reference. Verification: `apps/web npm run build` => passed; 3100 dev server was restarted after clearing `.next`; Playwright opened the board, selected a node, confirmed old outer selection frames count = `0`, confirmed blue square handles are present, browser console errors = `0`, and saved evidence screenshot `output/playwright/board-node-color-selection.png`.
2026-04-24 14:53 CST: synchronized the board color/selection styling records to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` -> `631d841f-25d8-4093-a1f5-46c985b6e506`, `已归档/board-connector-editing-improvement-prd.md` -> `490e0113-76d5-404d-bbe5-2e3c9342d34d`. Verification: direct backend writeback completed for both documents; fetched plain text confirmed the progress marker `board node color and selected-state styling` and PRD marker `节点配色与选中态` are present.
2026-04-24 15:18 CST: implemented Feishu-style board shape placement preview based on `/Volumes/usbshare1/20260424145151_rec_.mp4`. After choosing the shape tool or a shape from the compact palette, moving the pointer over the canvas now shows a centered semi-transparent placement preview using the pending shape type; leaving the canvas, switching tools, starting another interaction, or clicking to create the real node clears the preview. The preview is render-only and does not change board JSON until the user clicks. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; restarted 3100 after clearing `.next`; Playwright authenticated via dev bootstrap, created temporary board `pytest-shape-placement-preview-1777014200`, selected the shape tool, moved the mouse over the canvas and confirmed `data-board-placement-preview=true`, clicked to create a real rectangle, confirmed preview disappeared and node count changed from `0` to `1`, confirmed backend persisted one rectangle node, and confirmed browser console errors = `0`. The temporary test board was soft-deleted after verification.
2026-04-24 15:20 CST: synchronized the board shape placement preview records to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` -> `631d841f-25d8-4093-a1f5-46c985b6e506`, `已归档/board-connector-editing-improvement-prd.md` -> `490e0113-76d5-404d-bbe5-2e3c9342d34d`. Verification: direct backend writeback completed for both documents; fetched plain text confirmed the progress marker `shape placement preview` and PRD marker `第八轮图形放置预览` are present.
2026-04-24 15:33 CST: improved board quick-add discoverability based on `/Volumes/usbshare1/20260424145433_rec_.mp4`. Selected nodes now render four always-visible directional quick-add dots outside the node edges instead of relying on invisible hover hit areas; hovering a dot upgrades it to the larger blue directional action button and keeps the existing preview/create behavior. Added test-facing data attributes for the four direction handles. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; restarted 3100 after clearing `.next`; Playwright created temporary board `pytest-quick-add-dot-style-1777015700`, inserted one rectangle, confirmed four `data-board-quick-add-handle` elements for `top/right/bottom/left`, hovered the right handle and confirmed `data-active=true`, and confirmed browser console errors = `0`. The temporary test board was soft-deleted after verification.
2026-04-24 15:35 CST: synchronized the board quick-add discoverability records to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` -> `631d841f-25d8-4093-a1f5-46c985b6e506`, `已归档/board-connector-editing-improvement-prd.md` -> `490e0113-76d5-404d-bbe5-2e3c9342d34d`. Verification: direct backend writeback completed for both documents; fetched plain text confirmed the progress marker `quick-add discoverability` and PRD marker `第九轮快捷生长点可见性` are present.
2026-04-24 15:55 CST: fixed board node long-text overflow based on `/Volumes/usbshare1/20260424151102_rec_.mp4`. Board nodes now calculate required text height from wrapped line count, font size, and vertical padding, and automatically increase node height when existing content or newly edited text would otherwise overflow. Editing mode uses the same fitted-height rendering so the shape grows while text is being edited; finishing text editing persists the expanded height and reroutes affected connectors. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; restarted 3100 after clearing `.next`; Playwright created temporary board `pytest-board-text-autofit-1777017300` with a rectangle intentionally stored as `height=62` plus long text, opened the board, confirmed rendered shape height expanded to `124`, confirmed text bbox stayed fully inside the shape bbox with `contained=true`, and confirmed browser console errors = `0`. The temporary test board was soft-deleted after verification.
2026-04-24 15:57 CST: synchronized the board long-text overflow fix records to online CloudDoc under the existing `clouddoc` root. Sync scope: `DEVELOPMENT_PROGRESS.md` -> `631d841f-25d8-4093-a1f5-46c985b6e506`, `已归档/board-connector-editing-improvement-prd.md` -> `490e0113-76d5-404d-bbe5-2e3c9342d34d`. Verification: direct backend writeback completed for both documents; fetched plain text confirmed the progress marker `long-text overflow` and PRD marker `第十轮长文本自动扩高` are present.
2026-04-27 10:12 CST: fixed the remaining board long-text overflow case after service restart verification showed 3100 was using the new board code but mixed Chinese/English text could still overflow horizontally. Replaced fixed character-count wrapping with visual-width weighted wrapping, kept textarea line height aligned with SVG rendering, and restarted the 3100 dev service after clearing `.next`. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; Playwright opened temporary board `codex-long-text-board-check`, confirmed the long mixed-language text bbox stayed inside the shape bbox with `contained=true`, and API `/health` plus `http://127.0.0.1:3100/documents` returned healthy responses. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed marker `第十一轮长文本横向换行修正`.
2026-04-27 10:21 CST: changed board connector defaults to rounded orthogonal lines. New connectors created through the connector tool, quick-add growth, and connector previews now default to `routingMode = rounded-orthogonal` with the standard 12px corner radius; missing legacy routing values are normalized to rounded orthogonal while explicit user-selected straight/orthogonal/polyline modes remain supported. Backend board validation now also treats missing routing as rounded orthogonal. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => 1 passed; `git diff --check` => passed; Playwright opened temporary board `pytest-rounded-default-connector`, used quick-add to create a connected node, and backend verification confirmed the persisted connector had `routingMode: "rounded-orthogonal"` and `cornerRadius: 12`. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed marker `第十二轮默认圆角折线`.
2026-04-27 10:39 CST: changed board text overflow behavior for manually resized small shapes. Board loading no longer force-expands saved nodes to fit text, so user-resized small shapes keep their saved size; when text no longer fits, the node renders an internal scroll container instead of allowing text to spill outside the shape. Editing still uses aligned line-height and can scroll internally, while finishing text input continues to auto-expand newly edited text. Also moved resize handles above connection anchors in the SVG stacking order so top/right/bottom/left resize handles remain clickable. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; restarted 3100 after clearing `.next`; Playwright opened temporary board `pytest-board-text-scroll-saved-small` with a saved `90x50` long-text rectangle and confirmed `data-board-node-text-overflow=true`, `scrollHeight > clientHeight`, text bbox stayed within the shape bbox with `contained=true`, and after selecting the node the bottom handle hit target was `cursor: ns-resize`. Temporary scroll test boards were soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed marker `第十三轮手动缩小时文本内部滚动`.
2026-04-27 11:45 CST: refined board node text sizing with a persisted `manualSize` flag. Nodes now default to `manualSize=false`, so existing and newly created shapes automatically grow in height to fit text. Dragging any resize handle sets `manualSize=true`, after which the node keeps the user-defined size and uses the internal scroll renderer when text overflows; editing a manually sized node no longer auto-expands it. Quick-add and new shape placement create nodes with `manualSize=false`, while duplicated nodes preserve their source sizing mode. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; restarted 3100 after clearing `.next`; Playwright opened temporary board `pytest-board-manual-size-autofit`, confirmed `auto-node` without manual sizing grew from `50` to `264` height with no overflow, confirmed `manual-node` stayed `110x50` with internal scrolling, then manually resized `auto-node` through the UI and backend verification confirmed it persisted as `manualSize: true` with `70x55` size and scrolling. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed marker `第十四轮手动尺寸状态与自适应切换`.
2026-04-27 11:55 CST: added middle-mouse canvas panning for the board editor. Pressing and dragging the mouse wheel now temporarily pans the board from the canvas, nodes, resize handles, connection anchors, and quick-add controls without switching to the pan tool; non-left clicks no longer trigger select/drag/resize/connector actions. The SVG now prevents the browser middle-click aux action during this interaction. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; restarted 3100 after clearing `.next`; Playwright opened temporary board `pytest-board-middle-pan`, dragged from `(520,360)` to `(620,430)` with the middle button, and confirmed the board transform changed to `translate(100 70) scale(1)` while no marquee selection was created. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed marker `第十五轮鼠标滚轮键拖动画布`.
2026-04-27 14:03 CST: added quick-add hold/drag connector creation for the board editor based on `/Volumes/usbshare1/20260427134341_rec_.mp4`. The four directional quick-add dots keep their existing single-click behavior for creating a same-style neighboring node, but pressing and holding or dragging from a dot now starts a connector draft from that side. Releasing near another node snaps to that node's nearest edge anchor and creates a rounded orthogonal connector without adding a new node. The same nearest-node fallback also improves regular connector dragging so users do not need to release exactly on the tiny anchor dot. Verification: `apps/web npm run build` => passed; Playwright authenticated via dev bootstrap, opened temporary board `codex quick connect test`, confirmed single-click quick-add produced `3` nodes and `1` rounded connector, then reset the board and confirmed hold/drag from node A's right quick-add dot to node B produced `2` nodes and `1` connector from `node-a:right` to `node-b:left` with `routingMode: rounded-orthogonal` and `cornerRadius: 12`. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `quick-add hold/drag connector creation` and `第十六轮快捷生长点拖拽连线`.
2026-04-27 14:12 CST: added Esc cancellation for active board operations. Esc now immediately exits transient operations including shape/text placement, connector drafting, quick-add hold/drag connector mode, marquee selection, pan, node drag, resize, connector handle drag, connector endpoint reconnection, shape palette, and floating panels, then returns to the select tool. Continuous operations that mutate the canvas while dragging restore the interaction-start snapshot when Esc is pressed, preventing accidental partial moves/resizes/pans from persisting. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => 1 passed; Playwright opened temporary board `codex esc cancel test`, selected the shape tool and confirmed Esc removed `data-board-placement-preview`, then started quick-add hold/drag connector drafting and confirmed Esc removed the dashed draft path and backend state stayed at `2` nodes and `0` connectors after mouseup. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `Esc cancellation for active board operations` and `第十七轮 Esc 取消当前操作`.
2026-04-27 15:14 CST: restricted board connector creation to node-origin interactions and expanded connector segment editing. The left toolbar no longer exposes a standalone connector tool, so new lines can only be started from node edge anchors or quick-add dots. Selected connectors now render draggable hit paths and midpoint handles for every visible orthogonal segment, including the first and last segments next to endpoints. Dragging an endpoint-adjacent segment keeps the endpoint anchored and inserts a dogleg waypoint as needed, then converts the connector to manual `polyline` routing. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => 1 passed; Playwright opened temporary board `codex connector segment test`, confirmed toolbar titles were `选择/图形/文本/拖动画布` with no `连接线`, selected a three-segment connector and confirmed `3` segment overlay paths plus `3` handles, dragged the last segment from `y=266` to `y=318`, and verified backend persisted `routingMode: polyline`, `cornerRadius: 0`, and updated waypoints. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `restricted board connector creation` and `第十八轮节点限定连线与全分段调整`.
2026-04-27 15:25 CST: adjusted the selected-node floating toolbar placement so it no longer covers quick-add dots. The toolbar now uses a larger quick-add clearance gap below the node and also avoids the top quick-add dot when it flips above the node near the viewport bottom. Verification: `apps/web npm run build` => passed; 3100 was restarted after clearing `.next`; Playwright opened temporary board `codex toolbar clearance test`, selected one rectangle, and confirmed the floating toolbar bbox did not overlap either the top or bottom `data-board-quick-add-handle`. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `selected-node floating toolbar placement` and `第十九轮选中工具栏避让快捷点`.
2026-04-27 17:39 CST: implemented connector segment text labels for the board editor based on `/Volumes/usbshare1/连接线文本.mp4`. Double-clicking or quickly clicking the same connector segment twice now opens a small Feishu-like inline input on that segment. Submitting text stores the label plus segment anchor metadata (`labelPosition`, `labelSegmentIndex`, `labelSegmentT`) so the label restores near the same segment after refresh; clearing the input removes the label metadata. The connector hit path now explicitly uses SVG `pointer-events=stroke` to make line interaction reliable. Verification: Playwright opened temporary board `codex connector label test`, activated the connector label input from the line segment, entered `条件文本`, confirmed the label appeared on canvas, fetched the document API to verify persisted label metadata, reloaded the page, and confirmed the label still rendered. `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `connector segment text labels` and `第二十轮连接线文本标签`.
2026-04-27 17:51 CST: implemented draggable connector labels based on `/Volumes/usbshare1/连接线文本框，可以移动.mp4`. Existing labels now render as compact white text boxes with hover/selected blue borders and a move cursor. Dragging a label projects the pointer to the nearest point on its connector path, updates `labelPosition`, `labelSegmentIndex`, and `labelSegmentT` live, and preserves undo history through the existing continuous-interaction snapshot mechanism. Labels stay attached to the connector path rather than freely floating. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `codex connector label drag test`, dragged label `标签` from the middle of the connector toward the right segment endpoint, confirmed the canvas label bbox moved from `x=402` to `x=487`, fetched the document API and confirmed persisted `labelPosition={x:505,y:266}`, `labelSegmentIndex=2`, `labelSegmentT≈0.91`, then reloaded and confirmed the label still rendered at `x=487`. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `draggable connector labels` and `第二十一轮连接线标签沿线拖动`.
2026-04-28 15:20 CST: implemented connector segment snap, merge, and split behavior based on `/Volumes/usbshare1/连接线吸附与合并.mp4`. Dragged orthogonal connector segments now snap within 8px to existing endpoint/bend coordinates and non-adjacent parallel segment coordinates. After snapping, the path cleanup removes duplicate points, collinear middle points, and overlapping U-turn folds while preserving at least start/end points. This allows line segments to merge when dragged close to an endpoint or overlapping segment, and split back into dogleg waypoints when dragged away. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `codex connector snap merge test`, dragged the middle vertical segment from `x=346` close to `x=520` and confirmed backend waypoints merged to `[{x:520,y:186}]`, then dragged the merged vertical segment back to `x=430` and confirmed backend waypoints split to `[{x:430,y:186},{x:430,y:266}]`. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `connector segment snap, merge` and `第二十二轮连接线吸附`.
2026-04-28 15:44 CST: fixed board connector endpoint bend spacing based on `/Users/yys235/Library/Containers/com.bytedance.macos.feishu/Data/Library/Application Support/LarkShell/screenshot/20260428152000.mp4`. Orthogonal connectors now protect a 24px straight stub after leaving the source shape and before entering the target shape, including auto-routed connectors, manually edited `polyline` connectors, and render-time fallback paths. Added orthogonal bridge insertion so endpoint stub protection does not introduce diagonal segments, and adjusted cleanup so protected stubs are not removed as overlapping folds. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `codex connector endpoint stub test` and confirmed the rendered path was `M 310 186 L 496 186 L 496 266 L 520 266`, preserving the target-node left-side 24px entry stub with no diagonal or backtracking segment. The temporary test board was soft-deleted. Sync: updated online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `connector endpoint bend spacing` and `第二十三轮连接端点短直段保护`.
2026-04-28 16:09 CST: fixed the remaining board connector endpoint asymmetry after the user reported only one end visibly kept the protected stub. Root cause: `protectConnectorEndpointStubs` used mirrored logic for the target end but not for the source end, so the source-side bridge kept extending along the original anchor direction instead of turning immediately after the 24px stub. Updated the source-side bridge insertion to mirror the target-side behavior and to reuse the next bend coordinate when a later turn already exists, so the first turn now happens right after leaving the shape instead of far downstream. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed. Sync: updated local `已归档/board-connector-editing-improvement-prd.md` and this progress file, then synchronized online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `connector endpoint asymmetry` and `第二十四轮连接端点双侧对称短直段`.
2026-04-29 16:27 CST: fixed board connector toolbar menu viewport overflow. The floating toolbar panel now computes available space from the current viewport, opens upward when there is not enough room below, and applies a dynamic max height with internal vertical scrolling so all line-routing and line-style options remain reachable in small windows. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `codex toolbar overflow test` in a `520x420` viewport, selected a connector, opened the line/path menu, and confirmed the panel stayed inside the viewport (`top=7`, `bottom=280`, `viewportHeight=420`) with `overflowY=auto`. Evidence screenshot: `output/playwright/toolbar-overflow-fixed.png`. The temporary test board was soft-deleted. Sync: updated local `已归档/board-connector-editing-improvement-prd.md` and this progress file, then synchronized online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `toolbar menu viewport overflow` and `第二十五轮连接线菜单视口溢出修复`.
2026-04-30 15:11 CST: fixed the board connector regression where a rounded connector became a sharp polyline after moving a connector segment. Root cause: segment and waypoint dragging intentionally converted auto-routed connectors to manual `polyline` paths, but also forced `cornerRadius` to `0`, and `connectorPath` only rendered curves for `rounded-orthogonal`. Manual `polyline` connectors now keep a positive corner radius when the source connector was rounded, and `connectorPath` renders rounded corners whenever `cornerRadius > 0`. Explicitly choosing the `polyline` route option still resets the radius to `0`. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `codex rounded connector drag test`, dragged a rounded connector segment, and confirmed backend state `routingMode=polyline`, `cornerRadius=12`, `waypoints=[{x:430,y:191},{x:430,y:291}]` while the rendered path still contained `Q` curve commands. The temporary test board was soft-deleted. Sync: updated local `已归档/board-connector-editing-improvement-prd.md` and this progress file, then synchronized online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`; verification fetched both and confirmed markers `rounded connector became a sharp polyline` and `第二十六轮圆角连接线拖动保持圆角`.
2026-04-30 17:31 CST: analyzed `/Users/yys235/Downloads/table形状的需求.mp4` and created local PRD `已归档/board-table-shape-prd.md` for the complete V1 board table shape. The PRD defines table as a dedicated board node type, not a document table or spreadsheet, and covers creation, default 3x3 table with title row, structured table JSON, cell/title editing, cell/row/column selection, row/column insertion and deletion with confirmation, row-height and column-width resizing, whole-table drag/resize, toolbar behavior, shortcuts, backend validation, acceptance criteria, and automated tests. Sync: created/synchronized online CloudDoc document `4c3ec831-ee84-4491-b9b4-45020d3e0809` under the existing `clouddoc` root; verification fetched the online document and confirmed marker `CloudDoc 画板表格形状完整功能 PRD`.
2026-04-30 18:03 CST: implemented the first functional version of the board `table` shape from `已归档/board-table-shape-prd.md`. Frontend changes add `table` as a structured board node type with title row, 3x3 default table, SVG grid rendering, table/cell/row/column selection, double-click title/cell editing, Tab/Shift+Tab navigation with last-cell row creation, row/column insert actions from the floating toolbar, row/column deletion guardrails, row-height and column-width drag resizing, whole-table proportional resizing, undo/redo integration, autosave/save persistence, and shape palette/toolbar table icons. Backend changes extend board content validation to accept structured table nodes and reject malformed table payloads. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright logged in, opened temporary board `codex table shape e2e`, inserted/rendered a table, double-click edited cells to `111` and `222`, saved, refreshed, and confirmed both values persisted. The temporary test board `54370df0-fa66-4776-ac3a-a9b685443e83` was soft-deleted after verification. Sync: updated this local progress file and synchronized online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `implemented the first functional version of the board table shape`.
2026-05-06 14:23 CST: continued the board table shape implementation to close V1 usability gaps. Added explicit row and column control handles around selected tables so row/column selection is reachable without relying on hidden hit areas; row/column deletion now opens a confirmation dialog before removing content; `Esc` in table title/cell editing now cancels instead of committing; newly inserted rows/columns inherit the selected row height or column width; the default table now matches the PRD target size `360 x 180`. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright logged in, created temporary board `codex table controls e2e`, inserted a table, selected a row via the new left row handle, pressed Delete, confirmed the row deletion dialog, saved, refreshed, and confirmed the table persisted with one row removed. The temporary test board `4d9113bc-1f1f-4171-9c8e-c7ac6fb0730e` was soft-deleted after verification. Sync: updated this local progress file and synchronized online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `continued the board table shape implementation to close V1 usability gaps`.
2026-05-06 14:50 CST: completed another board table V1 gap-closing pass after the user reported the table function was still incomplete. Added per-cell style normalization and rendering for color, font size, font weight, and horizontal alignment; toolbar text color, font size, and text-style controls now apply to selected cells/rows/columns instead of only the whole table node. Added keyboard navigation between selected cells with arrow keys, clipboard copy/paste for selected table ranges or cells with Tab/newline matrix pasteback, title/cell/row/column content clearing with confirmation, and title-row height drag resizing. Backend board validation now accepts structured cell style data and rejects invalid table title height, column width, or cell text alignment values. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright used a real Chrome browser to open temporary board `pytest-board-table-complete`, double-click edited a table cell, moved selection with ArrowRight, pressed Delete, confirmed the new clear-cell dialog, and completed successfully with marker `playwright-board-table-ok`. The temporary test board `de1206aa-973e-4db1-93c3-292dc1b14c94` was soft-deleted after verification. Sync: updated this local progress file and synchronized online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `completed another board table V1 gap-closing pass`.
2026-05-06 15:25 CST: fixed two table-shape regressions reported by the user. Root cause: table title/cell/row/column hit layers stopped pointerdown propagation, so the outer node drag handler never received drag events; row/column add actions were also hidden in the floating menu and the first visible bottom add control overlapped the selected-node toolbar. Table internal hit layers now forward pointerdown into the regular node drag flow while preserving click-to-select behavior, so dragging from a table cell/title moves the whole table. Selected tables now show direct edge `+` controls: right-side `+` adds a column and bottom-left `+` adds a row, positioned away from quick-add dots and the floating toolbar. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `pytest-board-table-drag-plus-final`, dragged a table from an internal cell, clicked the right-side column add control, clicked the bottom-left row add control, saved, and verified persisted table size changed from `3x3` to `4x4` with marker `playwright-board-table-drag-plus-ok`. Temporary test boards `0b76bca1-2db9-4bfb-8c3d-33824a05e2c5`, `d6a57629-4dae-4d7e-ae95-1266c3d259c6`, and `d59c3de7-1799-4dc5-8dfa-2cae62f99cf8` were soft-deleted after verification. Sync: updated this local progress file and synchronized online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `fixed two table-shape regressions reported by the user`.
2026-05-07 09:20 CST: adjusted the selected board table column-add `+` control position based on the user screenshot. The right-side add-column button now sits close to the table right edge near the upper body area (`x = table right + 16`, `y = titleHeight + 26`) instead of floating far to the right at the vertical center, reducing confusion with connector/selection handles. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `pytest-board-table-plus-position`, selected the table, verified the right-side `+` was at the expected near-edge coordinate, clicked it, and confirmed the table visually expanded from width `360` to `480` with marker `playwright-board-table-plus-position-ok`. The temporary test board `daebcbe8-a667-4415-82b4-e22fe4e367d9` was soft-deleted after verification. Sync: updated this local progress file and synchronized online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `adjusted the selected board table column-add`.
2026-05-07 09:42 CST: repositioned both selected board table add controls to align with concrete cells. The add-column `+` now appears beside the first row's last cell (`x = table right + 16`, `y = titleHeight + firstRowHeight / 2`), and the add-row `+` now appears below the first column's last cell (`x = firstColumnWidth / 2`, `y = table bottom + 16`). Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `pytest-board-table-two-plus-position`, verified both plus controls matched the expected cell-relative coordinates with non-uniform row/column sizes, clicked both controls, and confirmed visual table size changed to include one new column and one new row with marker `playwright-board-table-two-plus-position-ok`. The temporary test board `28b20144-3b44-45b0-8174-0220ea921e5e` was soft-deleted after verification. Sync: updated this local progress file and synchronized online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `repositioned both selected board table add controls`.
2026-05-07 10:18 CST: made the selected board table row/column edge buttons functional instead of only selecting row/column. Clicking a column handle now opens a compact `列操作` menu with insert-left, insert-right, and delete-column actions; clicking a row handle opens a compact `行操作` menu with insert-above, insert-below, and delete-row actions. Row/column deletion still uses the existing confirmation dialog and guardrails that keep at least one row and one column. The table action menu now closes when another table part is selected so stale menus do not remain on screen. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `pytest-board-table-actions-*`, clicked the column edge button, deleted a column through the confirmation dialog, clicked the row edge button, deleted a row through the confirmation dialog, saved, and verified the backend table persisted as `2` columns and `2` rows with marker `playwright-board-table-action-menu-delete-ok`. The temporary test board was soft-deleted after verification. Sync: updated online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `playwright-board-table-action-menu-delete-ok`.
2026-05-07 11:08 CST: fixed the board connector jump reported in GIF `20260507104838.gif` when dragging an ellipse/circle shape. Root cause: selected-node dragging rerouted connectors on every pointer move, and `rounded-orthogonal` rendering ignored persisted waypoints in favor of fresh auto-routing, so the route could switch between candidates mid-drag and make the arrow appear inside the shape. Connector rendering now prefers existing waypoints for non-straight connectors, node drag/resize preserves existing connector waypoints when only one endpoint moves, and autosave no longer overwrites existing auto connector waypoints. This keeps the path stable while the endpoint follows the moved shape boundary. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright opened temporary board `pytest-connector-drag-stability-*`, dragged an ellipse with an attached rounded connector, verified the connector endpoint followed the ellipse bottom boundary, confirmed routing stayed `rounded-orthogonal`, and confirmed persisted waypoints were not rerouted with marker `playwright-board-ellipse-connector-drag-stable-ok`. The temporary test board was soft-deleted after verification. Sync: updated online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `playwright-board-ellipse-connector-drag-stable-ok`.
2026-05-07 11:34 CST: completed the second connector-jump fix after cache was ruled out. The first fix still missed the user GIF structure because `dragState.connectorWaypoints` only captured connectors whose two endpoints were both dragged, so single-endpoint connectors had no stable baseline. Node dragging now records initial waypoints for any connector attached to the dragged node, and single-endpoint movement updates only the endpoint-adjacent waypoint pair while leaving the rest of the path stable. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright reproduced the GIF-like case with a table bottom connector attached to an ellipse bottom connector, dragged the ellipse through multiple points, confirmed sampled connector endpoints moved continuously on the ellipse boundary, saved, and verified persisted waypoints updated to `[{x:345,y:485},{x:1240,y:485},{x:1240,y:396}]` with marker `playwright-board-table-ellipse-connector-no-jump-ok`. The temporary test board was soft-deleted after verification. Sync: updated online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `playwright-board-table-ellipse-connector-no-jump-ok`.
2026-05-07 14:22 CST: refined board connector movement after analyzing video `20260507134352.mp4` as continuous frames. The issue was no longer just endpoint jump; during node movement, the connector could keep or create unnecessary small dogleg bends. Single-endpoint movement now compares the locally adjusted route with a current shortest orthogonal route and switches only when the shorter candidate is valid and has fewer path points. The orthogonal simplifier also collapses short H-V-H / V-H-V jogs so tiny endpoint-protection wiggles are not shown or persisted. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright reproduced a video-like top-oval-to-moving-rectangle drag and confirmed path operations dropped from `8` to `4` instead of increasing, persisted waypoints simplified to `[{x:730,y:71}]`, and returned marker `playwright-board-connector-bend-minimize-ok`; Playwright also reran the table-to-ellipse drag regression and confirmed continuous endpoints with marker `playwright-board-table-ellipse-connector-no-jump-ok`. Temporary test boards were soft-deleted after verification. Sync: updated online CloudDoc progress document `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched the online document and confirmed marker `playwright-board-connector-bend-minimize-ok`.
2026-05-07 17:32 CST: adapted MCP document reading for board documents. `clouddoc.get_document` now supports `format=ai`, returns `ai_view` for board documents in `format=ai/full`, and renders board-aware Markdown for the default `markdown` format instead of falling back to title-only plain text. The board AI view keeps raw IDs while adding compact `n1/c1` refs, overview counts, canvas bounds, reading order, normalized nodes, table rows/cells, connectors with endpoint anchors/path points/labels, adjacency maps, unconnected nodes, and warnings. Updated local MCP design documentation with `clouddoc.board.ai_view.v1`. Verification: `apps/mcp ../api/.venv/bin/pytest -q` => 14 passed, including board AI format coverage. Sync: updated online CloudDoc documents `0110cd53-5d5c-453e-9da4-2990e457a604` and `631d841f-25d8-4093-a1f5-46c985b6e506`; verification fetched both and confirmed markers `clouddoc.board.ai_view.v1` and `adapted MCP document reading for board documents`.
2026-05-08 09:49 CST: fixed the board connector redraw issue reported in video `20260508093327.mp4`. When moving a connected shape, the connector path selector now compares actual Manhattan path length in addition to path point count, so an auto-routed path with fewer/shorter vertical detours can replace the locally adjusted old route. The node-intersection check used during this comparison now ignores the legal first/last connector stubs that leave or enter endpoint nodes, and only checks interior path segments. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright with local Chrome reproduced the rectangle-to-ellipse drag case, observed the previous failure mode where the main connector grew from `414.5` to `574.5`, then confirmed the fixed path shortens to `114.5` during drag and after mouse up. Evidence screenshot: `output/playwright/board-connector-shorten-fixed.png`. Sync scope: local connector PRD updated with `第二十七轮移动形状时连接线竖向绕行段缩短`, and this progress entry plus connector PRD were synchronized to online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`.
2026-05-08 10:05 CST: tightened the board connector reroute heuristic after the user confirmed extra bends still remained. Default connector route candidates are now ranked by bend count first and path length second, and moved-node route comparison now prefers a valid auto route when it has fewer bends without a large detour. This implements the rule `as few bends as necessary` instead of only comparing point count or length. Verification: `apps/web npm run build` => passed; `apps/api .venv/bin/pytest tests/test_documents_api.py -k board -q` => passed; Playwright created a temporary board with an intentionally over-bent rectangle-to-ellipse connector, dragged the ellipse, confirmed the visible connector bend count dropped from `8` to `2`, saved, and verified persisted waypoints reduced to `[{x:306,y:291},{x:306,y:300}]`. Evidence screenshot: `output/playwright/board-connector-min-bends-fixed.png`. The temporary board was soft-deleted. Sync scope: local connector PRD updated with `第二十八轮连接线候选路径按弯折数优先`, and this progress entry plus connector PRD were synchronized to online CloudDoc documents `631d841f-25d8-4093-a1f5-46c985b6e506` and `490e0113-76d5-404d-bbe5-2e3c9342d34d`.
2026-05-08 10:24 CST: simplified `README.md` for first-time deployment users and moved AI-related capability descriptions to the top. The README now focuses on CloudDoc's AI/MCP/Open API capabilities, permission boundaries, local deployment steps, production startup, Nginx proxy requirements, common checks, and links to deeper archived docs. Verification: `git diff --check` => passed. Sync scope: `README.md` and this progress entry were synchronized to online CloudDoc documents `672c8bc1-2272-4834-8d0f-7ede79d232e5` and `631d841f-25d8-4093-a1f5-46c985b6e506`.
2026-05-08 11:34 CST: fixed the frontend SSE connection leak. Root cause: multiple mounted components independently created `new EventSource("/api/events/stream")`, including sidebar notifications, document library sections, trash, notifications list, folder workspace, and document detail pages. Added a client-side singleton event-stream module so one browser tab reuses one shared EventSource while components register event listeners through `subscribeCloudDocEvents`. Verification: `apps/web npm run build` => passed; `git diff --check` => passed; Playwright logged in as the demo user and confirmed `/documents` opens exactly one `/api/events/stream` request, then opened a document detail page and confirmed it also opens exactly one stream request despite sidebar plus document listeners. Sync scope: this progress entry was synchronized to online CloudDoc document `631d841f-25d8-4093-a1f5-46c985b6e506`.
