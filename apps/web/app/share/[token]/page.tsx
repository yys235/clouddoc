import { SharedDocumentPage } from "@/components/editor/shared-document-page";
import { fetchSharedDocument } from "@/lib/api";

export const dynamic = "force-dynamic";

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
