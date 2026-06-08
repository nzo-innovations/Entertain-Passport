import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">404</p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">
          We couldn&apos;t find that page.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          The link might be broken, or the event may have ended. Try heading back to discover
          what&apos;s on tonight.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="brand" asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/events">Browse events</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
