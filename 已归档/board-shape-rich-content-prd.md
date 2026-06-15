# 画板形状图文混排能力 PRD

## 0. 实施状态

2026-06-10 已取消实施并恢复：

- 根据当前产品取舍，取消普通画板形状内图片/图文混排支持。
- 普通画板形状恢复为只支持 `text` 文本；图片上传、图片粘贴、内容块编辑、图片缩放/排序等入口已从画板形状中移除。
- 画板内容保存版本恢复为 `version: 2`；新建画板和后端默认画板也恢复为 `version: 2`。
- 普通云文档图片上传、预览和对象存储配置不受影响。
- 本 PRD 保留为归档参考，不作为当前开发目标。

历史实现记录：

2026-06-10 已完成第一阶段实现：

- 普通画板形状新增 `content` 块数组，支持 `paragraph` 和 `image`。
- 旧 `text + image` 节点运行时兼容迁移为图文内容块。
- 形状内支持多段文本、多张图片、图文穿插顺序展示。
- 双击形状进入内容编辑；Enter 新增段落；空段落 Backspace 删除；Esc 或点击画布空白提交退出。
- 编辑态支持插入图片、粘贴图片、图片上移/下移/删除、拖拽右下角缩放图片。
- 图片块支持在形状内容内部拖拽排序，可拖到其他图片或段落前后。
- 内容超出形状高度时在形状内部滚动，不撑开节点、不遮挡其他节点。
- 保存、本地草稿和手动保存都会合并当前编辑态内容，画板内容版本升级到 `version: 3`。
- 后端资源引用回归测试覆盖 `nodes[*].content[*].src`，确保新格式图片能参与引用保护和后续回收。

已知边界：

- 第一阶段仍是块级图文混排，不支持文字环绕图片和同一行 inline image。
- 图片拖拽排序限定在形状内容编辑态内，缩放手柄和画板节点拖拽互不复用事件。
- 表格形状继续使用独立 `table` 模型，不启用形状富内容。

## 1. 背景

当前画板形状已经支持基础文字、单张图片和表格形状：

- 普通形状使用 `BoardNode.text` 存储纯文本。
- 普通形状可选 `BoardNode.image`，渲染为固定的“上方图片 + 下方文字”布局。
- 表格形状使用 `BoardNode.table`，有独立的单元格模型。
- 上传图片已经接入 `/api/documents/upload-image`，并且资源引用回收已能识别 `node.image.src`。

这个实现能满足“一个形状里放一张图和一段文字”的场景，但不能满足用户明确要求的“像富文本那样在同一个形状文本里任意插入多张图片、图片和文字穿插排版、图文段落自由编辑、图片可在形状内部单独拖动/缩放”。

## 2. 目标

在不破坏现有画板节点、连线、表格、复制粘贴、保存和资源回收能力的前提下，为普通画板形状增加轻量富内容能力。

用户可以在一个普通形状内部：

- 插入多段文本。
- 插入多张图片。
- 在文本段落之间插入图片，实现图文穿插。
- 调整图片在形状内部的顺序。
- 调整图片显示尺寸。
- 编辑文本段落内容。
- 在只读模式下完整查看形状内部图文内容。
- 超出形状高度时在形状内部滚动，而不是溢出遮挡其他画板元素。

## 3. 非目标

第一阶段不实现以下能力：

- 不实现 Word/飞书文档级别的复杂富文本引擎。
- 不实现文字环绕图片。
- 不实现一行文字中间插入 inline image。
- 不实现复杂 marks 嵌套，例如同一段内局部加粗、局部链接、局部颜色。
- 不实现图片在形状内部的任意绝对定位。
- 不实现多个形状之间共享同一个富文本编辑上下文。
- 不把普通云文档块编辑器直接嵌入画板形状，避免引入过重依赖和事件冲突。

## 4. 现有方案对比

### 4.1 现有 `text + image` 方案

数据模型：

```ts
type BoardNode = {
  text: string;
  image?: {
    src: string;
    fileName?: string;
    mimeType?: string;
    objectFit?: "cover" | "contain";
  };
};
```

优点：

- 数据结构简单。
- 渲染逻辑简单。
- 图片引用回收容易。
- 对现有复制粘贴和保存影响小。

问题：

- 一个形状最多只能有一张图片。
- 图片位置固定在文本上方。
- 不能在多段文字之间穿插图片。
- 图片不能在形状内部单独选中、缩放或排序。
- 文本编辑仍是 textarea，无法承载块级内容。

