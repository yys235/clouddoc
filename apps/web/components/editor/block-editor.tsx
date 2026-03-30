"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type EditableBlockType =
  | "paragraph"
  | "heading"
  | "bullet_list"
  | "ordered_list"
  | "check_list"
  | "quote"
  | "divider"
  | "link"
  | "image"
  | "code_block";

export type EditableBlock = {
  id: string;
  type: EditableBlockType;
  text: string;
};

type BlockCommand = {
  type: EditableBlockType;
  label: string;
  shortLabel: string;
  description: string;
  keywords: string[];
};

const BLOCK_COMMANDS: BlockCommand[] = [
  {
    type: "paragraph",
    label: "正文",
    shortLabel: "T",
    description: "普通正文段落",
    keywords: ["text", "paragraph", "body", "p"],
  },
  {
    type: "heading",
    label: "标题",
    shortLabel: "H1",
    description: "章节标题和大纲节点",
    keywords: ["heading", "title", "h1", "h2"],
  },
  {
    type: "bullet_list",
    label: "列表",
    shortLabel: "•",
    description: "无序列表，每行一个条目",
    keywords: ["list", "bullet", "ul"],
  },
  {
    type: "ordered_list",
    label: "有序列表",
    shortLabel: "1.",
    description: "有序列表，每行一个条目",
    keywords: ["ordered", "number", "list", "ol"],
  },
  {
    type: "check_list",
    label: "检查项",
    shortLabel: "[]",
    description: "任务清单，支持 [x] 和 [ ]",
    keywords: ["check", "todo", "task", "checkbox"],
  },
  {
    type: "quote",
    label: "引用",
    shortLabel: "❝",
    description: "强调引用内容",
    keywords: ["quote", "blockquote"],
  },
  {
    type: "divider",
    label: "分割线",
    shortLabel: "—",
    description: "插入一条分割线",
    keywords: ["divider", "line", "hr"],
  },
  {
    type: "link",
    label: "链接",
    shortLabel: "↗",
    description: "链接标题和地址",
    keywords: ["link", "url", "href"],
  },
  {
    type: "image",
    label: "图片",
    shortLabel: "🖼",
    description: "图片地址和说明",
    keywords: ["image", "img", "picture"],
  },
  {
    type: "code_block",
    label: "代码",
    shortLabel: "{}",
    description: "多行代码片段",
    keywords: ["code", "snippet", "pre"],
  },
];

function textAreaClassName(type: EditableBlockType) {
  if (type === "heading") {
    return "min-h-0 text-2xl font-semibold leading-tight tracking-tight text-slate-900";
  }

  if (type === "divider") {
    return "min-h-0 text-sm leading-6 text-slate-400";
  }

  if (type === "link") {
    return "min-h-0 px-0 py-0 text-base leading-8 text-slate-700";
  }

  if (type === "image") {
    return "min-h-0 px-0 py-0 text-base leading-8 text-slate-700";
  }

  if (type === "code_block") {
    return "min-h-0 px-0 py-0 font-mono text-sm leading-7 text-slate-700";
  }

  if (type === "quote") {
    return "min-h-0 px-0 py-0 text-base leading-8 text-slate-600";
  }

  if (type === "check_list") {
    return "min-h-0 text-base leading-8 text-slate-700";
  }

  return "min-h-0 text-base leading-8 text-slate-700";
}

function placeholderByType(type: EditableBlockType) {
  if (type === "heading") {
    return "输入标题块";
  }

  if (type === "bullet_list") {
    return "每行一个列表项";
  }

  if (type === "ordered_list") {
    return "每行一个条目，自动按顺序渲染";
  }

  if (type === "check_list") {
    return "每行一个检查项，支持 [ ] 和 [x]";
  }

  if (type === "quote") {
    return "输入引用内容";
  }

  if (type === "divider") {
    return "输入 --- 或直接保留为空";
  }

  if (type === "link") {
    return "标题 | https://example.com";
  }

  if (type === "image") {
    return "图片说明 | https://example.com/image.png";
  }

  if (type === "code_block") {
    return "输入代码块";
  }

  return "输入正文，或输入 / 打开命令";
}

function labelByType(type: EditableBlockType) {
  return BLOCK_COMMANDS.find((item) => item.type === type)?.label ?? "正文";
}

