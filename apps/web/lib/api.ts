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

async function buildRequestHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers ?? {});
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const cookieHeader = cookieStore.toString();
      if (cookieHeader && !headers.has("cookie")) {
        headers.set("cookie", cookieHeader);
      }
    } catch {
      // ignore server cookie forwarding failures
    }
  }
  return headers;
}

async function apiFetch(input: string, init?: RequestInit) {
  const headers = await buildRequestHeaders(init);
  return fetch(input, {
    ...init,
    headers,
  });
}

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
  visibility: string;
  canManage: boolean;
  folderId?: string;
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
  visibility: string;
};

export type ShareLinkSettings = {
  id?: string;
  token?: string;
  shareUrl?: string;
  isEnabled: boolean;
  isActive: boolean;
  requiresPassword: boolean;
  expiresAt?: string;
  allowCopy: boolean;
  allowExport: boolean;
  createdAt?: string;
  updatedAt?: string;
  accessCount: number;
  lastAccessedAt?: string;
};

export type DocumentPermissionSettings = {
  documentId: string;
  linkShareScope: string;
  externalAccessEnabled: boolean;
  commentScope: string;
  shareCollaboratorScope: string;
  copyScope: string;
  exportScope: string;
  printScope: string;
  downloadScope: string;
  allowSearchIndex: boolean;
  watermarkEnabled: boolean;
  updatedAt: string;
};

export type DocumentPermissionMember = {
  id: string;
  documentId: string;
  subjectType: string;
  subjectId: string;
  permissionLevel: string;
  invitedBy?: string | null;
  notify: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentPermissionAuditLog = {
  id: string;
  documentId: string;
  actorId?: string | null;
  actorType: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  createdAt: string;
};

export type SharedDocumentResponse = {
  status: string;
  document: DocumentViewModel | null;
  share: ShareLinkSettings | null;
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
  isSuperAdmin: boolean;
};

export type DocumentTreeOpenMode = "same-page" | "new-window";

export type UserPreference = {
  id: string;
  userId: string;
  documentTreeOpenMode: DocumentTreeOpenMode;
  updatedAt: string;
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

export type FolderSummary = {
  id: string;
  spaceId: string;
  parentFolderId?: string;
  title: string;
  visibility: string;
  icon?: string;
  sortOrder: number;
  isDeleted: boolean;
  updatedAt: string;
  canManage: boolean;
};

export type TreeNode = {
  id: string;
  nodeType: "folder" | "document";
  title: string;
  spaceId: string;
  parentFolderId?: string;
  sortOrder: number;
  visibility: string;
  updatedAt: string;
  canManage: boolean;
  documentType?: string;
  isDeleted: boolean;
  children: TreeNode[];
};

export type FolderChildrenResult = {
  folder: FolderSummary | null;
  children: TreeNode[];
};

export type AncestorItem = {
  id: string;
  nodeType: "folder";
  title: string;
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
  is_super_admin?: boolean;
}): CurrentUser {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    avatarUrl: item.avatar_url ?? undefined,
    isActive: item.is_active,
    isSuperAdmin: Boolean(item.is_super_admin),
  };
}

function buildUserPreference(item: {
  id: string;
  user_id: string;
  document_tree_open_mode: DocumentTreeOpenMode;
  updated_at: string;
}): UserPreference {
  return {
    id: item.id,
    userId: item.user_id,
    documentTreeOpenMode: item.document_tree_open_mode,
    updatedAt: item.updated_at,
  };
}

