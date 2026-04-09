import { buildDocumentViewModel, type DocumentViewModel } from "@/lib/mock-document";

const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_CLOUDDOC_API_BASE_URL ??
  process.env.CLOUDDOC_API_BASE_URL ??
  "/api";
const BACKEND_ORIGIN = process.env.CLOUDDOC_BACKEND_ORIGIN ?? "http://127.0.0.1:8000";
const API_BASE_URL =
  typeof window === "undefined" && PUBLIC_API_BASE_URL.startsWith("/")
    ? `${BACKEND_ORIGIN}${PUBLIC_API_BASE_URL}`
    : PUBLIC_API_BASE_URL;

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

function resolveApiAssetUrl(value?: string | null) {
  if (!value) {
    return undefined;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_ORIGIN}${value}`;
  }

  return `${API_ORIGIN}/${value}`;
}

export type DashboardDocument = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  isDeleted: boolean;
  isFavorited: boolean;
};

export type SearchDocument = {
  id: string;
  title: string;
  status: string;
  documentType: string;
  spaceId: string;
  updatedAt: string;
  excerpt: string;
  isFavorited: boolean;
};

export type TemplateItem = {
  id: string;
  name: string;
  category: string;
  status: string;
  createdAt: string;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isActive: boolean;
};

export type CurrentOrganization = {
  id: string;
  name: string;
  ownerId: string;
  role: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
};

export type SessionSummary = {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
};

export type NotificationItem = {
  id: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  documentId?: string;
  documentTitle?: string;
  threadId?: string;
  commentId?: string;
  notificationType: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SpaceSummary = {
  id: string;
  name: string;
  spaceType: string;
  visibility: string;
  updatedAt: string;
};

export type ApiListResult<T> = {
  data: T[];
  unavailable: boolean;
};

export type ApiItemResult<T> = {
  data: T | null;
  unavailable: boolean;
};

export type AuthPayload = {
  user: CurrentUser;
  authenticatedAt: string;
};

export type CommentAnchor = {
  blockId: string;
  startOffset: number;
  endOffset: number;
  quoteText: string;
  prefixText?: string;
  suffixText?: string;
};

export type CommentItem = {
  id: string;
  threadId: string;
  documentId: string;
  parentCommentId?: string;
  authorId: string;
  authorName: string;
  body: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommentThread = {
  id: string;
  documentId: string;
  anchorBlockId: string;
  anchorStartOffset: number;
  anchorEndOffset: number;
  quoteText: string;
  prefixText?: string;
  suffixText?: string;
  status: "open" | "resolved";
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  comments: CommentItem[];
};


export type LinkPreviewPayload = {
  url: string;
  normalizedUrl: string;
  title: string;
  description: string;
  siteName: string;
  icon: string;
  image: string;
  view: "link" | "title" | "card" | "preview";
  status: "ready" | "error" | "loading";
};

function buildCurrentUser(item: {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  is_active: boolean;
}): CurrentUser {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    avatarUrl: item.avatar_url ?? undefined,
    isActive: item.is_active,
  };
}

export async function fetchCurrentUser(options?: { bootstrap?: boolean }): Promise<ApiItemResult<CurrentUser>> {
  try {
    const bootstrap = options?.bootstrap ?? true;
    const response = await fetch(`${API_BASE_URL}/auth/me?bootstrap=${bootstrap ? "true" : "false"}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: null, unavailable: true };
    }
    const data = await response.json();
    return { data: data ? buildCurrentUser(data) : null, unavailable: false };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function login(input: { email: string; password: string }): Promise<AuthPayload> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to login");
  }
  const data = await response.json();
  return {
    user: buildCurrentUser(data.user),
    authenticatedAt: data.authenticated_at,
  };
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
}): Promise<AuthPayload> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
      organization_name: input.organizationName ?? null,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to register");
  }
  const data = await response.json();
  return {
    user: buildCurrentUser(data.user),
    authenticatedAt: data.authenticated_at,
  };
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 204) {
    throw new Error("Failed to logout");
  }
}