function defaultTextByType(type: EditableBlockType) {
  return "";
}

function commandQuery(text: string) {
  const normalized = text
    .trim()
    .replace(/^\[(x|X| )\]\s*/, "")
    .trim();
  if (!normalized.startsWith("/")) {
    return null;
  }

  if (normalized.includes(" ")) {
    return null;
  }

  return normalized.slice(1).toLowerCase();
}

function filterCommands(query: string) {
  if (!query) {
    return BLOCK_COMMANDS;
  }

  return BLOCK_COMMANDS.filter((command) => {
    const haystacks = [command.label, command.description, ...command.keywords]
      .join(" ")
      .toLowerCase();
    return haystacks.includes(query);
  });
}

function fallbackSplitText(type: EditableBlockType) {
  return "";
}

function rowsByType(type: EditableBlockType, text: string) {
  if (type === "divider") {
    return 1;
  }

  return Math.max(text.split("\n").length, type === "code_block" ? 4 : 1);
}

function isEmptyBlock(block: EditableBlock) {
  return block.text.trim().length === 0;
}

function displayTextForBlock(block: EditableBlock, readOnly: boolean) {
  if (!readOnly) {
    return block.text;
  }

  if (block.type === "link" || block.type === "image") {
    return block.text.replace(/\s*\|\s*$/, "");
  }

  return block.text;
}

