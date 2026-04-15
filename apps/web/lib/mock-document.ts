export type RichTextNode = {
  type: string;
  text?: string;
  attrs?: Record<string, string | number | boolean>;
  marks?: Array<{ type: string; attrs?: Record<string, string> }>;
  content?: RichTextNode[];
};

export type DocumentViewModel = {
  id: string;
  title: string;
  ownerId: string;
  documentType: string;
  visibility: string;
  updatedAt: string;
  spaceId?: string;
  folderId?: string;
  sortOrder?: number;
  saveStatus: string;
  isFavorited: boolean;
  canEdit: boolean;
  canManage: boolean;
  canComment: boolean;
  isSharedView: boolean;
  outline: Array<{ id: string; title: string; level: number }>;
  content: RichTextNode[];
  summary?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

export function buildOutline(content: RichTextNode[]) {
  return content
    .filter((node) => node.type === "heading")
    .map((node, index) => {
      const anchor = String(node.attrs?.block_id ?? node.attrs?.anchor ?? `section-${index + 1}`);
      const title =
        node.content
          ?.map((child) => child.text ?? "")
          .join("")
          .trim() || `Section ${index + 1}`;
      return {
        id: anchor,
        title,
        level: Number(node.attrs?.level ?? 1),
      };
    });
}

export function buildDocumentViewModel(data: {
  id: string;
  title: string;
  owner_id: string;
  document_type?: string;
  visibility?: string;
  updated_at?: string;
  space_id?: string;
  folder_id?: string | null;
  sort_order?: number;
  is_favorited?: boolean;
  can_edit?: boolean;
  can_manage?: boolean;
  can_comment?: boolean;
  is_shared_view?: boolean;
  content?: { content_json?: { content?: RichTextNode[] } };
  summary?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
}): DocumentViewModel {
  const content = data.content?.content_json?.content ?? [];
  return {
    id: data.id,
    title: data.title || "未命名文档",
    ownerId: data.owner_id,
    documentType: data.document_type || "doc",
    visibility: data.visibility || "private",
    spaceId: data.space_id ?? undefined,
    folderId: data.folder_id ?? undefined,
    sortOrder: data.sort_order ?? 0,
    updatedAt: data.updated_at
      ? new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(data.updated_at))
      : "--",
    saveStatus: "已同步",
    isFavorited: Boolean(data.is_favorited),
    canEdit: Boolean(data.can_edit),
    canManage: Boolean(data.can_manage),
    canComment: Boolean(data.can_comment),
    isSharedView: Boolean(data.is_shared_view),
    outline: buildOutline(content),
    content,
    summary: data.summary ?? undefined,
    fileUrl: data.file_url ?? undefined,
    fileName: data.file_name ?? undefined,
    mimeType: data.mime_type ?? undefined,
    fileSize: data.file_size ?? undefined,
  };
}
