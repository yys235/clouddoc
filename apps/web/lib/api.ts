import { buildDocumentViewModel, type DocumentViewModel } from "@/lib/mock-document";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_CLOUDDOC_API_BASE_URL ??
  process.env.CLOUDDOC_API_BASE_URL ??
  "http://127.0.0.1:8000/api";

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

export type SpaceSummary = {
  id: string;
  name: string;
  spaceType: string;
  visibility: string;
  updatedAt: string;
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

export async function fetchDocument(docId: string): Promise<DocumentViewModel | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return buildDocumentViewModel({
      ...data,
      file_url: resolveApiAssetUrl(data.file_url),
    });
  } catch {
    return null;
  }
}

export async function fetchDocuments(state = "active"): Promise<DashboardDocument[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents?state=${state}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as Array<{
      id: string;
      title: string;
      status: string;
      updated_at: string;
      is_deleted: boolean;
      is_favorited: boolean;
    }>;

    return data.map((item) => ({
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
    }));
  } catch {
    return [];
  }
}

export async function searchDocuments(query: string): Promise<SearchDocument[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/documents/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
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

    return data.map((item) => ({
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
    }));
  } catch {
    return [];
  }
}

export async function fetchTemplates(): Promise<TemplateItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/templates`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      created_at: string;
    }>;

    return data.map((item) => ({
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
    }));
  } catch {
    return [];
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

export async function fetchSpaces(): Promise<SpaceSummary[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/spaces`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as Array<{
      id: string;
      name: string;
      space_type: string;
      visibility: string;
      updated_at: string;
    }>;

    return data.map((item) => ({
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
    }));
  } catch {
    return [];
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
