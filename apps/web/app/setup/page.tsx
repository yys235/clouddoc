import { SetupWizard } from "@/components/system/setup-wizard";
import { fetchBootstrapStatus } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const { data: status, unavailable } = await fetchBootstrapStatus();
  return <SetupWizard initialStatus={status} apiUnavailable={unavailable} />;
}
