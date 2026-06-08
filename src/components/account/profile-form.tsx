"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { GENDER_OPTIONS, ID_TYPE_OPTIONS } from "@/lib/profile";
import { SRI_LANKA_PROVINCE_NAMES, getDistricts, ENABLED_COUNTRIES } from "@/lib/locations";

export type ProfileFormData = {
  name: string;
  email: string;
  phone: string;
  gender: string;
  birthday: string; // yyyy-mm-dd
  idType: string;
  idNumber: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    district: string;
    province: string;
    country: string;
    zip: string;
  };
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}

export function ProfileForm({
  initial,
  showSkip,
}: {
  initial: ProfileFormData;
  showSkip?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = React.useState<ProfileFormData>(initial);
  const [saving, setSaving] = React.useState(false);

  const set = <K extends keyof ProfileFormData>(k: K, v: ProfileFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setAddr = (k: keyof ProfileFormData["address"], v: string) =>
    setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }));

  const districts = getDistricts(form.address.province);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't save", description: data?.error ?? "Please try again." });
        return;
      }
      toast({ title: "Profile saved", description: "Your details have been updated." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Personal info</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Full name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email} disabled />
          </div>
          <div>
            <Label>Phone number</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+94 77 123 4567"
            />
          </div>
          <div>
            <Label>Gender</Label>
            <Select value={form.gender} onChange={(v) => set("gender", v)}>
              <option value="">Select…</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Birthday</Label>
            <Input type="date" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Loyalty &amp; identity</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your NIC or Passport to join the loyalty program and unlock member rewards.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>ID type</Label>
            <Select value={form.idType} onChange={(v) => set("idType", v)}>
              <option value="">Select…</option>
              {ID_TYPE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>NIC / Passport number</Label>
            <Input
              value={form.idNumber}
              onChange={(e) => set("idNumber", e.target.value)}
              placeholder="e.g. 200012345678"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Address</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Address line 1</Label>
            <Input value={form.address.line1} onChange={(e) => setAddr("line1", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Address line 2</Label>
            <Input value={form.address.line2} onChange={(e) => setAddr("line2", e.target.value)} />
          </div>
          <div>
            <Label>Country</Label>
            <Select value={form.address.country || "Sri Lanka"} onChange={(v) => setAddr("country", v)}>
              {ENABLED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Province</Label>
            <Select
              value={form.address.province}
              onChange={(v) => {
                setAddr("province", v);
                setAddr("district", "");
              }}
            >
              <option value="">Select…</option>
              {SRI_LANKA_PROVINCE_NAMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>District</Label>
            <Select
              value={form.address.district}
              onChange={(v) => setAddr("district", v)}
              disabled={!form.address.province}
            >
              <option value="">{form.address.province ? "Select…" : "Pick a province first"}</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Town / City</Label>
            <Input value={form.address.city} onChange={(e) => setAddr("city", e.target.value)} />
          </div>
          <div>
            <Label>Postal code</Label>
            <Input value={form.address.zip} onChange={(e) => setAddr("zip", e.target.value)} />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="brand" size="lg" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save profile"}
        </Button>
        {showSkip && (
          <Button type="button" variant="ghost" onClick={() => router.push("/account/tickets")}>
            Skip for now
          </Button>
        )}
      </div>
    </form>
  );
}