export function BlockEditor({
  blocks,
  onChange,
  readOnly = false,
}: {
  blocks: EditableBlock[];
  onChange: (blocks: EditableBlock[]) => void;
  readOnly?: boolean;
}) {
  const [commandMenu, setCommandMenu] = useState<{
    blockId: string;
    mode: "slash" | "actions";
    query: string;
    selectedIndex: number;
  } | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{
    blockId: string;
    caret: number;
  } | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [visibleToolbarBlockId, setVisibleToolbarBlockId] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const hideToolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideToolbarTimerRef.current) {
        clearTimeout(hideToolbarTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingFocus) {
      return;
    }

    const textarea = textareaRefs.current[pendingFocus.blockId];
    if (!textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(pendingFocus.caret, pendingFocus.caret);
    setPendingFocus(null);
  }, [blocks, pendingFocus]);

  const updateBlock = (blockId: string, patch: Partial<EditableBlock>) => {
    onChange(blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  };

  const showToolbar = (blockId: string) => {
    if (hideToolbarTimerRef.current) {
      clearTimeout(hideToolbarTimerRef.current);
      hideToolbarTimerRef.current = null;
    }
    setVisibleToolbarBlockId(blockId);
  };

  const hideToolbarWithDelay = (blockId: string) => {
    if (hideToolbarTimerRef.current) {
      clearTimeout(hideToolbarTimerRef.current);
    }
    hideToolbarTimerRef.current = setTimeout(() => {
      setVisibleToolbarBlockId((current) => (current === blockId ? null : current));
      hideToolbarTimerRef.current = null;
    }, 1500);
  };

  const focusBlock = (blockId: string, caret: number) => {
    setPendingFocus({ blockId, caret });
  };

  const insertBlock = (index: number, type: EditableBlockType = "paragraph") => {
    const nextBlocks = [...blocks];
    nextBlocks.splice(index, 0, {
      id: crypto.randomUUID(),
      type,
      text: defaultTextByType(type),
    });
    onChange(nextBlocks);
  };

  const removeBlock = (blockId: string) => {
    const nextBlocks = blocks.filter((block) => block.id !== blockId);
    onChange(nextBlocks.length > 0 ? nextBlocks : [{ id: crypto.randomUUID(), type: "paragraph", text: "" }]);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) {
      return;
    }

    const nextBlocks = [...blocks];
    const [current] = nextBlocks.splice(index, 1);
    nextBlocks.splice(nextIndex, 0, current);
    onChange(nextBlocks);
  };

  const duplicateBlock = (index: number) => {
    const target = blocks[index];
    if (!target) {
      return;
    }

    const nextBlocks = [...blocks];
    nextBlocks.splice(index + 1, 0, {
      ...target,
      id: crypto.randomUUID(),
    });
    onChange(nextBlocks);
  };

  const moveBlockToIndex = (blockId: string, targetIndex: number) => {
    const currentIndex = blocks.findIndex((block) => block.id === blockId);
    if (currentIndex < 0) {
      return;
    }

    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, blocks.length - 1));
    if (currentIndex === boundedTargetIndex) {
      return;
    }

    const nextBlocks = [...blocks];
    const [movingBlock] = nextBlocks.splice(currentIndex, 1);
    nextBlocks.splice(boundedTargetIndex, 0, movingBlock);
    onChange(nextBlocks);
  };

  const splitBlock = (index: number, selectionStart: number, selectionEnd: number) => {
    const current = blocks[index];
    if (!current) {
      return;
    }

    const before = current.text.slice(0, selectionStart);
    const after = current.text.slice(selectionEnd);
    const nextBlockId = crypto.randomUUID();
    const currentText = before || fallbackSplitText(current.type);
    const nextText = after || fallbackSplitText(current.type);

    const nextBlocks = [...blocks];
    nextBlocks.splice(index, 1, { ...current, text: currentText });
    nextBlocks.splice(index + 1, 0, {
      id: nextBlockId,
      type: current.type,
      text: nextText,
    });

    onChange(nextBlocks);
    focusBlock(nextBlockId, after ? 0 : nextText.length);
  };

  const moveCaretToNeighbor = (
    index: number,
    direction: "previous" | "next",
    caret: "start" | "end",
  ) => {
    const targetIndex = direction === "previous" ? index - 1 : index + 1;
    const target = blocks[targetIndex];
    if (!target) {
      return;
    }

    focusBlock(target.id, caret === "start" ? 0 : target.text.length);
  };

  const applyCommand = (
    blockId: string,
    type: EditableBlockType,
    options?: {
      preserveContent?: boolean;
    },
  ) => {
    onChange(
      blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              type,
              text: options?.preserveContent ? block.text : defaultTextByType(type),
            }
          : block,
      ),
    );
    setCommandMenu(null);
  };

  const filteredCommands = useMemo(() => {
    if (!commandMenu) {
      return [];
    }

    return filterCommands(commandMenu.query);
  }, [commandMenu]);

  const closeCommandMenu = () => {
    if (commandMenu?.blockId) {
      hideToolbarWithDelay(commandMenu.blockId);
    }
    setCommandMenu(null);
  };

  return (
    <div className="space-y-1">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={`group relative ${
            dropTargetId === block.id ? "before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-sky-400" : ""
          }`}
          onDragOver={(event) => {
            if (!draggingBlockId || draggingBlockId === block.id) {
              return;
            }
            event.preventDefault();
            setDropTargetId(block.id);
          }}
          onDrop={(event) => {
            if (!draggingBlockId || draggingBlockId === block.id) {
              return;
            }
            event.preventDefault();
            moveBlockToIndex(draggingBlockId, index);
            setDraggingBlockId(null);
            setDropTargetId(null);
          }}
        >
          {!readOnly ? (
            <div className="pointer-events-none absolute left-[-34px] top-1/2 z-10 -translate-y-1/2">
              <button
              type="button"
              draggable
              onPointerEnter={() => showToolbar(block.id)}
              onPointerLeave={() => {
                if (commandMenu?.blockId === block.id) {
                  return;
                }
                hideToolbarWithDelay(block.id);
              }}
              onDragStart={(event) => {
                setDraggingBlockId(block.id);
                showToolbar(block.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", block.id);
              }}
              onDragEnd={() => {
                setDraggingBlockId(null);
                setDropTargetId(null);
              }}
              onClick={() =>
                setCommandMenu((value) =>
                  value?.blockId === block.id && value.mode === "actions"
                    ? null
                    : {
                        blockId: block.id,
                        mode: "actions",
                        query: "",
                        selectedIndex: 0,
                      },
                )
              }
              className={`pointer-events-auto flex h-8 min-w-8 items-center justify-center rounded-lg border bg-white text-slate-500 shadow-sm transition ${
                draggingBlockId === block.id
                  ? "border-sky-300 text-sky-600"
                  : visibleToolbarBlockId === block.id || commandMenu?.blockId === block.id
                    ? "border-slate-200 opacity-100 hover:border-slate-300 hover:text-slate-700"
                    : "border-slate-200 opacity-0 hover:border-slate-300 hover:text-slate-700"
              }`}
              aria-label="块操作与拖拽"
            >
              {isEmptyBlock(block) ? (
                <span className="text-[16px] leading-none">+</span>
              ) : (
                <div className="flex items-center gap-1.5 px-1.5">
                  <span className="text-[13px] font-medium leading-none text-sky-600">T</span>
                  <span className="text-[12px] leading-none text-slate-300">⋮</span>
                </div>
              )}
              </button>
            </div>
          ) : null}

          <div
            className={`relative -mx-3 rounded-lg px-3 transition ${
              activeBlockId === block.id || commandMenu?.blockId === block.id
                ? "bg-sky-50/70"
                : "bg-transparent"
            }`}
          >
            <textarea
              ref={(element) => {
                textareaRefs.current[block.id] = element;
              }}
              value={displayTextForBlock(block, readOnly)}
              onChange={(event) => {
                if (readOnly) {
                  return;
                }

                const value = event.target.value;
                updateBlock(block.id, { text: value });

                const query = commandQuery(value);
                if (query !== null) {
                  setCommandMenu({
                    blockId: block.id,
                    mode: "slash",
                    query,
                    selectedIndex: 0,
                  });
                  return;
                }

                if (commandMenu?.blockId === block.id) {
                  setCommandMenu(null);
                }
              }}
              onFocus={() => {
                setActiveBlockId(block.id);
                if (readOnly) {
                  return;
                }
                const query = commandQuery(block.text);
                if (query !== null) {
                  setCommandMenu({
                    blockId: block.id,
                    mode: "slash",
                    query,
                    selectedIndex: 0,
                  });
                }
              }}
              onBlur={() => {
                setActiveBlockId((current) => (current === block.id ? null : current));
              }}
              onKeyDown={(event) => {
                if (readOnly) {
                  return;
                }
                const selectionStart = event.currentTarget.selectionStart;
                const selectionEnd = event.currentTarget.selectionEnd;
                const hasSelection = selectionStart !== selectionEnd;
                const currentLength = event.currentTarget.value.length;

                const directQuery = commandQuery(event.currentTarget.value);
                if (event.key === "Enter" && !event.shiftKey && directQuery !== null) {
                  event.preventDefault();
                  event.stopPropagation();
                  const directCommands = filterCommands(directQuery);
                  const selectedIndex =
                    commandMenu?.blockId === block.id ? commandMenu.selectedIndex : 0;
                  const command = directCommands[selectedIndex] ?? directCommands[0];
                  if (command) {
                    applyCommand(block.id, command.type);
                  }
                  return;
                }

                if (!hasSelection) {
                  if (event.key === "ArrowUp" && selectionStart === 0) {
                    event.preventDefault();
                    moveCaretToNeighbor(index, "previous", "end");
                    return;
                  }

                  if (event.key === "ArrowLeft" && selectionStart === 0) {
                    event.preventDefault();
                    moveCaretToNeighbor(index, "previous", "end");
                    return;
                  }

                  if (event.key === "ArrowDown" && selectionStart === currentLength) {
                    event.preventDefault();
                    moveCaretToNeighbor(index, "next", "start");
                    return;
                  }

                  if (event.key === "ArrowRight" && selectionStart === currentLength) {
                    event.preventDefault();
                    moveCaretToNeighbor(index, "next", "start");
                    return;
                  }
                }

                if (
                  commandMenu?.blockId === block.id &&
                  commandMenu.mode === "slash" &&
                  filteredCommands.length > 0
                ) {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCommandMenu((value) =>
                      value
                        ? {
                            ...value,
                            selectedIndex: (value.selectedIndex + 1) % filteredCommands.length,
                          }
                        : value,
                    );
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCommandMenu((value) =>
                      value
                        ? {
                            ...value,
                            selectedIndex:
                              (value.selectedIndex - 1 + filteredCommands.length) % filteredCommands.length,
                          }
                        : value,
                    );
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    const command = filteredCommands[commandMenu.selectedIndex] ?? filteredCommands[0];
                    if (command) {
                      applyCommand(block.id, command.type);
                    }
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setCommandMenu(null);
                    return;
                  }
                }

                const liveQuery =
                  commandMenu?.blockId === block.id ? commandMenu.query : directQuery;
                const liveCommands = liveQuery === null ? [] : filterCommands(liveQuery);

                if (liveQuery !== null && liveCommands.length > 0) {
                  if (!commandMenu || commandMenu.blockId !== block.id) {
                    setCommandMenu({
                      blockId: block.id,
                      mode: "slash",
                      query: liveQuery,
                      selectedIndex: 0,
                    });
                  }

                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCommandMenu((value) =>
                      value
                        ? {
                            ...value,
                            selectedIndex: (value.selectedIndex + 1) % liveCommands.length,
                          }
                        : value,
                    );
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCommandMenu((value) =>
                      value
                        ? {
                            ...value,
                            selectedIndex: (value.selectedIndex - 1 + liveCommands.length) % liveCommands.length,
                          }
                        : value,
                    );
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    const command = liveCommands[0];
                    if (command) {
                      applyCommand(block.id, command.type);
                    }
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setCommandMenu(null);
                    return;
                  }
                } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  splitBlock(index, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
                }
              }}
              rows={rowsByType(block.type, displayTextForBlock(block, readOnly))}
              readOnly={readOnly}
              spellCheck={!readOnly}
              aria-readonly={readOnly}
              className={`block w-full resize-none border-0 bg-transparent p-0 outline-none ${textAreaClassName(block.type)} ${
                readOnly ? "cursor-text caret-transparent" : ""
              }`}
              placeholder={readOnly ? "" : placeholderByType(block.type)}
            />

            {!readOnly && commandMenu?.blockId === block.id ? (
              <div
                className="absolute left-0 top-[calc(100%+6px)] z-20 w-[300px] rounded-lg border border-slate-200 bg-white p-0 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
                onPointerEnter={() => showToolbar(block.id)}
                onPointerLeave={() => hideToolbarWithDelay(block.id)}
              >
                <div className="grid grid-cols-6 gap-px rounded-t-2xl bg-slate-200/80 p-px">
                  {BLOCK_COMMANDS.map((command) => (
                    <button
                      key={command.type}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        applyCommand(block.id, command.type, {
                          preserveContent: commandMenu.mode === "actions",
                        });
                      }}
                      className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg bg-white text-[10px] transition ${
                        block.type === command.type
                          ? "text-sky-600 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.45)]"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-[13px] font-semibold">{command.shortLabel}</span>
                      <span>{command.label}</span>
                    </button>
                  ))}
                </div>

                {commandMenu.mode === "slash" ? (
                  <div className="border-b border-slate-200 px-3 py-2 text-[11px] text-slate-400">
                    输入命令中：<span className="font-medium text-slate-600">/{commandMenu.query}</span>
                  </div>
                ) : null}

                <div className="border-b border-slate-200 px-2 py-2">
                  {filteredCommands.length > 0 ? (
                    <div className="space-y-1">
                      {filteredCommands.map((command, commandIndex) => (
                        <button
                          key={command.type}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            applyCommand(block.id, command.type, {
                              preserveContent: true,
                            });
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                            commandIndex === commandMenu.selectedIndex && commandMenu.mode === "slash"
                              ? "bg-sky-50 text-slate-900"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <div>
                            <div className="font-medium">{command.label}</div>
                            <div className="mt-0.5 text-xs text-slate-400">{command.description}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] text-slate-400">
                            /{command.shortLabel}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-2 py-2 text-sm text-slate-400">没有匹配的块命令</div>
                  )}
                </div>

                <div className="px-2 py-2">
                  <div className="px-1 pb-1 text-[11px] font-medium text-slate-400">操作</div>
                  <div className="space-y-1">
                    {[
                      {
                        label: "复制",
                        onClick: () => {
                          duplicateBlock(index);
                          closeCommandMenu();
                        },
                      },
                      {
                        label: "删除",
                        danger: true,
                        onClick: () => {
                          removeBlock(block.id);
                          closeCommandMenu();
                        },
                      },
                      {
                        label: "上移",
                        onClick: () => {
                          moveBlock(index, -1);
                          closeCommandMenu();
                        },
                      },
                      {
                        label: "下移",
                        onClick: () => {
                          moveBlock(index, 1);
                          closeCommandMenu();
                        },
                      },
                      {
                        label: "在下方添加",
                        onClick: () => {
                          insertBlock(index + 1, "paragraph");
                          closeCommandMenu();
                        },
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          item.onClick();
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                          item.danger
                            ? "text-rose-500 hover:bg-rose-50"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="text-xs text-slate-300">›</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
