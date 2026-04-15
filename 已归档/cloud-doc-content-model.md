# 云文档内容模型设计

## 1. 文档目标

本文档用于定义在线云文档产品中 `doc` 类型文档的内容模型设计，包括：
- 内容结构
- 块级节点设计
- 行内元素设计
- JSON 存储格式
- 数据库存储方案
- 版本管理方案
- 扩展到其他文档类型的机制

本文档对应的产品方向为：
- V1 只支持云文档 `doc`
- V1 不支持实时协同
- 表现层对齐飞书云文档
- 底层采用结构化节点模型
- 后续支持扩展 `sheet`、`board`、`form` 等文档类型

## 2. 总体设计原则

## 2.1 核心结论

`doc` 类型应采用“结构化文档树”模型。

具体原则如下：
- 表现层：连续文档式阅读与编辑体验
- 交互层：支持块级插入、块级操作、块级排序
- 存储层：使用结构化 JSON 表示整篇文档
- 平台层：文档能力与内容类型解耦

这意味着：
- 不使用整篇 HTML 作为唯一存储格式
- 不使用整篇 Markdown 字符串作为唯一存储格式
- 不做强 Notion 式卡片块系统
- 采用类似飞书云文档的“弱块化表现、强结构化底层”路线

## 2.2 为什么采用结构化文档树

如果把内容存成一整个 HTML 或 Markdown 字符串，会带来以下问题：
- 块级操作困难
- 模板片段插入不灵活
- 大纲生成复杂
- 版本 diff 粒度差
- 图片、表格、代码块等复杂内容处理困难
- 后续扩展评论、审阅、协同成本高

结构化文档树的优势：
- 易于支持复杂内容节点
- 易于做大纲、搜索、导入导出
- 易于做模板与片段复用
- 易于扩展其他文档类型
- 易于未来接入评论、审阅和协同能力

## 3. 内容模型整体结构

建议 `doc` 的内容模型遵循树形结构：

- 文档根节点
- 块级节点列表
- 行内节点或样式

可抽象为：

```json
{
  "type": "doc",
  "version": 1,
  "content": []
}
```

其中：
- `type` 表示内容模型类型
- `version` 表示 schema 版本
- `content` 表示顶层块级节点数组

## 4. 节点分层设计

建议将节点分为三层：
- 根节点
- 块级节点
- 行内节点/行内样式

## 4.1 根节点

根节点固定为：

```json
{
  "type": "doc",
  "version": 1,
  "content": []
}
```

职责：
- 承载整篇文档
- 作为 schema 入口
- 统一文档内容结构

## 4.2 块级节点

块级节点是文档中的一级内容单元。

### 首版建议支持的块级节点

- `paragraph`
- `heading`
- `bullet_list`
- `ordered_list`
- `task_list`
- `blockquote`
- `code_block`
- `horizontal_rule`
- `image`
- `table`

### 可后续扩展的块级节点

- `embed`
- `callout`
- `toggle`
- `file`
- `equation_block`
- `toc`
- `divider_with_text`

## 4.3 行内节点/行内样式

行内元素用于描述文本内部的语义和样式。

### 首版建议支持

- `text`
- `bold`
- `italic`
- `underline`
- `strike`
- `link`
- `inline_code`

### 可后续扩展

- `mention`
- `highlight`
- `comment_anchor`
- `equation_inline`

## 5. 块级节点详细设计

## 5.1 paragraph

用于承载普通正文段落。

示例：

```json
{
  "type": "paragraph",
  "content": [
    {
      "type": "text",
      "text": "这是一段正文"
    }
  ]
}
```

说明：
- 是最基础的文本块
- 支持行内样式和链接

## 5.2 heading

用于承载标题结构。

建议属性：
- `level`: `1 | 2 | 3`

示例：

```json
{
  "type": "heading",
  "attrs": {
    "level": 1
  },
  "content": [
    {
      "type": "text",
      "text": "产品需求文档"
    }
  ]
}
```

说明：
- 用于生成文档大纲
- V1 建议先支持 H1-H3

## 5.3 bullet_list

用于无序列表。

示例：

```json
{
  "type": "bullet_list",
  "content": [
    {
      "type": "list_item",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "列表项一"
            }
          ]
        }
      ]
    }
  ]
}
```

说明：
- 列表项内部仍是块结构，便于未来扩展嵌套内容