### 4.2 备选方案 A：继续扩展 `image` 字段

把 `image` 改为 `images: BoardNodeImage[]`，然后用固定布局展示多图。

优点：

- 改动较小。
- 资源引用扩展简单。

缺点：

- 仍然无法表达“段落、图片、段落、图片”的顺序。
- 仍然不是图文混排。
- 后续再演进会产生二次迁移。

结论：不推荐。

### 4.3 备选方案 B：嵌入普通云文档块编辑器

在形状内部复用普通云文档的块编辑器。

优点：

- 功能完整，已有文本块、图片块、代码块等能力。
- 长期可以统一文档与画板内容模型。

缺点：

- 画板形状运行在 SVG/foreignObject 混合场景，普通文档编辑器依赖页面流式布局，直接嵌入容易产生焦点、拖拽、快捷键、评论、选区和滚动冲突。
- 普通文档块功能过重，形状内部不需要标题层级、代码块、链接预览等完整能力。
- 一次性改造风险高，容易影响画板节点拖拽和表格编辑。

结论：不作为第一阶段方案。

### 4.4 推荐方案 C：形状轻量富内容模型

为普通形状新增 `content` 字段，使用轻量块数组表达形状内部内容顺序。

```ts
type BoardNodeContentBlock =
  | {
      id: string;
      type: "paragraph";
      text: string;
    }
  | {
      id: string;
      type: "image";
      src: string;
      fileName?: string;
      mimeType?: string;
      width?: number;
      height?: number;
      objectFit?: "cover" | "contain";
    };

type BoardNode = {
  text: string;
  image?: BoardNodeImage;
  content?: BoardNodeContentBlock[];
};
```

优点：

- 能准确表达图文穿插顺序。
- 第一阶段模型足够小，风险可控。
- 能兼容旧 `text + image` 数据。
- 能独立实现形状内部图片选择、排序、缩放。
- 后续可扩展 `heading`、`list`、`divider`、`code` 等块类型。

缺点：

- 需要新增形状内部编辑器。
- 需要扩展保存、复制粘贴、资源引用、只读渲染和高度计算。
- 需要明确事件边界，避免和画板拖拽冲突。

结论：推荐采用。

## 5. 用户故事

### 5.1 插入多张图片

作为画板用户，我希望在一个形状中连续插入多张图片，并能在图片之间添加说明文字。

验收：

- 选中普通形状后，工具栏提供“插入图片”。
- 插入图片后，图片作为一个独立内容块出现在当前光标附近或内容末尾。
- 可以继续插入第二张、第三张图片。

### 5.2 图文穿插编辑

作为画板用户，我希望图片可以夹在文字段落之间。

验收：

- 形状内容可以呈现“文本、图片、文本、图片、文本”。
- 用户可以点击段落编辑文字。
- 用户可以在图片前后新增文本段落。

### 5.3 图片内部缩放

作为画板用户，我希望只调整形状内部某张图片的显示大小，不影响整个形状大小。

验收：

- 点击形状内部图片后，图片显示选中边框。
- 拖动图片右下角控制点可以调整图片显示高度和宽度。
- 图片尺寸不能超过形状内部内容区域宽度。
- 图片最小高度不低于 40px。

### 5.4 内容超出时内部滚动

作为画板用户，我希望形状内容多的时候不会遮挡其他图形。

验收：

- 内容高度超过形状高度时，形状内部出现滚动区域。
- 节点外框大小不被内容强制撑开，除非用户选择自动扩高。
- 画板拖拽节点时不触发形状内部滚动。

## 6. 数据模型设计

### 6.1 新增类型

```ts
type BoardNodeContentParagraph = {
  id: string;
  type: "paragraph";
  text: string;
};

type BoardNodeContentImage = {
  id: string;
  type: "image";
  src: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  objectFit?: "cover" | "contain";
};

type BoardNodeContentBlock =
  | BoardNodeContentParagraph
  | BoardNodeContentImage;
```

### 6.2 `BoardNode` 扩展

```ts
type BoardNode = {
  text: string;
  image?: BoardNodeImage;
  content?: BoardNodeContentBlock[];
};
```

### 6.3 兼容策略

读取旧节点时：