export async function fetchCurrentUser(options?: { bootstrap?: boolean }): Promise<ApiItemResult<CurrentUser>> {
  try {
    const bootstrap = options?.bootstrap ?? false;
    const response = await apiFetch(`${API_BASE_URL}/auth/me?bootstrap=${bootstrap ? "true" : "false"}`, {
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

export async function fetchUserPreference(): Promise<ApiItemResult<UserPreference>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/preferences/me`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401) {
      return { data: null, unavailable: false };
    }
    if (!response.ok) {
      return { data: null, unavailable: true };
    }
    return { data: buildUserPreference(await response.json()), unavailable: false };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function updateUserPreference(input: {
  documentTreeOpenMode?: DocumentTreeOpenMode;
}): Promise<UserPreference> {
  const response = await fetch(`${API_BASE_URL}/preferences/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      document_tree_open_mode: input.documentTreeOpenMode,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to update user preferences");
  }
  return buildUserPreference(await response.json());
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
    const response = await apiFetch(`${API_BASE_URL}/organizations/current`, {
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
    const response = await apiFetch(`${API_BASE_URL}/organizations/${organizationId}/members`, {
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
    const response = await apiFetch(`${API_BASE_URL}/sessions`, {
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
    const response = await apiFetch(`${API_BASE_URL}/notifications`, {
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
    const response = await apiFetch(`${API_BASE_URL}/notifications/unread-count`, {
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
    const response = await apiFetch(`${API_BASE_URL}/documents/${docId}`, {
      cache: "no-store",
      credentials: "same-origin",
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

function buildShareLinkSettings(item: {
  id?: string | null;
  token?: string | null;
  share_url?: string | null;
  is_enabled?: boolean;
  is_active?: boolean;
  requires_password?: boolean;
  expires_at?: string | null;
  allow_copy?: boolean;
  allow_export?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  access_count?: number;
  last_accessed_at?: string | null;
}): ShareLinkSettings {
  return {
    id: item.id ?? undefined,
    token: item.token ?? undefined,
    shareUrl: item.share_url ?? undefined,
    isEnabled: Boolean(item.is_enabled),
    isActive: Boolean(item.is_active),
    requiresPassword: Boolean(item.requires_password),
    expiresAt: item.expires_at ?? undefined,
    allowCopy: Boolean(item.allow_copy),
    allowExport: Boolean(item.allow_export),
    createdAt: item.created_at ?? undefined,
    updatedAt: item.updated_at ?? undefined,
    accessCount: Number(item.access_count ?? 0),
    lastAccessedAt: item.last_accessed_at ?? undefined,
  };
}

export async function fetchCommentThreads(docId: string): Promise<ApiListResult<CommentThread>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/comments`, {
      cache: "no-store",
      credentials: "same-origin",
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
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
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
  const response = await apiFetch(`${API_BASE_URL}/comments/${threadId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ body, parent_comment_id: parentCommentId ?? null }),
  });
  if (!response.ok) {
    throw new Error("Failed to reply comment");
  }
  return buildCommentThread(await response.json());
}

export async function updateCommentThreadStatus(threadId: string, status: "open" | "resolved") {
  const response = await apiFetch(`${API_BASE_URL}/comments/${threadId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error("Failed to update comment status");
  }
  return buildCommentThread(await response.json());
}

export async function deleteComment(commentId: string) {
  const response = await apiFetch(`${API_BASE_URL}/comments/${commentId}`, {
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
    const response = await apiFetch(`${API_BASE_URL}/documents?state=${state}`, {
      cache: "no-store",
      credentials: "same-origin",
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
      visibility: string;
      can_manage: boolean;
      folder_id?: string | null;
    }>;

    return {
      data: data.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        isDeleted: item.is_deleted,
        isFavorited: item.is_favorited,
        visibility: item.visibility,
        canManage: Boolean(item.can_manage),
        folderId: item.folder_id ?? undefined,
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
    const response = await apiFetch(`${API_BASE_URL}/documents/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
      credentials: "same-origin",
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
      visibility?: string;
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
        visibility: item.visibility ?? "private",
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
    const response = await apiFetch(`${API_BASE_URL}/templates`, {
      cache: "no-store",
      credentials: "same-origin",
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
    const response = await apiFetch(`${API_BASE_URL}/spaces`, {
      cache: "no-store",
      credentials: "same-origin",
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildTreeNode(item: {
  id: string;
  node_type: "folder" | "document";
  title: string;
  space_id: string;
  parent_folder_id?: string | null;
  sort_order?: number;
  visibility: string;
  updated_at: string;
  can_manage: boolean;
  document_type?: string | null;
  is_deleted: boolean;
  children?: Array<any>;
}): TreeNode {
  return {
    id: item.id,
    nodeType: item.node_type,
    title: item.title,
    spaceId: item.space_id,
    parentFolderId: item.parent_folder_id ?? undefined,
    sortOrder: item.sort_order ?? 0,
    visibility: item.visibility,
    updatedAt: formatDateTime(item.updated_at),
    canManage: Boolean(item.can_manage),
    documentType: item.document_type ?? undefined,
    isDeleted: Boolean(item.is_deleted),
    children: (item.children ?? []).map(buildTreeNode),
  };
}

function buildFolderSummary(item: {
  id: string;
  space_id: string;
  parent_folder_id?: string | null;
  title: string;
  visibility: string;
  icon?: string | null;
  sort_order: number;
  is_deleted: boolean;
  updated_at: string;
  can_manage: boolean;
}): FolderSummary {
  return {
    id: item.id,
    spaceId: item.space_id,
    parentFolderId: item.parent_folder_id ?? undefined,
    title: item.title,
    visibility: item.visibility,
    icon: item.icon ?? undefined,
    sortOrder: item.sort_order,
    isDeleted: Boolean(item.is_deleted),
    updatedAt: formatDateTime(item.updated_at),
    canManage: Boolean(item.can_manage),
  };
}

export async function fetchSpaceRootChildren(spaceId: string): Promise<ApiItemResult<FolderChildrenResult>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/spaces/${spaceId}/root-children`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: null, unavailable: true };
    }
    const data = await response.json();
    return {
      data: {
        folder: data.folder ? buildFolderSummary(data.folder) : null,
        children: (data.children ?? []).map(buildTreeNode),
      },
      unavailable: false,
    };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function fetchSpaceTree(spaceId: string): Promise<ApiListResult<TreeNode>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/spaces/${spaceId}/tree`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: [], unavailable: true };
    }
    const data = await response.json();
    return {
      data: (data ?? []).map(buildTreeNode),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function fetchFolder(folderId: string): Promise<ApiItemResult<FolderSummary>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/folders/${folderId}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: null, unavailable: true };
    }
    return { data: buildFolderSummary(await response.json()), unavailable: false };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function fetchFolderChildren(folderId: string): Promise<ApiItemResult<FolderChildrenResult>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/folders/${folderId}/children`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: null, unavailable: true };
    }
    const data = await response.json();
    return {
      data: {
        folder: data.folder ? buildFolderSummary(data.folder) : null,
        children: (data.children ?? []).map(buildTreeNode),
      },
      unavailable: false,
    };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function fetchFolderAncestors(folderId: string): Promise<ApiListResult<AncestorItem>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/folders/${folderId}/ancestors`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: [], unavailable: true };
    }
    const data = await response.json();
    return {
      data: (data ?? []).map((item: { id: string; node_type: "folder"; title: string }) => ({
        id: item.id,
        nodeType: item.node_type,
        title: item.title,
      })),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function fetchDocumentAncestors(docId: string): Promise<ApiListResult<AncestorItem>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/ancestors`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: [], unavailable: true };
    }
    const data = await response.json();
    return {
      data: (data ?? []).map((item: { id: string; node_type: "folder"; title: string }) => ({
        id: item.id,
        nodeType: item.node_type,
        title: item.title,
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
  folderId?: string | null;
  documentType?: string;
  visibility?: "private" | "public";
}) {
  const response = await apiFetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      title: input.title,
      space_id: input.spaceId,
      parent_id: input.parentId ?? null,
      folder_id: input.folderId ?? null,
      document_type: input.documentType ?? "doc",
      visibility: input.visibility ?? "private",
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
  folderId?: string | null;
  file: File;
}) {
  const formData = new FormData();
  formData.append("space_id", input.spaceId);
  formData.append("folder_id", input.folderId ?? "");
  formData.append("title", input.title ?? "");
  formData.append("file", input.file);

  const response = await apiFetch(`${API_BASE_URL}/documents/upload-pdf`, {
    method: "POST",
    credentials: "same-origin",
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

export async function createFolder(input: {
  title: string;
  spaceId: string;
  parentFolderId?: string | null;
  visibility?: "private" | "public";
}) {
  const response = await apiFetch(`${API_BASE_URL}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      title: input.title,
      space_id: input.spaceId,
      parent_folder_id: input.parentFolderId ?? null,
      visibility: input.visibility ?? "private",
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to create folder");
  }
  return buildFolderSummary(await response.json());
}

export async function renameFolder(folderId: string, title: string, visibility?: "private" | "public") {
  const response = await apiFetch(`${API_BASE_URL}/folders/${folderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ title, visibility }),
  });
  if (!response.ok) {
    throw new Error("Failed to rename folder");
  }
  return buildFolderSummary(await response.json());
}

export async function deleteFolder(folderId: string) {
  const response = await apiFetch(`${API_BASE_URL}/folders/${folderId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Failed to delete folder");
  }
  return buildFolderSummary(await response.json());
}

export async function moveFolder(folderId: string, parentFolderId?: string | null) {
  const response = await apiFetch(`${API_BASE_URL}/folders/${folderId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ parent_folder_id: parentFolderId ?? null }),
  });
  if (!response.ok) {
    throw new Error("Failed to move folder");
  }
  return buildFolderSummary(await response.json());
}

export async function moveDocumentToFolder(docId: string, folderId?: string | null) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ folder_id: folderId ?? null }),
  });
  if (!response.ok) {
    throw new Error("Failed to move document");
  }
  const data = await response.json();
  return buildDocumentViewModel({
    ...data,
    file_url: resolveApiAssetUrl(data.file_url),
  });
}

export async function bulkMoveNodes(input: {
  spaceId: string;
  targetFolderId?: string | null;
  folderIds?: string[];
  documentIds?: string[];
}) {
  const response = await apiFetch(`${API_BASE_URL}/folders/bulk-move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      space_id: input.spaceId,
      target_folder_id: input.targetFolderId ?? null,
      folder_ids: input.folderIds ?? [],
      document_ids: input.documentIds ?? [],
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to bulk move nodes");
  }
  return response.json();
}

export async function reorderFolderChildren(input: {
  spaceId: string;
  parentFolderId?: string | null;
  items: Array<{ id: string; nodeType: "folder" | "document" }>;
}) {
  const response = await apiFetch(`${API_BASE_URL}/folders/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      space_id: input.spaceId,
      parent_folder_id: input.parentFolderId ?? null,
      items: input.items.map((item) => ({ id: item.id, node_type: item.nodeType })),
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to reorder nodes");
  }
  return response.json();
}

export async function uploadImageAsset(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch(`${API_BASE_URL}/documents/upload-image`, {
    method: "POST",
    credentials: "same-origin",
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
  const response = await apiFetch(`${API_BASE_URL}/documents/${input.docId}/content`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
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
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Failed to delete document");
  }

  return response.json();
}

export async function restoreDocument(docId: string) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/restore`, {
    method: "POST",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Failed to restore document");
  }

  return response.json();
}

export async function favoriteDocument(docId: string) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/favorite`, {
    method: "POST",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Failed to favorite document");
  }

  return response.json();
}

export async function unfavoriteDocument(docId: string) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/favorite`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Failed to unfavorite document");
  }

  return response.json();
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewPayload> {
  const response = await apiFetch(`${API_BASE_URL}/documents/link-preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
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

export async function fetchDocumentShareSettings(docId: string): Promise<ApiItemResult<ShareLinkSettings>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/share`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return { data: null, unavailable: false };
    }
    if (!response.ok) {
      return { data: null, unavailable: true };
    }
    return { data: buildShareLinkSettings(await response.json()), unavailable: false };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function updateDocumentVisibility(docId: string, visibility: "private" | "public") {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/access`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ visibility }),
  });
  if (!response.ok) {
    throw new Error("Failed to update document visibility");
  }
  return response.json() as Promise<{ visibility: string }>;
}

export async function upsertDocumentShare(
  docId: string,
  input: {
    enabled: boolean;
    expiresAt?: string | null;
    password?: string | null;
    allowCopy?: boolean;
    allowExport?: boolean;
  },
) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/share`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      enabled: input.enabled,
      expires_at: input.expiresAt ?? null,
      password: input.password ?? null,
      allow_copy: Boolean(input.allowCopy),
      allow_export: Boolean(input.allowExport),
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to update sharing settings");
  }
  return buildShareLinkSettings(await response.json());
}

export async function rotateDocumentShare(docId: string) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/share/rotate`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Failed to rotate share link");
  }
  return buildShareLinkSettings(await response.json());
}

export async function disableDocumentShare(docId: string) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/share`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Failed to disable share link");
  }
  return buildShareLinkSettings(await response.json());
}

function buildPermissionSettings(item: any): DocumentPermissionSettings {
  return {
    documentId: item.document_id,
    linkShareScope: item.link_share_scope,
    externalAccessEnabled: Boolean(item.external_access_enabled),
    commentScope: item.comment_scope,
    shareCollaboratorScope: item.share_collaborator_scope,
    copyScope: item.copy_scope,
    exportScope: item.export_scope,
    printScope: item.print_scope,
    downloadScope: item.download_scope,
    allowSearchIndex: Boolean(item.allow_search_index),
    watermarkEnabled: Boolean(item.watermark_enabled),
    updatedAt: item.updated_at,
  };
}

function buildPermissionMember(item: any): DocumentPermissionMember {
  return {
    id: item.id,
    documentId: item.document_id,
    subjectType: item.subject_type,
    subjectId: item.subject_id,
    permissionLevel: item.permission_level,
    invitedBy: item.invited_by,
    notify: Boolean(item.notify),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export async function fetchDocumentPermissionSettings(docId: string): Promise<ApiItemResult<DocumentPermissionSettings>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/permission-settings`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: null, unavailable: true };
    }
    return { data: buildPermissionSettings(await response.json()), unavailable: false };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function updateDocumentPermissionSettings(
  docId: string,
  input: Partial<{
    linkShareScope: string;
    externalAccessEnabled: boolean;
    commentScope: string;
    shareCollaboratorScope: string;
    copyScope: string;
    exportScope: string;
    printScope: string;
    downloadScope: string;
    allowSearchIndex: boolean;
    watermarkEnabled: boolean;
  }>,
): Promise<DocumentPermissionSettings> {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/permission-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      link_share_scope: input.linkShareScope,
      external_access_enabled: input.externalAccessEnabled,
      comment_scope: input.commentScope,
      share_collaborator_scope: input.shareCollaboratorScope,
      copy_scope: input.copyScope,
      export_scope: input.exportScope,
      print_scope: input.printScope,
      download_scope: input.downloadScope,
      allow_search_index: input.allowSearchIndex,
      watermark_enabled: input.watermarkEnabled,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to update permission settings");
  }
  return buildPermissionSettings(await response.json());
}

export async function fetchDocumentPermissions(docId: string): Promise<ApiListResult<DocumentPermissionMember>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/permissions`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: [], unavailable: true };
    }
    const data = await response.json();
    return { data: (data ?? []).map(buildPermissionMember), unavailable: false };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function addDocumentPermission(
  docId: string,
  input: { subjectType: string; subjectId: string; permissionLevel: string; notify?: boolean },
): Promise<DocumentPermissionMember> {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      permission_level: input.permissionLevel,
      notify: Boolean(input.notify),
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to add document permission");
  }
  return buildPermissionMember(await response.json());
}

export async function updateDocumentPermission(docId: string, permissionId: string, permissionLevel: string) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/permissions/${permissionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ permission_level: permissionLevel }),
  });
  if (!response.ok) {
    throw new Error("Failed to update document permission");
  }
  return buildPermissionMember(await response.json());
}

export async function deleteDocumentPermission(docId: string, permissionId: string) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/permissions/${permissionId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Failed to delete document permission");
  }
}

export async function transferDocumentOwner(docId: string, newOwnerId: string) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/transfer-owner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ new_owner_id: newOwnerId }),
  });
  if (!response.ok && response.status !== 204) {
    throw new Error("Failed to transfer document owner");
  }
}

