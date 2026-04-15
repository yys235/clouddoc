# Feishu Doc Block Research Report

Date: 2026-03-27
Project: CloudDoc
Scope: `doc` type block editor, presentation layer, and V1 implementation priorities

## 1. Research Goal

This report summarizes the publicly visible block editing style and feature model of Feishu Docs, then converts that research into implementation requirements for CloudDoc.

The goal is not to clone every office capability in V1. The goal is to align the core document editing interaction with Feishu's block-oriented document model.

## 2. Source Basis

Primary public sources used:

- Feishu official article: [飞书云文档怎么用？一篇教你搞定在线文档创建、协作与分享](https://www.feishu.cn/content/article/7572026952902230020)
- Feishu official article: [飞书文档全新修订模式：满足专业需求，提升协作效率](https://www.feishu.cn/content/feishu-documents-new-revision-mode-meet-professional-needs-boost-collaboration-efficiency)
- Feishu official article: [文件反复传版本太混乱？在线文档统一管理确保内容不走样！](https://www.feishu.cn/content/article/7589835882652306631)

Important note:

- The functional facts below are taken from the official pages above.
- The UI style conclusions are partly direct from those pages, and partly engineering inference from the product behavior described there.

## 3. Core Findings

### 3.1 Feishu Docs is block-oriented, but visually continuous

Feishu's document is not presented as obvious "cards" like Notion. It is a continuous document layout with block-level editing affordances.

Observed structure from the official description:

- A new document starts with only title, body, and a left-side plus entry.
- More functions are hidden in floating menus instead of being permanently exposed.
- Paragraph-level formatting exists separately from inline text formatting.
- Outline is generated from heading structure.

This means the correct direction for CloudDoc is:

- storage: structured document tree
- editing unit: per-block operations
- presentation: continuous document
- chrome density: low-noise, hover-reveal, command-driven

This is the opposite of:

- storing a whole document as one HTML blob
- exposing every block as a heavy visible card

### 3.2 Feishu keeps formatting constrained on purpose

From the official article:

- Feishu Docs does not focus on arbitrary font-size control.
- It prefers semantic structure such as level 1 to level 9 headings and body text.
- It explicitly emphasizes Markdown-like shortcuts and keyboard efficiency.

Implication for CloudDoc:

- V1 should use semantic block types, not freeform typography controls
- title hierarchy matters more than font-size choices
- editing shortcuts matter more than toolbar density

### 3.3 Feishu uses three editing surfaces

The official article explicitly describes three floating menus:

- `+` menu: insert content
- `=` menu: change block-level format
- floating inline menu: text-level formatting

This is the most important interaction model for CloudDoc V1.

Interpretation:

- `+` is for creating a new block or embedded content
- `=` is for converting the current block type
- floating inline toolbar is for selected text only

### 3.4 The left-side insert entry is a core part of the editor identity

The official article says a new document opens with title, body, and one plus entry. That is not cosmetic. It signals the editor's mental model:

- insertion happens between lines
- blocks are primary
- the editor stays visually minimal until interaction is needed

CloudDoc should preserve this pattern.

### 3.5 Feishu block capabilities are broader than plain text

The official article lists these representative insertion capabilities:

- text
- image
- text table
- task list
- embedded spreadsheet / base / mind note
- map
- video
- web card
- vote
- countdown
- flowchart / UML
- mentions
- document links

CloudDoc V1 does not need all of these, but the document model and insertion UX must leave room for them.

### 3.6 Feishu separates block formatting from inline formatting

The official article describes:

- block formatting through the `=` menu
- inline formatting through the floating selection menu

This separation is important because it prevents the interface from collapsing into one overloaded toolbar.

For CloudDoc V1:

- block tools should operate on the current block
- inline tools should appear only after text selection

### 3.7 Feishu treats headings as navigation structure, not visual decoration

The official article explicitly states that headings drive the left outline automatically.

Implication:

- heading blocks are not optional decoration
- heading hierarchy drives navigation, readability, and document information architecture
- V1 must make heading creation lightweight

### 3.8 Feishu document collaboration extends around the document, not only inside the text

The official pages also describe:

- comments on selection
- resolved comments
- private comments
- revision mode
- history restore
- permission controls
- share controls

CloudDoc V1 does not need full multi-user collaboration, but the surrounding document shell must reserve space for:

- share
- history
- comments
- review mode

## 4. Style Analysis

### 4.1 Visual style

Feishu Docs uses a restrained visual system:

- wide reading canvas
- continuous content flow
- low-contrast chrome
- hover-triggered controls
- semantic typography instead of custom font chaos

The editor should feel closer to "writing on a page" than "assembling widgets".

### 4.2 Density

The editor itself is compact. Controls are not absent, but most are:

- contextual
- hover based
- selection based
- command based

So the page can stay content-first.

### 4.3 Interaction emphasis

The product favors:

- slash-like or Markdown-like creation flows
- quick block conversion
- minimal mouse travel
- strong keyboard support

## 5. Functional Breakdown for CloudDoc

### 5.1 Must-have block editor capabilities

These are the minimum capabilities required to say the editor is Feishu-aligned:

- title input separate from body
- body composed of blocks
- insert block from left gutter `+`
- change current block type from a block-format control
- slash command to create/convert blocks
- hover-reveal row controls
- heading-generated outline
- continuous document reading mode
- structured JSON persistence

### 5.2 Must-have V1 block types

Priority P0:

- paragraph
- heading
- bullet list
- checklist
- quote
- code block

Priority P1:

- image
- divider
- ordered list
- callout
- table
- mention chip
- document link card

Priority P2:

- embed card
- vote
- countdown
- diagram block

### 5.3 Must-have V1 editor interactions

Priority P0:

- create block below current block
- delete block
- duplicate block
- move block up/down
- convert block type
- slash command picker
- empty-state placeholder with command hint
- save and reload preserving block structure

Priority P1:

- Enter to split block
- Backspace on empty block to merge/remove
- inline bold / italic / highlight toolbar on selection
- drag handle reorder

Priority P2:

- drag-and-drop media insertion
- paste-to-create blocks
- command ranking and recent commands

### 5.4 Surrounding document shell requirements

Priority P0:

- outline navigation
- share action
- favorite action
- move to trash
- save status

Priority P1:

- history panel
- comment panel
- version compare entry

## 6. Gap Analysis Against Current CloudDoc

Before this round, the project already moved from a single large textarea to block-based editing, but it still lagged behind Feishu in these places:

- block controls were too exposed and too heavy
- there was no slash command flow
- supported block types were too few
- there was no checklist block
- there was no quote block
- the left gutter did not behave like a Feishu-style insertion affordance

## 7. Implementation Plan

### Phase A: Done in this round

- add explicit research report
- refine block row layout to be lighter and more contextual
- add slash command menu
- add checklist block
- add quote block
- keep JSON persistence compatible with current backend

### Phase B: Next

- inline selection toolbar
- Enter split and Backspace merge
- drag handle reorder
- image block
- divider block

### Phase C: Later

- comments
- revision mode
- version diff
- mentions
- embedded cards

## 8. Data Model Guidance

The correct document model remains:

- one `doc` root
- ordered array of block nodes
- block-specific attrs
- inline marks inside text nodes

Recommended node examples:

- `heading`
- `paragraph`
- `bullet_list`
- `check_list`
- `blockquote`
- `code_block`

This aligns with the current project direction and keeps future extension viable.

## 9. Product Decisions for Current Build

Based on the research above, CloudDoc should adopt these decisions immediately:

- keep continuous document presentation
- do not switch to a visible card-stack editor
- keep semantic formatting only
- prioritize block interaction over toolbar complexity
- use slash command and left-gutter insertion as the main creation paths
- treat heading hierarchy as document structure

## 10. References

- Feishu official: [飞书云文档怎么用？一篇教你搞定在线文档创建、协作与分享](https://www.feishu.cn/content/article/7572026952902230020)
- Feishu official: [飞书文档全新修订模式：满足专业需求，提升协作效率](https://www.feishu.cn/content/feishu-documents-new-revision-mode-meet-professional-needs-boost-collaboration-efficiency)
- Feishu official: [文件反复传版本太混乱？在线文档统一管理确保内容不走样！](https://www.feishu.cn/content/article/7589835882652306631)