- 如果 `node.content` 是合法数组，则优先使用 `content`。
- 如果没有 `content`，但存在 `node.image` 或 `node.text`，则运行时转换为内容块：
  - `node.image` 转为 `image` 块。
  - `node.text` 转为 `paragraph` 块。
- `node.text` 仍保留为摘要文本，用于搜索、AI 读取、旧版本兼容和复制降级。
- `node.image` 仍保留旧字段一段时间，但新编辑器不再以它作为主数据源。

保存新节点时：

- 新内容写入 `node.content`。
- `node.text` 同步为所有 paragraph 文本拼接后的纯文本。
- 如果 `content` 中只有一张图片且没有 paragraph，可以选择同步 `node.image`；如果存在多张图或图文穿插，则不再同步单张 `node.image`，避免表达错误。

### 6.4 数据版本

画板当前 `version` 为 `2`。引入形状富内容后建议升级为 `3`。

```json
{
  "type": "board",
  "version": 3,
  "nodes": [
    {
      "id": "node_1",
      "type": "rectangle",
      "text": "第一段\\n第二段",
      "content": [
        { "id": "c1", "type": "paragraph", "text": "第一段" },
        { "id": "c2", "type": "image", "src": "/uploads/a.png", "width": 220, "height": 120, "objectFit": "cover" },
        { "id": "c3", "type": "paragraph", "text": "第二段" }
      ]
    }
  ]
}
```

## 7. 交互设计

### 7.1 进入编辑

- 单击形状：选中形状。
- 双击形状：进入形状内容编辑。
- 已选中形状时按 Enter：进入形状内容编辑。
- 编辑中点击形状外：提交内容并退出编辑。
- Esc：提交当前编辑并退出编辑。

原因：

- 保持现有“单击选择、拖拽移动”的画板习惯。
- 避免单击文本区域就抢走画板选择态。

### 7.2 编辑器结构

编辑态使用 `foreignObject` 内的轻量 DOM 编辑器。

结构：

```text
Shape
  RichContentSurface
    ParagraphBlock
    ImageBlock
    ParagraphBlock
```

段落块：

- 使用 `textarea` 或 `contenteditable` 的轻量封装。
- 第一阶段推荐 `textarea`，每个 paragraph 一个 textarea，降低选区复杂度。
- Enter 在当前段落后新增 paragraph。
- Backspace 在空 paragraph 时删除该段落。

图片块：

- 显示图片。
- 点击图片块选中图片。
- 选中后显示边框和右下角 resize handle。
- 拖动 resize handle 修改 `width`/`height`。
- 图片块上方或悬浮菜单提供删除、上移、下移。

### 7.3 插入图片

入口：

- 形状选中工具栏的“图”按钮。
- 编辑态内部的“插入图片”按钮。
- 编辑态粘贴图片文件。

插入位置：

- 如果正在编辑某个 paragraph，则插入到当前段落后。
- 如果当前选中某张图片，则插入到该图片后。
- 如果没有编辑焦点，则插入到内容末尾。

### 7.4 图片排序

第一阶段提供按钮式排序：

- 上移。
- 下移。
- 删除。

不优先做拖拽排序，原因是画板节点拖拽、图片 resize、内容滚动三类指针事件容易冲突。后续如果需要，可以在内容编辑态内增加拖拽排序。

### 7.5 图片缩放

图片块尺寸规则：

- `width` 默认填满形状内部内容宽度。
- `height` 默认按图片初始显示比例或 120px。
- 宽度不能超过内容区宽度。
- 高度范围：40px 到 800px。
- 拖拽 resize 时阻止事件冒泡，不能触发节点拖拽。

### 7.6 只读渲染

只读模式下：

- 使用同一套块顺序渲染。
- 文本不可编辑。
- 图片不可 resize。
- 内容超出形状时可滚动查看。
- 不显示编辑工具栏。

## 8. 对现有功能的影响

### 8.1 节点选择和拖拽

风险：

- 点击形状内部内容可能误触发节点拖拽。
- 图片 resize 可能误触发节点 resize。

防护：

- 普通选择态下，内容层不接管指针事件，只允许选中节点。
- 只有进入内容编辑态后，内容块才接管指针事件。
- 内容块所有 `pointerdown` 都 `stopPropagation`，避免冒泡到 SVG 节点拖拽。

### 8.2 文本编辑

风险：

- 现有 `editingNodeId + editingText` 是单一 textarea 模型，不支持多块内容。

改造：