export async function fetchCurrentOrganization(): Promise<ApiItemResult<CurrentOrganization>> {
  try {
    const response = await fetch(`${API_BASE_URL}/organizations/current`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401 || response.status === 404) {
      return { data: null, unavailable: false };
    }
    if (!response.ok) {
      return { data: null, unavailable: true };
    }
    const data = await response.json();
    return {
      data: data
        ? {
            id: data.id,
            name: data.name,
            ownerId: data.owner_id,
            role: data.role,
            memberCount: data.member_count,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }
        : null,
      unavailable: false,
    };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function fetchOrganizationMembers(
  organizationId: string,
): Promise<ApiListResult<OrganizationMember>> {
  try {
    const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/members`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401 || response.status === 404) {
      return { data: [], unavailable: false };
    }
    if (!response.ok) {
      return { data: [], unavailable: true };
    }
    const data = await response.json();
    return {
      data: data.map((item: {
        id: string;
        user_id: string;
        name: string;
        email: string;
        role: string;
        status: string;
        joined_at: string;
      }) => ({
        id: item.id,
        userId: item.user_id,
        name: item.name,
        email: item.email,
        role: item.role,
        status: item.status,
        joinedAt: item.joined_at,
      })),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function fetchSessions(): Promise<ApiListResult<SessionSummary>> {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401) {
      return { data: [], unavailable: false };
    }
    if (!response.ok) {
      return { data: [], unavailable: true };
    }
    const data = await response.json();
    return {
      data: data.map((item: {
        id: string;
        user_agent?: string | null;
        ip_address?: string | null;
        expires_at: string;
        created_at: string;
        is_current: boolean;
      }) => ({
        id: item.id,
        userAgent: item.user_agent ?? undefined,
        ipAddress: item.ip_address ?? undefined,
        expiresAt: item.expires_at,
        createdAt: item.created_at,
        isCurrent: item.is_current,
      })),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function fetchNotifications(): Promise<ApiListResult<NotificationItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401) {
      return { data: [], unavailable: false };
    }
    if (!response.ok) {
      return { data: [], unavailable: true };
    }
    const data = await response.json();
    return {
      data: data.map((item: {
        id: string;
        user_id: string;
        actor_id?: string | null;
        actor_name?: string | null;
        document_id?: string | null;
        document_title?: string | null;
        thread_id?: string | null;
        comment_id?: string | null;
        notification_type: string;
        title: string;
        body: string;
        is_read: boolean;
        created_at: string;
        updated_at: string;
      }) => ({
        id: item.id,
        userId: item.user_id,
        actorId: item.actor_id ?? undefined,
        actorName: item.actor_name ?? undefined,
        documentId: item.document_id ?? undefined,
        documentTitle: item.document_title ?? undefined,
        threadId: item.thread_id ?? undefined,
        commentId: item.comment_id ?? undefined,
        notificationType: item.notification_type,
        title: item.title,
        body: item.body,
        isRead: item.is_read,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function fetchUnreadNotificationCount(): Promise<ApiItemResult<{ unreadCount: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401) {
      return { data: { unreadCount: 0 }, unavailable: false };
    }
    if (!response.ok) {
      return { data: null, unavailable: true };
    }
    const data = await response.json();
    return { data: { unreadCount: Number(data.unread_count ?? 0) }, unavailable: false };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem> {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Failed to mark notification read");
  }
  const item = await response.json();
  return {
    id: item.id,
    userId: item.user_id,
    actorId: item.actor_id ?? undefined,
    actorName: item.actor_name ?? undefined,
    documentId: item.document_id ?? undefined,
    documentTitle: item.document_title ?? undefined,
    threadId: item.thread_id ?? undefined,
    commentId: item.comment_id ?? undefined,
    notificationType: item.notification_type,
    title: item.title,
    body: item.body,
    isRead: item.is_read,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 204) {
    throw new Error("Failed to mark all notifications read");
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 204) {
    throw new Error("Failed to revoke session");
  }
}

export async function createOrganization(input: { name: string }) {
  const response = await fetch(`${API_BASE_URL}/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to create organization");
  }
  const data = await response.json();
  return {
    id: data.id as string,
    name: data.name as string,
    ownerId: data.owner_id as string,
    role: data.role as string,
    memberCount: data.member_count as number,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  } satisfies CurrentOrganization;
}

export async function inviteOrganizationMember(input: {
  organizationId: string;
  email: string;
  role: string;
}) {
  const response = await fetch(`${API_BASE_URL}/organizations/${input.organizationId}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email: input.email, role: input.role }),
  });
  if (!response.ok) {
    throw new Error("Failed to invite member");
  }
  return response.json() as Promise<{
    id: string;
    organization_id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
    created_at: string;
  }>;
}

export async function updateOrganizationMember(input: {
  organizationId: string;
  memberId: string;
  role?: string;
  status?: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/organizations/${input.organizationId}/members/${input.memberId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        role: input.role ?? null,
        status: input.status ?? null,
      }),
    },
  );
  if (!response.ok) {
    throw new Error("Failed to update member");
  }
  const data = await response.json();
  return {
    id: data.id as string,
    userId: data.user_id as string,
    name: data.name as string,
    email: data.email as string,
    role: data.role as string,
    status: data.status as string,
    joinedAt: data.joined_at as string,
  } satisfies OrganizationMember;
}

export async function fetchDocument(docId: string): Promise<ApiItemResult<DocumentViewModel>> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { data: null, unavailable: response.status >= 500 };
    }

    const data = await response.json();
    return {
      data: buildDocumentViewModel({
        ...data,
        file_url: resolveApiAssetUrl(data.file_url),
      }),
      unavailable: false,
    };
  } catch {
    return { data: null, unavailable: true };
  }
}

function buildCommentThread(item: {
  id: string;
  document_id: string;
  anchor_block_id: string;
  anchor_start_offset: number;
  anchor_end_offset: number;
  quote_text: string;
  prefix_text?: string | null;
  suffix_text?: string | null;
  status: "open" | "resolved";
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  comments: Array<{
    id: string;
    thread_id: string;
    document_id: string;
    parent_comment_id?: string | null;
    author_id: string;
    author_name: string;
    body: string;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
  }>;
}): CommentThread {
  return {
    id: item.id,
    documentId: item.document_id,
    anchorBlockId: item.anchor_block_id,
    anchorStartOffset: item.anchor_start_offset,
    anchorEndOffset: item.anchor_end_offset,
    quoteText: item.quote_text,
    prefixText: item.prefix_text ?? undefined,
    suffixText: item.suffix_text ?? undefined,
    status: item.status,
    createdBy: item.created_by,
    createdByName: item.created_by_name,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    comments: item.comments.map((comment) => ({
      id: comment.id,
      threadId: comment.thread_id,
      documentId: comment.document_id,
      parentCommentId: comment.parent_comment_id ?? undefined,
      authorId: comment.author_id,
      authorName: comment.author_name,
      body: comment.body,
      isDeleted: comment.is_deleted,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    })),
  };
}

export async function fetchCommentThreads(docId: string): Promise<ApiListResult<CommentThread>> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}/comments`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { data: [], unavailable: true };
    }
    const data = await response.json();
    return { data: data.map(buildCommentThread), unavailable: false };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function createCommentThread(docId: string, input: { anchor: CommentAnchor; body: string }) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anchor: {
        block_id: input.anchor.blockId,
        start_offset: input.anchor.startOffset,
        end_offset: input.anchor.endOffset,
        quote_text: input.anchor.quoteText,
        prefix_text: input.anchor.prefixText ?? null,
        suffix_text: input.anchor.suffixText ?? null,
      },
      body: input.body,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to create comment");
  }
  return buildCommentThread(await response.json());
}

export async function replyCommentThread(threadId: string, body: string, parentCommentId?: string | null) {
  const response = await fetch(`${API_BASE_URL}/comments/${threadId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, parent_comment_id: parentCommentId ?? null }),
  });
  if (!response.ok) {
    throw new Error("Failed to reply comment");
  }
  return buildCommentThread(await response.json());
}

export async function updateCommentThreadStatus(threadId: string, status: "open" | "resolved") {
  const response = await fetch(`${API_BASE_URL}/comments/${threadId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error("Failed to update comment status");
  }
  return buildCommentThread(await response.json());
}

export async function deleteComment(commentId: string) {
  const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Failed to delete comment");
  }
  const payload = await response.json();
  return {
    commentId: payload.comment_id as string,
    threadId: payload.thread_id as string,
    threadDeleted: Boolean(payload.thread_deleted),
    thread: payload.thread ? buildCommentThread(payload.thread) : null,
  };
}

export async function fetchDocuments(state = "active"): Promise<ApiListResult<DashboardDocument>> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents?state=${state}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { data: [], unavailable: true };
    }

    const data = (await response.json()) as Array<{
      id: string;
      title: string;
      status: string;
      updated_at: string;
      is_deleted: boolean;
      is_favorited: boolean;
    }>;

    return {
      data: data.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        isDeleted: item.is_deleted,
        isFavorited: item.is_favorited,
        updatedAt: new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(item.updated_at)),
      })),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function searchDocuments(query: string): Promise<ApiListResult<SearchDocument>> {
  if (!query.trim()) {
    return { data: [], unavailable: false };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/documents/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { data: [], unavailable: true };
    }

    const data = (await response.json()) as Array<{
      id: string;
      title: string;
      status: string;
      document_type: string;
      space_id: string;
      updated_at: string;
      excerpt: string;
      is_favorited: boolean;
    }>;

    return {
      data: data.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        documentType: item.document_type,
        spaceId: item.space_id,
        excerpt: item.excerpt,
        isFavorited: item.is_favorited,
        updatedAt: new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(item.updated_at)),
      })),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function fetchTemplates(): Promise<ApiListResult<TemplateItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/templates`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { data: [], unavailable: true };
    }

    const data = (await response.json()) as Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      created_at: string;
    }>;

    return {
      data: data.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        status: item.status,
        createdAt: new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(item.created_at)),
      })),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function instantiateTemplate(
  templateId: string,
  input: { title?: string; spaceId?: string },
) {
  const response = await fetch(`${API_BASE_URL}/templates/${templateId}/instantiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title ?? null,
      space_id: input.spaceId ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to instantiate template");
  }

  return response.json() as Promise<{
    template_id: string;
    document: { id: string };
  }>;
}

