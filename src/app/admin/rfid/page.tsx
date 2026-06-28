import { redirect } from "next/navigation";

export default function AdminRfidRedirectPage() {
  redirect("/admin/nfc");
}
