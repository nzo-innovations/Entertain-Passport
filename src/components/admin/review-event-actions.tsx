"use client";

import { useRouter } from "next/navigation";
import { Check, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function ReviewEventActions({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const review = async (decision: string, note?: string) => {
    const res = await fetch(`/api/admin/events/${eventId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Review failed", description: data.error, variant: "destructive" });
      return;
    }
    toast({ title: `Event ${decision.toLowerCase().replace("_", " ")}` });
    router.refresh();
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="brand"
        size="sm"
        onClick={() => review("APPROVED", "Approved - event meets platform guidelines.")}
      >
        <Check className="h-4 w-4" />
        Approve & publish
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          review(
            "CHANGES_REQUESTED",
            "Please add more event images and complete the artist lineup in the description."
          )
        }
      >
        <MessageSquare className="h-4 w-4" />
        Request changes
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => review("REJECTED", "Event does not meet platform requirements at this time.")}
      >
        <X className="h-4 w-4" />
        Reject
      </Button>
    </div>
  );
}
