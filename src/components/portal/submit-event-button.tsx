"use client";

import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function SubmitEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <Button
      variant="brand"
      onClick={async () => {
        const res = await fetch(`/api/events/${eventId}/submit`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Cannot submit", description: data.error, variant: "destructive" });
          return;
        }
        toast({
          title: "Submitted for review",
          description: "nZO Super Admin will review your event. You'll see status updates here.",
        });
        router.refresh();
      }}
    >
      <Send className="h-4 w-4" />
      Submit for approval
    </Button>
  );
}
