export type OfflineDocumentDraft = {
  docId: string;
  documentType: string;
  title: string;
  contentJson: Record<string, unknown>;
  plainText: string;
  signature: string;
  updatedAt: number;
};

const OFFLINE_DRAFT_PREFIX = "clouddoc:offline-document-draft:v1:";

function draftKey(docId: string) {
  return `${OFFLINE_DRAFT_PREFIX}${docId}`;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveOfflineDocumentDraft(draft: OfflineDocumentDraft) {
  if (!canUseLocalStorage()) return false;
  try {
    window.localStorage.setItem(draftKey(draft.docId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadOfflineDocumentDraft(docId: string): OfflineDocumentDraft | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(draftKey(docId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<OfflineDocumentDraft>;
    if (
      !draft ||
      draft.docId !== docId ||
      typeof draft.documentType !== "string" ||
      typeof draft.title !== "string" ||
      typeof draft.plainText !== "string" ||
      typeof draft.signature !== "string" ||
      typeof draft.updatedAt !== "number" ||
      !draft.contentJson ||
      typeof draft.contentJson !== "object"
    ) {
      return null;
    }
    return draft as OfflineDocumentDraft;
  } catch {
    return null;
  }
}

export function clearOfflineDocumentDraft(docId: string, signature?: string) {
  if (!canUseLocalStorage()) return false;
  try {
    if (signature) {
      const draft = loadOfflineDocumentDraft(docId);
      if (draft && draft.signature !== signature) {
        return false;
      }
    }
    window.localStorage.removeItem(draftKey(docId));
    return true;
  } catch {
    return false;
  }
}
