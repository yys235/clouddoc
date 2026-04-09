# Text Block Unified Surface Design

## Goal

普通文本块只保留一套渲染机制。

- 阅读模式和编辑模式使用同一个文本表面组件
- 只通过 `editable=true/false` 切换是否允许编辑
- 不再维护“阅读态文本层”和“编辑态 textarea”两套视图

## Scope

本次统一的块类型：

- `paragraph`
- `heading`
- `bullet_list`
- `ordered_list`
- `check_list`
- `quote`
- `code_block`

暂不纳入：

- `link`
- `image`
- `divider`

这些块本身已经是专用渲染器，不属于“文本块双机制”问题核心。

## Current Problems

当前文本块存在两套实现：

- 阅读模式：自定义文本层
- 编辑模式：`textarea`

这会持续制造一致性问题：

- 空行在阅读/编辑模式表现不一致
- 评论高亮在阅读/编辑模式行为不一致
- 点击评论文本能否激活线程需要写两套逻辑
- 光标、选区、定位要分别维护

## Target Architecture

新增一个统一组件：`TextBlockSurface`

职责：

- 渲染文本块内容
- 在同一个 DOM 表面中支持评论高亮
- 在 `editable=true` 时支持输入、选区、粘贴、键盘导航
- 在 `editable=false` 时保留完全一致的排版和空行表现

建议实现形态：

- 根节点使用 `div contentEditable`
- `editable=true` 时：
  - `contentEditable`
  - 接收输入、选区、键盘事件
- `editable=false` 时：
  - `contentEditable={false}`
  - 仍使用同一套 DOM 结构和文本分段

## Data Model

现有 `EditableBlock` 不变：

- `id`
- `type`
- `text`
- `headingLevel`
- `meta`
- `imageAlign`

评论仍使用现有锚点：

- `block_id`
- `start_offset`
- `end_offset`
- `quote_text`
- `prefix_text`
- `suffix_text`

## Rendering Model

`TextBlockSurface` 内部将文本切成统一的可渲染 segment：

- normal text
- highlighted text
- active highlighted text

每个 segment 用 `span` 渲染。

这样阅读/编辑共用：

- 同一套文本切分逻辑
- 同一套评论高亮逻辑
- 同一套点击线程激活逻辑

## Input Model

编辑模式下不再依赖 `textarea.value`，而是依赖 contentEditable 文本内容。

需要的基础能力：

1. 从 DOM 提取纯文本
2. 从当前选区计算：
   - `startOffset`
   - `endOffset`
3. 根据 offset 恢复光标
4. 保留多空行和换行

核心约束：

- DOM 中的 span 包装不能改变文本 offset 计算
- 选区 offset 必须基于纯文本长度，而不是节点数量

## Event Handling

`TextBlockSurface` 需要承接：

- `onInput`
- `onPaste`
- `onFocus`
- `onBlur`
- `onMouseUp`
- `onKeyDown`

行为保持现有功能：

- `Enter` 新建块
- `Shift+Enter` 块内换行
- slash 命令
- 大段文本粘贴结构化拆分
- 图片粘贴上传
- Arrow 键跨块移动
- 评论选区工具条
- 点击评论文本定位线程

## Focus and Selection

现有 `pendingFocus + textareaRefs` 需要替换成：

- `pendingFocus + textBlockRefs`

新增统一工具函数：

- `getSelectionOffsetsWithin(element)`
- `setCaretOffsetWithin(element, offset)`
- `getCollapsedCaretOffset(element)`
- `extractPlainTextFromSurface(element)`

## Comment Highlight Rules

评论高亮在统一表面上保持一致：

- 阅读态：可见、可 hover、可点击
- 编辑态：可见、可 hover、可点击

评论点击规则：

- 光标落在被评论区间内
- 或点击到高亮 span
- 激活对应线程
- 右侧评论栏自动滚动定位

## Empty Line Preservation

统一表面必须显式保留换行：

- 空段落
- 多个连续空行
- 只有换行的块

实现要求：

- DOM 渲染使用 `white-space: pre-wrap`
- 文本提取保留 `\n`
- 不允许阅读态再做额外折叠

## Migration Plan

### Phase 1

先抽离统一的基础工具：

- 文本 offset 计算
- 光标恢复
- 纯文本提取
- segment 渲染

### Phase 2

替换 `paragraph / heading / quote / code_block`

### Phase 3

替换 `bullet_list / ordered_list / check_list`

### Phase 4

删除旧的：

- 阅读态文本层特化逻辑
- `textarea` 相关文本块专用逻辑

## Acceptance Criteria

完成后必须满足：

1. 阅读/编辑模式下，同一文本块使用同一 DOM 机制。
2. 切换模式时，不再因为渲染分叉导致空行、评论高亮、块高度不一致。
3. 评论高亮在阅读/编辑模式下都可见、可点击、可定位。
4. 现有文本块功能全部保留：
   - Enter 拆块
   - Shift+Enter 换行
   - slash 命令
   - 粘贴结构化拆分
   - 图片粘贴上传
   - Arrow 导航
5. 自动化测试全部通过。
