import { AppShell } from "@/components/layout/app-shell";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { fetchTemplates } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const { data: templates, unavailable } = await fetchTemplates();

  return (
    <AppShell>
      <TemplateGallery templates={templates} apiUnavailable={unavailable} />
    </AppShell>
  );
}
