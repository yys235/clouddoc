import { AppShell } from "@/components/layout/app-shell";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { fetchTemplates } from "@/lib/api";

export default async function TemplatesPage() {
  const templates = await fetchTemplates();

  return (
    <AppShell>
      <TemplateGallery templates={templates} />
    </AppShell>
  );
}
