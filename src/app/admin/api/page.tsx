import { getVerifyDashboard } from "@/lib/verify/admin";
import { VerifyDashboard } from "@/components/admin/verify-dashboard";
import { VerifySetupNotice } from "@/components/admin/verify-setup-notice";

export const dynamic = "force-dynamic";

export default async function AdminVerifyPage() {
  try {
    const data = await getVerifyDashboard();
    return <VerifyDashboard data={data} />;
  } catch (err) {
    console.error("verification dashboard load failed", err);
    return <VerifySetupNotice />;
  }
}