- 保留旧文本编辑逻辑作为 fallback。
- 新增 `editingRichNodeId`、`editingContent`、`selectedContentBlockId`。
- 对存在 `content` 的节点使用富内容编辑器。
- 对旧纯文本节点进入编辑时临时迁移为一个 paragraph。

### 8.3 节点高度计算

风险：

- 现有 `fitNodeHeightToText` 只根据纯文本估算高度。
- 富内容如果继续使用旧高度计算，会导致图片溢出。

改造：

- 新增 `requiredNodeHeightForContent(node)`。
- 如果节点 `manualSize=false`，编辑完成后可按内容自动扩高。
- 如果 `manualSize=true`，保持用户手动尺寸，内部滚动。
- 图片 block 高度纳入内容高度计算。

### 8.4 复制粘贴

风险：

- 现有画板内部复制节点需要完整复制 `content`。
- 复制节点内图片不应重新上传，只复制引用。
- 粘贴图片到编辑态应插入内容块；粘贴图片到普通选中态仍可以插入到形状内容末尾。

改造：

- `cloneBoardNode` 或粘贴逻辑需要深拷贝 `content`。
- 复制节点时保留图片 URL。
- 粘贴图片文件时调用上传接口并插入 `image` block。
- 文本输入/段落编辑态内保留原生文本复制粘贴行为。

### 8.5 保存和撤销重做

风险：

- 内容块编辑需要进入现有 `commitBoard`，否则撤销重做不完整。
- resize 图片频繁提交会污染历史。

改造：

- 文本修改可在编辑态本地状态中进行，blur/退出编辑时一次 `commitBoard`。
- 图片 resize 开始时记录初始快照，拖动过程更新本地状态，结束时一次提交。
- 插入/删除/排序图片可以立即 `commitBoard`。

### 8.6 资源引用和垃圾回收

风险：

- 当前资源引用已识别 `node.image.src`。
- 新图片会在 `node.content[].src`，如果不扩展引用收集，删除/回收会出错。

改造：

- 后端 `collect_asset_refs_from_content` 增加扫描：
  - `nodes[*].content[*].src`
  - `nodes[*].content[*].url` 作为兼容字段
- source_path 使用类似：
  - `nodes[3].content[1].src`
- 删除形状、删除图片块、更新内容后都依赖当前版本内容同步引用。

### 8.7 AI 和 MCP 读取

风险：

- AI 结构化读取如果只读 `node.text`，会丢失图片顺序。

改造：

- Markdown/AI view 中为节点增加 `content` 摘要：
  - paragraph 输出文本。
  - image 输出 `[image: fileName](src)`。
- `node.text` 仍作为纯文本摘要。

### 8.8 评论和选区

第一阶段不做形状内部内容级评论。

影响：

- 现有画板对象评论仍绑定节点。
- 选中内容块不会产生独立评论锚点。

### 8.9 表格形状

表格形状第一阶段不支持 `content`。

原因：

- 表格已有独立 `table` 模型和单元格编辑。
- 同时支持表格和富内容会造成模型冲突。

规则：

- `type === "table"` 时忽略 `content`。
- 迁移时不对表格节点生成富内容。

## 9. 组件与代码拆分建议

当前 `board-document-page.tsx` 文件较大。为降低风险，建议新增独立组件和工具文件：

```text
apps/web/components/board/
  board-document-page.tsx
  board-rich-content-types.ts
  board-rich-content-utils.ts
  board-rich-content-surface.tsx
```

职责：

- `board-rich-content-types.ts`：类型定义。
- `board-rich-content-utils.ts`：normalize、迁移、纯文本摘要、资源 URL 提取、尺寸计算。
- `board-rich-content-surface.tsx`：编辑态和只读态富内容渲染。
- `board-document-page.tsx`：只负责接入节点选择、提交、上传和工具栏入口。

## 10. 实施步骤

### 阶段 1：数据模型和只读渲染

- 增加 `BoardNodeContentBlock` 类型。
- 增加 normalize/migrate 工具。
- 旧 `text + image` 转换为 `content`。
- 只读态按 `content` 渲染。
- 保持旧 `renderNodeImage` / `renderNodeText` fallback。

验收：

- 老画板不丢内容。
- 新格式能显示多段文字和多张图片。
- 超出形状高度时内部滚动。

### 阶段 2：编辑器

- 双击进入富内容编辑。
- 段落编辑、新增、删除。
- 插入图片 block。
- 图片删除、上移、下移。
- 退出编辑时提交。

