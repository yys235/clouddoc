import type { Metadata } from "next";

import { SharedDocumentPage } from "@/components/editor/shared-document-page";
import { fetchSharedDocument } from "@/lib/api";

export const dynamic = "force-dynamic";

function documentTitle(title?: string | null) {
  const normalizedTitle = title?.trim();
  return normalizedTitle ? `${normalizedTitle} - CloudDoc` : "CloudDoc";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const { data } = await fetchSharedDocument(token);

  return {
    title: documentTitle(data?.document?.title),
  };
}

export default async function SharedDocumentRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { data } = await fetchSharedDocument(token);

  return (
    <SharedDocumentPage
      token={token}
      initialStatus={data?.status ?? "not_found"}
      initialDocument={data?.document ?? null}
      initialShare={data?.share ?? null}
    />
  );
}