export async function fetchDocumentPermissionAuditLogs(docId: string): Promise<ApiListResult<DocumentPermissionAuditLog>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/documents/${docId}/permission-audit-logs`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: [], unavailable: true };
    }
    const data = await response.json();
    return {
      data: (data ?? []).map((item: any) => ({
        id: item.id,
        documentId: item.document_id,
        actorId: item.actor_id,
        actorType: item.actor_type,
        action: item.action,
        targetType: item.target_type,
        targetId: item.target_id,
        reason: item.reason,
        createdAt: item.created_at,
      })),
      unavailable: false,
    };
  } catch {
    return { data: [], unavailable: true };
  }
}

export async function fetchSharedDocument(token: string): Promise<ApiItemResult<SharedDocumentResponse>> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/share/${token}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { data: null, unavailable: response.status >= 500 };
    }
    const data = await response.json();
    return {
      data: {
        status: data.status,
        document: data.document
          ? buildDocumentViewModel({ ...data.document, file_url: resolveApiAssetUrl(data.document.file_url) })
          : null,
        share: data.share ? buildShareLinkSettings(data.share) : null,
      },
      unavailable: false,
    };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function verifySharedDocumentPassword(token: string, password: string): Promise<SharedDocumentResponse> {
  const response = await apiFetch(`${API_BASE_URL}/share/${token}/verify-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    throw new Error("Failed to verify share password");
  }
  const data = await response.json();
  return {
    status: data.status,
    document: data.document
      ? buildDocumentViewModel({ ...data.document, file_url: resolveApiAssetUrl(data.document.file_url) })
      : null,
    share: data.share ? buildShareLinkSettings(data.share) : null,
  };
}
