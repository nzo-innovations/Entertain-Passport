"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

type Category = { id: string; name: string; slug: string; iconKey: string | null; eventCount: number };

const ICON_KEYS = ["music", "party-popper", "disc-3", "guitar", "mic-2", "mic", "album", "star"];

export function CategoriesManager({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [newName, setNewName] = React.useState("");
  const [newIcon, setNewIcon] = React.useState("music");
  const [busy, setBusy] = React.useState(false);

  const [editId, setEditId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editIcon, setEditIcon] = React.useState("music");

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), iconKey: newIcon }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't add", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Category added", description: newName.trim() });
      setNewName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id: string) => {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), iconKey: editIcon }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't save", description: data?.error, variant: "destructive" });
      return;
    }
    setEditId(null);
    toast({ title: "Category updated" });
    router.refresh();
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't delete", description: data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Category deleted" });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Plus className="h-4 w-4 text-primary" /> Add category
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name" />
          <select
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          >
            {ICON_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <Button variant="brand" onClick={create} disabled={busy || !newName.trim()}>
            Add
          </Button>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Icon</th>
              <th className="px-4 py-3 text-right">Events</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {initial.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                {editId === c.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9" />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{c.slug}</td>
                    <td className="px-4 py-2">
                      <select
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        className="h-9 rounded-lg border bg-background px-2 text-sm"
                      >
                        {ICON_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.eventCount}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => saveEdit(c.id)}>
                          <Check className="h-4 w-4 text-emerald-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        {c.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.iconKey ?? "-"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.eventCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditId(c.id);
                            setEditName(c.name);
                            setEditIcon(c.iconKey ?? "music");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(c)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
