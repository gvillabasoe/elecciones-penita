import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/system/SetupNotice";
import { getCurrentMember } from "@/lib/auth/current-member";
import { collectDiagnostics } from "@/lib/system/diagnostics";

export const dynamic = "force-dynamic";

export default async function RaizPage() {
  let member = null;
  let failed = false;

  // La redirección debe quedar FUERA del try: redirect() señaliza lanzando.
  try {
    member = await getCurrentMember();
  } catch {
    failed = true;
  }

  if (failed) {
    return <SetupNotice diagnostics={await collectDiagnostics()} />;
  }

  redirect(member ? "/eleccion" : "/login");
}