export async function fetchSpaces(): Promise<ApiListResult<SpaceSummary>> {
  try {
    const response = await fetch(`${API_BASE_URL}/spaces`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { data: [], unavailable: true };
    }

    const data = (await response.json()) as Array<{
      id: string;
      name: string;
      space_type: string;
      visibility: string;
      updated_at: string;
    }>;

    return {
      data: data.map((item) => ({
        id: item.id,
        name: item.name,
        spaceType: item.space_type,
        visibility: item.visibility,
        updatedAt: new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(item.updated_at)),
      })),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function createDocument(input: {
  title: string;
  spaceId: string;
  parentId?: string | null;
  documentType?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      space_id: input.spaceId,
      parent_id: input.parentId ?? null,
      document_type: input.documentType ?? "doc",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create document");
  }

  const data = await response.json();
  return buildDocumentViewModel({
    ...data,
    file_url: resolveApiAssetUrl(data.file_url),
  });
}

export async function uploadPdfDocument(input: {
  title?: string;
  spaceId: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("space_id", input.spaceId);
  formData.append("title", input.title ?? "");
  formData.append("file", input.file);

  const response = await fetch(`${API_BASE_URL}/documents/upload-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload PDF");
  }

  const data = await response.json();
  return buildDocumentViewModel({
    ...data,
    file_url: resolveApiAssetUrl(data.file_url),
  });
}

export async function uploadImageAsset(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/documents/upload-image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload image");
  }

  const data = await response.json();
  return {
    ...data,
    file_url: resolveApiAssetUrl(data.file_url),
  } as {
    file_url: string;
    file_name: string;
    mime_type: string;
    file_size: number;
  };
}

export async function updateDocumentContent(input: {
  docId: string;
  schemaVersion?: number;
  contentJson: Record<string, unknown>;
  plainText: string;
  baseVersionNo?: number | null;
}) {
  const response = await fetch(`${API_BASE_URL}/documents/${input.docId}/content`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schema_version: input.schemaVersion ?? 1,
      content_json: input.contentJson,
      plain_text: input.plainText,
      base_version_no: input.baseVersionNo ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save document");
  }

  const data = await response.json();
  return buildDocumentViewModel({
    ...data,
    file_url: resolveApiAssetUrl(data.file_url),
  });
}

export async function softDeleteDocument(docId: string) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete document");
  }

  return response.json();
}

export async function restoreDocument(docId: string) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/restore`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to restore document");
  }

  return response.json();
}

export async function favoriteDocument(docId: string) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/favorite`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to favorite document");
  }

  return response.json();
}

export async function unfavoriteDocument(docId: string) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/favorite`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to unfavorite document");
  }

  return response.json();
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewPayload> {
  const response = await fetch(`${API_BASE_URL}/documents/link-preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch link preview");
  }

  const data = (await response.json()) as {
    url: string;
    normalized_url: string;
    title: string;
    description: string;
    site_name: string;
    icon: string;
    image: string;
    view: "link" | "title" | "card" | "preview";
    status: "ready" | "error" | "loading";
  };

  return {
    url: data.url,
    normalizedUrl: data.normalized_url,
    title: data.title,
    description: data.description,
    siteName: data.site_name,
    icon: resolveApiAssetUrl(data.icon) ?? data.icon,
    image: resolveApiAssetUrl(data.image) ?? data.image,
    view: data.view,
    status: data.status,
  };
}
