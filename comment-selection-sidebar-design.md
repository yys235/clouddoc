# 文本选区评论侧栏设计

## 1. 目标

在文档中，用户可以选中任意一段文本并添加评论。评论创建后：

- 文本选区在正文中高亮
- 评论线程显示在页面右侧固定评论栏
- 点击正文高亮区可定位到对应评论
- 点击右侧评论可反向定位到正文选区
- 支持回复、已解决、重新打开

本设计参照视频中的交互形态：

- 选中文本后出现浮动工具栏
- 工具栏中提供“评论”入口
- 右侧是固定评论侧栏
- 创建评论后，评论卡片出现在右侧对应位置
- 评论输入框位于线程卡片底部

## 2. 视频拆解出的关键交互

### 2.1 入口

- 用户在正文中拖选一段文本
- 选区出现浮动工具栏
- 工具栏包含“评论”按钮

### 2.2 创建评论

- 点击“评论”后，右侧评论栏创建一条新线程
- 线程顶部显示当前锚点对应的文本摘要
- 输入框获得焦点
- 用户输入评论并发送

### 2.3 展示方式

- 页面右侧始终有评论栏
- 当前文档的评论按线程展示
- 评论线程卡片带锚点摘要、作者、时间、正文、回复区
- 已有评论时，右上角评论计数更新

### 2.4 交互联动

- 点击正文高亮锚点，右侧滚动并激活对应评论线程
- 点击右侧评论线程，正文滚动并聚焦对应选区
- 选区内容变更后，锚点可尽量恢复；失败时标记为失效锚点

## 3. 当前产品里怎么接入

当前项目已经有：

- 块编辑器
- 阅读/编辑两种模式
- 文档右侧尚未固定评论栏

推荐实现策略：

- `V1` 先只在阅读模式启用“选区评论”
- 评论侧栏始终显示在文档页右侧
- 编辑模式下先不开放创建评论，只允许查看评论

原因：

- 编辑模式下文本频繁变动，锚点漂移处理更复杂
- 阅读模式文本更稳定，先做可用闭环更稳
- 后续再扩展到编辑模式评论

## 4. 页面布局设计

文档页改成三栏：

1. 左侧目录栏
2. 中间文档正文
3. 右侧评论栏

建议宽度：

- 左侧目录：`260px`
- 中间正文：`minmax(0, 1fr)`
- 右侧评论栏：`320px ~ 360px`

右侧评论栏样式：

- 固定在文档页右侧
- 独立滚动
- 顶部显示：`评论 (N)`
- 空状态显示“选中文本后可添加评论”

## 5. 功能拆分

### 5.1 选区捕获

在阅读模式正文区域监听：

- `mouseup`
- `selectionchange`

拿到：

- `Selection`
- 起始节点/结束节点
- 选中文本内容
- 客户端矩形位置

只在以下条件成立时允许创建评论：

- 选区非空
- 选区在正文容器内
- 不是跨文档区域
- 不是评论栏本身

### 5.2 浮动评论工具条

当存在有效选区时：

- 在选区附近显示小型浮动条
- 提供一个主按钮：`评论`

V1 不需要复刻完整富文本工具栏，只做：

- `添加评论`
- `取消`

### 5.3 评论锚点模型

评论不能只存“选中的文字”，否则文档一变就找不到。

建议锚点存 4 层信息：

1. `block_id`
2. `start_offset`
3. `end_offset`
4. `quote_text`

可选再存：

- `prefix_text`
- `suffix_text`

这样后续可以做锚点恢复。

### 5.4 右侧评论线程

一条线程结构：

- 线程锚点摘要
- 评论列表
- 回复输入框
- 解决/重开按钮

线程状态：

- `open`
- `resolved`

### 5.5 正文高亮

正文渲染时，根据评论锚点对对应文本做 mark 包裹：

- 未选中线程：浅黄色高亮
- 当前激活线程：更深高亮

### 5.6 双向定位

正文 -> 评论：

- 点击高亮文本
- 右侧评论栏滚动到对应线程
- 线程卡片高亮

评论 -> 正文：

- 点击线程卡片
- 正文滚动到对应锚点
- 临时闪烁高亮

## 6. 数据模型设计

### 6.1 comment_threads