验收：

- 能创建“文字、图片、文字、图片”的内容。
- 编辑态不触发节点拖拽。
- 退出后保存内容。

### 阶段 3：图片 resize

- 图片块选中态。
- 右下角 resize handle。
- 更新 block 尺寸。
- 限制最小/最大尺寸。

验收：

- 图片可在形状内部缩放。
- 缩放图片不改变节点大小。
- 缩放过程不触发画板拖拽。

### 阶段 4：资源引用和 AI 输出

- 后端资源引用扫描支持 `node.content[].src`。
- AI/Markdown 读取支持输出内容块顺序。
- 测试删除图片块后的引用回收。

验收：

- 新格式图片不会被误删。
- 删除图片块后过保留窗口可回收。
- AI 读取可看到图文顺序。

## 11. 测试计划

### 11.1 单元/后端测试

- `collect_asset_refs_from_content` 能识别 `node.content[].src`。
- 删除富内容图片块后，旧版本保留窗口内不删除文件。
- 保留窗口后无引用图片可被清理。

### 11.2 前端构建检查

- `apps/web npm run build`。
- `git diff --check`。

### 11.3 Playwright 手动回归建议

场景 1：旧数据兼容

- 创建旧格式节点：`text + image`。
- 打开画板。
- 确认显示为图片 + 文本。
- 保存后内容不丢失。

场景 2：图文穿插

- 新建矩形。
- 双击进入编辑。
- 输入第一段。
- 插入图片。
- 输入第二段。
- 再插入图片。
- 保存刷新。
- 确认顺序不变。

场景 3：事件冲突

- 编辑态拖动图片 resize handle。
- 确认节点不移动。
- 退出编辑态拖动节点。
- 确认节点正常移动。

场景 4：复制粘贴

- 复制带富内容的形状。
- 粘贴到鼠标位置。
- 确认新节点图文内容完整。
- 确认图片 URL 保留。

场景 5：只读和分享

- 打开只读模式或分享链接。
- 确认图文内容可查看。
- 确认不能编辑、不能 resize 图片。

## 12. 风险和规避

### 风险 1：foreignObject 浏览器兼容和滚动体验

规避：

- 继续沿用现有文本编辑使用的 foreignObject 技术路线。
- 滚动区域只在内容层内部出现。
- 关键交互通过 Playwright 验证。

### 风险 2：和节点拖拽冲突

规避：

- 内容块编辑只在 `editingRichNodeId` 状态下启用 pointer events。
- 编辑态内部 pointer 事件全部阻止冒泡。

### 风险 3：数据迁移导致旧画板丢失

规避：

- normalize 时只做运行时兼容，不批量改库。
- 保存时保留 `text` 摘要。
- 旧 `image` fallback 至少保留两个版本周期。

### 风险 4：资源引用漏扫

规避：

- 后端引用扫描和测试先于大规模上线。
- 明确扫描路径 `nodes[*].content[*].src`。

### 风险 5：文件过大导致维护困难

规避：

- 新逻辑拆到 `board-rich-content-*` 文件。
- `board-document-page.tsx` 只做集成。

## 13. 验收标准

功能验收：

- 一个普通形状内可创建至少 3 段文本和 3 张图片。
- 图片可以位于任意两个文本段落之间。
- 图片可以独立删除、上移、下移、缩放。
- 形状内部内容超出时内部滚动，不遮挡其他节点。
- 保存刷新后内容顺序、图片尺寸和文本保持一致。
- 复制粘贴带富内容形状后内容完整。
- 分享/只读模式可查看但不可编辑。

兼容验收：

- 旧 `text` 节点仍能显示和编辑。
- 旧 `image + text` 节点仍能显示。
- 表格形状不受影响。
- 连接线、节点拖拽、节点 resize、多选复制粘贴不回退。

质量验收：

- 前端构建通过。
- 后端资源引用测试通过。
- `git diff --check` 通过。
- 本地 3100 服务可访问。

## 14. 推荐落地范围

第一版建议只做“块级图文混排”：

- paragraph block。
- image block。
- 图片上移/下移/删除/缩放。
- 内部滚动。
- 资源引用支持。
- 旧数据兼容。

第二版再考虑：

- 列表 block。
- 标题 block。
- 图片拖拽排序。
- 图片点击预览。
- 节点内部内容级评论。
- 与普通云文档块模型进一步统一。
