import { redirect } from "next/navigation";

/** Legacy URL — public venue discovery moved to /venues. */
export default function PromotersRedirectPage() {
  redirect("/venues");
}