## 5.4 ordered_list

用于有序列表。

建议属性：
- `start`: 起始序号

## 5.5 task_list

用于待办列表。

任务项建议带属性：
- `checked`

示例：

```json
{
  "type": "task_list",
  "content": [
    {
      "type": "task_item",
      "attrs": {
        "checked": false
      },
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "完成首页设计"
            }
          ]
        }
      ]
    }
  ]
}
```

## 5.6 blockquote

用于引用内容。

说明：
- 可包含一个或多个段落

## 5.7 code_block

用于代码片段。

建议属性：
- `language`

示例：

```json
{
  "type": "code_block",
  "attrs": {
    "language": "python"
  },
  "content": [
    {
      "type": "text",
      "text": "print('hello')"
    }
  ]
}
```

## 5.8 horizontal_rule

用于分割线。

示例：

```json
{
  "type": "horizontal_rule"
}
```

## 5.9 image

用于图片块。

建议属性：
- `src`
- `alt`
- `width`
- `height`
- `align`
- `file_id`

示例：

```json
{
  "type": "image",
  "attrs": {
    "src": "https://cdn.example.com/demo.png",
    "alt": "示例图片",
    "width": 1200,
    "height": 800,
    "align": "center",
    "file_id": "file_123"
  }
}
```

说明：
- 图片实际资源建议存对象存储
- 文档内容中保存资源引用和展示属性

## 5.10 table

用于基础表格块。

注意：
- 这里是文档中的表格块，不是电子表格
- 只承担文档内结构化排版职责

建议结构：