- `id`
- `document_id`
- `anchor_block_id`
- `anchor_start_offset`
- `anchor_end_offset`
- `quote_text`
- `prefix_text`
- `suffix_text`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### 6.2 comments

- `id`
- `thread_id`
- `document_id`
- `author_id`
- `body`
- `is_deleted`
- `created_at`
- `updated_at`

### 6.3 thread_participants

- `id`
- `thread_id`
- `user_id`
- `last_read_at`

## 7. 前端实现设计

### 7.1 组件拆分

建议新增组件：

- `comment-sidebar.tsx`
- `comment-thread-card.tsx`
- `comment-composer.tsx`
- `selection-comment-toolbar.tsx`
- `document-comment-highlights.tsx`

### 7.2 状态设计

文档页新增状态：

- `selectedRange`
- `pendingCommentAnchor`
- `activeThreadId`
- `threads`
- `commentsByThread`

### 7.3 关键数据结构

```ts
type CommentAnchor = {
  blockId: string;
  startOffset: number;
  endOffset: number;
  quoteText: string;
  prefixText?: string;
  suffixText?: string;
};

type CommentThread = {
  id: string;
  documentId: string;
  anchor: CommentAnchor;
  status: "open" | "resolved";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type CommentItem = {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  createdAt: string;
};
```

## 8. 后端接口设计

### 8.1 获取评论

`GET /api/documents/{id}/comment-threads`

返回：

- 线程列表
- 线程下评论

### 8.2 创建线程

`POST /api/documents/{id}/comment-threads`

请求体：

```json
{
  "anchor": {
    "block_id": "block-1",
    "start_offset": 12,
    "end_offset": 24,
    "quote_text": "这里是一段被评论的文本",
    "prefix_text": "前文",
    "suffix_text": "后文"
  },
  "comment": {
    "body": "这里需要补充说明"
  }
}
```

### 8.3 回复评论

`POST /api/comment-threads/{threadId}/comments`

### 8.4 更新线程状态

`PATCH /api/comment-threads/{threadId}`

请求体：

```json
{
  "status": "resolved"
}
```

## 9. 与现有块编辑器的衔接

当前文档内容是块模型：

- 段落
- 标题
- 列表
- 检查项
- 引用
- 代码块

评论锚点建议先只支持这些文本型块：

- `paragraph`
- `heading`
- `quote`
- `bullet_list`
- `ordered_list`
- `check_list`

V1 暂不支持在这些块上创建评论：

- `divider`
- `image`
- `link card`
- `pdf`

## 10. 渲染策略

因为当前项目正文是块级 `textarea/readOnly textarea` 混合方案，选区评论最好先落在“阅读模式文本渲染层”。

推荐做法：

- 阅读模式下，将每个文本块拆成可定位文本片段
- 基于线程锚点对文本做分段渲染
- 用 `<mark>` 或 `<span data-thread-id>` 包裹命中区间

不要在 V1 里直接做真正的富文本 range mutation，否则复杂度过高。

## 11. 边界问题

### 11.1 文本变更后锚点失效

若正文改动后原 offset 不再可靠：

- 先尝试通过 `quote_text + prefix + suffix` 恢复
- 恢复失败则将线程标记为“锚点失效”

### 11.2 多块跨选区

V1 不建议支持跨多个块的选区评论。

限制为：

- 一次评论只能锚到单个块内的文本区间

原因：

- 渲染更简单
- 存储更稳
- 跟视频里的常见使用方式也一致

### 11.3 评论排序

右侧评论栏建议默认按正文位置排序，而不是按时间排序。

更符合用户阅读和修订习惯。

## 12. 推荐实施顺序

### P0

- 右侧评论栏布局
- 阅读模式单块文本选区捕获
- 创建评论线程
- 评论列表展示
- 正文高亮
- 双向定位

### P1

- 回复
- 已解决/重开
- 评论计数
- 锚点恢复

### P2

- 编辑模式评论
- @人
- 评论通知
- 已解决线程折叠

## 13. 结论

可以实现，而且和当前项目的块模型并不冲突。

最稳的路线是：

- 先做“阅读模式下单块文本评论”
- 右侧固定评论栏
- 锚点用 `block_id + offsets + quote_text`
- 评论线程按正文位置排序

这样能比较低风险地做出和视频接近的体验。
