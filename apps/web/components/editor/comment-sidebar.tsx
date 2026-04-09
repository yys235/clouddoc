"use client";

import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { CommentAnchor, CommentThread, OrganizationMember } from "@/lib/api";

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function CommentSidebar({
  threads,
  blockOrder,
  mentionCandidates,
  currentUserId,
  documentOwnerId,
  activeThreadId,
  hoveredThreadId,
  pendingAnchor,
  unavailable,
  onActivate,
  onHoverThread,
  onCreate,
  onReply,
  onStatusChange,
  onDeleteComment,
}: {
  threads: CommentThread[];
  blockOrder: string[];
  mentionCandidates: OrganizationMember[];
  currentUserId?: string | null;
  documentOwnerId?: string | null;
  activeThreadId: string | null;
  hoveredThreadId: string | null;
  pendingAnchor: CommentAnchor | null;
  unavailable: boolean;
  onActivate: (threadId: string) => void;
  onHoverThread: (threadId: string | null) => void;
  onCreate: (body: string) => Promise<void> | void;
  onReply: (threadId: string, body: string, parentCommentId?: string | null) => Promise<void> | void;
  onStatusChange: (threadId: string, status: "open" | "resolved") => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
}) {
  const [newBody, setNewBody] = useState("");
  const [replyByThread, setReplyByThread] = useState<Record<string, string>>({});
  const [replyTargetByThread, setReplyTargetByThread] = useState<Record<string, string | null>>({});
  const [pendingDeleteComment, setPendingDeleteComment] = useState<{ id: string } | null>(null);
  const [showResolvedThreads, setShowResolvedThreads] = useState(false);
  const threadRefs = useRef<Record<string, HTMLElement | null>>({});
  const blockOrderIndex = new Map(blockOrder.map((blockId, index) => [blockId, index]));
  const sortedThreads = [...threads].sort((left, right) => {
    const leftBlockIndex = blockOrderIndex.get(left.anchorBlockId) ?? Number.MAX_SAFE_INTEGER;
    const rightBlockIndex = blockOrderIndex.get(right.anchorBlockId) ?? Number.MAX_SAFE_INTEGER;
    if (leftBlockIndex !== rightBlockIndex) {
      return leftBlockIndex - rightBlockIndex;
    }
    if (left.anchorStartOffset !== right.anchorStartOffset) {
      return left.anchorStartOffset - right.anchorStartOffset;
    }
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
  const openThreads = sortedThreads.filter((thread) => thread.status === "open");
  const resolvedThreads = sortedThreads.filter((thread) => thread.status === "resolved");

  useEffect(() => {
    if (!activeThreadId) {
      return;
    }
    const target = threadRefs.current[activeThreadId];
    if (!target) {
      return;
    }
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) {
      return;
    }
    const activeThread = threads.find((thread) => thread.id === activeThreadId);
    if (activeThread?.status === "resolved") {
      setShowResolvedThreads(true);
    }
  }, [activeThreadId, threads]);

  return (
    <aside className="hidden border-l border-slate-200/80 bg-white/72 xl:block">
      <div className="sticky top-0 h-screen overflow-y-auto px-3 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">评论 ({threads.length})</div>
        </div>

        {unavailable ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-700">
            评论接口当前不可用
          </div>
        ) : null}

        {pendingAnchor ? (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/70 p-2.5">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-sky-700">新评论</div>
            <div className="mt-2 rounded-md bg-white px-2.5 py-2 text-sm leading-5 text-slate-700">
              “{pendingAnchor.quoteText}”
            </div>
            <MentionTextarea
              value={newBody}
              onChange={setNewBody}
              placeholder="输入评论"
              members={mentionCandidates}
              minHeightClassName="min-h-20"
              className="mt-2.5"
            />
            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!newBody.trim()) {
                    return;
                  }
                  void onCreate(newBody.trim());
                  setNewBody("");
                }}
                className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-sm text-white"
              >
                发送
              </button>
            </div>
          </div>
        ) : null}

        {threads.length === 0 && !pendingAnchor ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-2.5 py-3 text-sm text-slate-400">
            选中文本后可添加评论
          </div>
        ) : null}

        <div className="mt-3 space-y-2.5">
          {openThreads.map((thread) => (
            <CommentThreadCard
              key={thread.id}
              thread={thread}
              currentUserId={currentUserId}
              documentOwnerId={documentOwnerId}
              activeThreadId={activeThreadId}
              hoveredThreadId={hoveredThreadId}
              mentionCandidates={mentionCandidates}
              replyBody={replyByThread[thread.id] ?? ""}
              replyTargetId={replyTargetByThread[thread.id] ?? null}
              onReplyBodyChange={(body) =>
                setReplyByThread((current) => ({ ...current, [thread.id]: body }))
              }
              onReplyTargetChange={(commentId) =>
                setReplyTargetByThread((current) => ({ ...current, [thread.id]: commentId }))
              }
              onActivate={onActivate}
              onHoverThread={onHoverThread}
              onReply={onReply}
              onStatusChange={onStatusChange}
              onRequestDeleteComment={(commentId) => setPendingDeleteComment({ id: commentId })}
              threadRef={(element) => {
                threadRefs.current[thread.id] = element;
              }}
            />
          ))}
        </div>

        {resolvedThreads.length > 0 ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowResolvedThreads((current) => !current)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-left text-sm text-slate-700"
            >
              <span>已解决 ({resolvedThreads.length})</span>
              <span className={`text-xs text-slate-400 transition ${showResolvedThreads ? "rotate-180" : ""}`}>⌄</span>
            </button>
            {showResolvedThreads ? (
              <div className="mt-2.5 space-y-2.5">
                {resolvedThreads.map((thread) => (
                  <CommentThreadCard
                    key={thread.id}
                    thread={thread}
                    currentUserId={currentUserId}
                    documentOwnerId={documentOwnerId}
                    activeThreadId={activeThreadId}
                    hoveredThreadId={hoveredThreadId}
                    mentionCandidates={mentionCandidates}
                    replyBody={replyByThread[thread.id] ?? ""}
                    replyTargetId={replyTargetByThread[thread.id] ?? null}
                    onReplyBodyChange={(body) =>
                      setReplyByThread((current) => ({ ...current, [thread.id]: body }))
                    }
                    onReplyTargetChange={(commentId) =>
                      setReplyTargetByThread((current) => ({ ...current, [thread.id]: commentId }))
                    }
                    onActivate={onActivate}
                    onHoverThread={onHoverThread}
                    onReply={onReply}
                    onStatusChange={onStatusChange}
                    onRequestDeleteComment={(commentId) => setPendingDeleteComment({ id: commentId })}
                    threadRef={(element) => {
                      threadRefs.current[thread.id] = element;
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDeleteComment)}
        title="确认删除评论"
        description={
          pendingDeleteComment
            ? `删除后这条评论将不可恢复。若仍有子回复，它们会保留，并显示父评论已删除。`
            : ""
        }
        confirmLabel="确认删除"
        cancelLabel="取消"
        danger
        onCancel={() => setPendingDeleteComment(null)}
        onConfirm={() => {
          if (!pendingDeleteComment) {
            return;
          }
          void onDeleteComment(pendingDeleteComment.id);
          setPendingDeleteComment(null);
        }}
      />
    </aside>
  );
}

function CommentThreadCard({
  thread,
  currentUserId,
  documentOwnerId,
  activeThreadId,
  hoveredThreadId,
  mentionCandidates,
  replyBody,
  replyTargetId,
  onReplyBodyChange,
  onReplyTargetChange,
  onActivate,
  onHoverThread,
  onReply,
  onStatusChange,
  onRequestDeleteComment,
  threadRef,
}: {
  thread: CommentThread;
  currentUserId?: string | null;
  documentOwnerId?: string | null;
  activeThreadId: string | null;
  hoveredThreadId: string | null;
  mentionCandidates: OrganizationMember[];
  replyBody: string;
  replyTargetId: string | null;
  onReplyBodyChange: (body: string) => void;
  onReplyTargetChange: (commentId: string | null) => void;
  onActivate: (threadId: string) => void;
  onHoverThread: (threadId: string | null) => void;
  onReply: (threadId: string, body: string, parentCommentId?: string | null) => Promise<void> | void;
  onStatusChange: (threadId: string, status: "open" | "resolved") => Promise<void> | void;
  onRequestDeleteComment: (commentId: string) => void;
  threadRef: (element: HTMLElement | null) => void;
}) {
  return (
    <section
      ref={threadRef}
      onMouseEnter={() => onHoverThread(thread.id)}
      onMouseLeave={() => onHoverThread(null)}
      className={`rounded-lg border p-3 transition ${
        thread.id === activeThreadId
          ? "border-amber-300 bg-amber-50/60"
          : thread.id === hoveredThreadId
            ? "border-amber-200 bg-amber-50/40"
            : "border-slate-200 bg-white/85"
      }`}
    >
      <button type="button" className="block w-full text-left" onClick={() => onActivate(thread.id)}>
        <div className="text-sm font-medium text-slate-800">“{thread.quoteText}”</div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          {thread.createdByName} · {formatTime(thread.createdAt)}
        </div>
      </button>

      <div className="mt-2.5 space-y-1.5">
        {renderCommentTree({
          comments: thread.comments,
          threadId: thread.id,
          currentUserId,
          documentOwnerId,
          onRequestDeleteComment,
          onSelectReplyTarget: (commentId) => onReplyTargetChange(commentId),
        })}
      </div>

      <MentionTextarea
        value={replyBody}
        onChange={onReplyBodyChange}
        placeholder="回复评论"
        members={mentionCandidates}
        minHeightClassName="min-h-16"
        className="mt-2.5"
      />
      {replyTargetId ? (
        <div className="mt-1 text-[11px] text-slate-500">
          回复指定评论
          <button
            type="button"
            className="ml-2 text-[11px] text-slate-400 hover:text-slate-600"
            onClick={() => onReplyTargetChange(null)}
          >
            取消
          </button>
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600"
          onClick={() => void onStatusChange(thread.id, thread.status === "open" ? "resolved" : "open")}
        >
          {thread.status === "open" ? "解决" : "重新打开"}
        </button>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white"
          onClick={() => {
            const body = replyBody.trim();
            if (!body) {
              return;
            }
            void onReply(thread.id, body, replyTargetId ?? null);
            onReplyBodyChange("");
            onReplyTargetChange(null);
          }}
        >
          回复
        </button>
      </div>
    </section>
  );
}

function MentionTextarea({
  value,
  onChange,
  placeholder,
  members,
  className = "",
  minHeightClassName = "min-h-16",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  members: OrganizationMember[];
  className?: string;
  minHeightClassName?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);

  const normalizedQuery = mentionQuery.trim().toLowerCase();
  const suggestions = normalizedQuery
    ? members
        .filter((member) => {
          const name = member.name.toLowerCase();
          const email = member.email.toLowerCase();
          return name.includes(normalizedQuery) || email.includes(normalizedQuery);
        })
        .slice(0, 6)
    : members.slice(0, 6);

  const updateMentionState = (nextValue: string, selectionStart: number) => {
    const beforeCaret = nextValue.slice(0, selectionStart);
    const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) {
      setMentionQuery("");
      setMentionRange(null);
      return;
    }
    const query = match[1] ?? "";
    const atIndex = selectionStart - query.length - 1;
    setMentionQuery(query);
    setMentionRange({ start: atIndex, end: selectionStart });
  };

  const insertMention = (member: OrganizationMember) => {
    if (!mentionRange) {
      return;
    }
    const nextValue = `${value.slice(0, mentionRange.start)}@${member.name} ${value.slice(mentionRange.end)}`;
    onChange(nextValue);
    setMentionQuery("");
    setMentionRange(null);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      const caret = mentionRange.start + member.name.length + 2;
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue);
          updateMentionState(nextValue, event.target.selectionStart ?? nextValue.length);
        }}
        onKeyUp={(event) => {
          const target = event.currentTarget;
          updateMentionState(target.value, target.selectionStart ?? target.value.length);
        }}
        onClick={(event) => {
          const target = event.currentTarget;
          updateMentionState(target.value, target.selectionStart ?? target.value.length);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setMentionQuery("");
            setMentionRange(null);
          }, 120);
        }}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm leading-5 text-slate-700 outline-none transition focus:border-sky-300 ${minHeightClassName}`}
      />
      {mentionRange && suggestions.length > 0 ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-full rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {suggestions.map((member) => (
            <button
              key={member.id}
              type="button"
              className="flex w-full items-start justify-between rounded-md px-2.5 py-2 text-left hover:bg-slate-50"
              onMouseDown={(event) => {
                event.preventDefault();
                insertMention(member);
              }}
            >
              <span className="truncate text-sm text-slate-800">{member.name}</span>
              <span className="ml-3 truncate text-xs text-slate-400">{member.email}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function renderCommentTree({
  comments,
  threadId,
  currentUserId,
  documentOwnerId,
  onRequestDeleteComment,
  onSelectReplyTarget,
}: {
  comments: CommentThread["comments"];
  threadId: string;
  currentUserId?: string | null;
  documentOwnerId?: string | null;
  onRequestDeleteComment: (commentId: string) => void;
  onSelectReplyTarget: (commentId: string) => void;
}) {
  const childrenByParent = new Map<string | null, CommentThread["comments"]>();
  for (const comment of comments) {
    const key = comment.parentCommentId ?? null;
    const bucket = childrenByParent.get(key) ?? [];
    bucket.push(comment);
    childrenByParent.set(key, bucket);
  }

  const renderNode = (comment: CommentThread["comments"][number], depth: number) => {
    const children = childrenByParent.get(comment.id) ?? [];
    const canDelete =
      Boolean(currentUserId) && (currentUserId === comment.authorId || currentUserId === documentOwnerId);
    const showDeletedPlaceholder = comment.isDeleted;

    return (
      <div key={comment.id} className="space-y-1.5">
        <div
          className="rounded-md bg-slate-50 px-2.5 py-2"
          style={{ marginLeft: `${depth * 18}px` }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-400">
              {comment.authorName} · {formatTime(comment.createdAt)}
            </div>
            <div className="flex items-center gap-2">
              {!showDeletedPlaceholder ? (
                <button
                  type="button"
                  className="text-[11px] text-slate-500 hover:text-slate-700"
                  onClick={() => onSelectReplyTarget(comment.id)}
                >
                  回复
                </button>
              ) : null}
              {canDelete && !showDeletedPlaceholder ? (
                <button
                  type="button"
                  className="text-[11px] text-rose-500 hover:text-rose-600"
                  onClick={() => onRequestDeleteComment(comment.id)}
                >
                  删除
                </button>
              ) : null}
            </div>
          </div>
          <div className={`mt-0.5 text-sm leading-5 ${showDeletedPlaceholder ? "italic text-slate-400" : "text-slate-700"}`}>
            {showDeletedPlaceholder ? "该评论已删除" : comment.body}
          </div>
        </div>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (childrenByParent.get(null) ?? []).map((comment) => renderNode(comment, 0));
}