```json
{
  "type": "table",
  "content": [
    {
      "type": "table_row",
      "content": [
        {
          "type": "table_cell",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "单元格内容"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

V1 建议只支持：
- 基础插入
- 行列增删
- 单元格文本输入

不支持：
- 公式
- 数据联动
- 冻结
- 筛选
- 排序

## 6. 行内元素设计

## 6.1 text

普通文本节点。

示例：

```json
{
  "type": "text",
  "text": "普通文本"
}
```

## 6.2 marks

建议用 `marks` 表示文本样式，而不是把每种样式做成独立节点。

示例：

```json
{
  "type": "text",
  "text": "加粗文本",
  "marks": [
    {
      "type": "bold"
    }
  ]
}
```

建议支持的 mark：
- `bold`
- `italic`
- `underline`
- `strike`
- `link`
- `inline_code`

链接示例：

```json
{
  "type": "text",
  "text": "打开官网",
  "marks": [
    {
      "type": "link",
      "attrs": {
        "href": "https://example.com"
      }
    }
  ]
}
```

## 7. JSON Schema 建议

不建议一开始就为每个节点写非常复杂的强校验 schema，但建议明确以下约束：

- 根节点必须为 `doc`
- 顶层 `content` 只能包含允许的块级节点
- `heading.level` 限制在约定范围内
- `table` 的嵌套层级受控
- `marks` 仅允许出现在文本节点上

建议采用：
- 编辑器内部 schema：由 ProseMirror/TipTap 管理
- 后端入库存储前：进行一次轻量结构校验

## 8. 数据库存储方案

建议文档元数据与文档内容分离。

### 8.0 当前开发环境数据库连接

当前开发环境使用 PostgreSQL，连接信息如下：

- Host：`localhost`
- Port：`5432`
- Username：`<your_db_user>`
- Password：`<your_db_password>`

连接串示例：

```text
postgresql://<your_db_user>:<your_db_password>@localhost:5432/clouddoc
```

说明：
- 当前默认示例库名为 `clouddoc`
- 后续实际业务库可单独创建并替换连接串中的数据库名
- 后续数据库操作默认可基于这组连接信息执行
- 若进入生产或共享环境，建议改为环境变量或密钥管理方式

## 8.1 documents 表

存储：
- 文档基础信息
- 所属空间
- 标题
- 类型
- 当前版本
- 权限归属

不存储完整正文内容。

## 8.2 document_contents 表

建议字段：
- `id`
- `document_id`
- `version_no`
- `content_json`
- `plain_text`
- `schema_version`
- `created_by`
- `created_at`

说明：
- `content_json` 存完整结构化文档树
- `plain_text` 存纯文本提取结果，用于搜索、摘要、索引
- `schema_version` 用于后续内容迁移

## 8.3 为什么要分表

优点：
- 文档元信息查询更轻
- 版本管理更清晰
- 搜索和索引更方便
- 后续不同类型文档更容易扩展

## 9. 版本管理设计

V1 不做协同。当前阶段仅保留版本数据模型和自动保存快照沉淀，历史版本查询、预览、对比和恢复先记录为后续需求，暂不实现产品功能入口。

## 9.1 版本原则

- 自动保存不等于正式版本
- 正式版本是某一时刻完整快照
- 恢复版本本质上是将旧内容复制为新版本

## 9.2 推荐方案

采用“快照式版本管理”：
- 每个正式版本对应一份完整 `content_json`
- 不在 V1 做复杂 patch/delta 存储

优点：
- 实现简单
- 恢复可靠
- 与导出、审计、备份兼容性好

## 9.3 自动保存与版本的关系

建议区分：
- 自动保存草稿
- 正式版本快照

策略示例：
- 自动保存写入当前内容
- 当前阶段每次保存可以沉淀快照数据
- 后续再增加版本列表、版本预览、手动命名版本和恢复版本能力
- 恢复版本时生成一个新的版本号，不直接覆盖或删除旧版本

## 10. 搜索与内容提取

为支持全文搜索，建议在保存 `content_json` 的同时提取：
- `plain_text`
- `outline`
- `summary`

### 10.1 plain_text

用途：
- 全文搜索
- 搜索摘要
- 相关推荐

### 10.2 outline

从标题节点中提取：
- heading level
- heading text
- position

用途：
- 文档大纲
- 搜索跳转

### 10.3 summary

可通过规则提取：
- 前若干段纯文本
- 或首个标题 + 正文摘要

用途：
- 列表页摘要展示

## 11. 编辑器实现建议

推荐技术路线：
- 编辑器框架：`TipTap`
- 底层模型：`ProseMirror`

原因：
- 非常适合结构化文档树
- 易于定义块级节点和行内 marks
- 易于后续扩展评论、审阅、协同
- 社区成熟度较高

### 11.1 表现层要求

- 视觉表现为连续文档
- 不突出每个块的容器边框
- 保持长文档阅读友好

### 11.2 交互层要求

- 支持 `/` 插入块
- 支持块级删除
- 支持块级移动
- 支持块级复制
- 支持标题自动生成大纲

### 11.3 不建议的做法

- 不建议以 HTML 字符串作为主存储
- 不建议把 Markdown 作为唯一真源
- 不建议把所有块渲染成明显卡片

## 12. 扩展到其他文档类型

虽然 V1 只有 `doc`，但模型必须服务于后续多文档类型扩展。

## 12.1 顶层资源模型

建议统一资源模型：

- `documents` 存文档资源元数据
- `document_type` 决定具体内容模型

例如：
- `doc`：结构化富文本树
- `sheet`：二维单元格模型
- `board`：自由布局画布模型
- `form`：字段配置模型

## 12.2 类型扩展原则

共享平台能力：
- 空间
- 权限
- 分享
- 收藏
- 回收站
- 搜索
- 版本

独立内容能力：
- 编辑器
- 内容 schema
- 渲染器
- 工具栏

## 12.3 内容存储兼容方式

建议采用统一字段：
- `document_type`
- `content_json`
- `schema_version`

不同类型通过：
- 类型适配器
- schema 校验器
- 渲染器注册机制

来完成差异化支持。

## 13. 首版推荐结论

`doc` 类型文档的最佳实现方式是：

- 视觉上：连续文档
- 交互上：支持块级操作
- 存储上：结构化文档树 JSON
- 架构上：与多文档类型平台兼容

这条路线最接近飞书云文档，也最适合当前产品目标。

## 14. 推荐的首版节点清单

### 块级节点

- `paragraph`
- `heading`
- `bullet_list`
- `ordered_list`
- `task_list`
- `blockquote`
- `code_block`
- `horizontal_rule`
- `image`
- `table`

### 行内 marks

- `bold`
- `italic`
- `underline`
- `strike`
- `link`
- `inline_code`

### 后续可扩展

- `mention`
- `comment_anchor`
- `embed`
- `callout`
- `file`
- `toggle`

## 15. 一句话定义

这套内容模型不是“整篇富文本字符串”，也不是“强 Notion 式卡片块系统”，而是：

“一种飞书风格的结构化文档树模型，底层节点化，前台连续文档化。”
