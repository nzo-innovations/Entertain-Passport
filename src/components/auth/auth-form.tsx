"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CREATOR_TYPES, PLACES_LABEL, ROUTES } from "@/lib/config";
import { bindBrowserSession, clearBrowserSession } from "@/lib/session-client";
import { RESIDENCY_OPTIONS, validateIdentity, type IdentityType } from "@/lib/identity";
import { CREATOR_ROLES, UserRole, isPortalRole, OrgType } from "@/lib/types";
import {
  CategoryTagPicker,
  type CatalogPick,
} from "@/components/shared/category-tag-picker";

type Variant = "customer" | "organizer" | "admin";

function destinationFor(role: string | null | undefined) {
  if (role === UserRole.SUPER_ADMIN) return "/admin";
  if (isPortalRole(role)) return "/portal";
  if (role === UserRole.GATE_STAFF) return ROUTES.gate;
  return ROUTES.discover;
}

function safeNextPath(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

// Which roles are allowed to sign in through each door.
const ALLOWED_ROLES: Record<Variant, string[]> = {
  customer: [UserRole.CUSTOMER],
  organizer: [...CREATOR_ROLES, UserRole.GATE_STAFF],
  admin: [UserRole.SUPER_ADMIN],
};

function correctDoorFor(role: string | null | undefined): { href: string; label: string } {
  if (role === UserRole.SUPER_ADMIN) return { href: ROUTES.adminLogin, label: "the admin login" };
  if (isPortalRole(role) || role === UserRole.GATE_STAFF)
    return { href: ROUTES.organizerLogin, label: "the organizer & gate-staff login" };
  return { href: ROUTES.customerLogin, label: "the ticket-buyer login" };
}

export function AuthForm({
  variant = "customer",
  allowSignup = true,
  title,
  subtitle,
}: {
  variant?: Variant;
  allowSignup?: boolean;
  title?: string;
  subtitle?: string;
} = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const isCustomer = variant === "customer";
  const isOrganizer = variant === "organizer";

  const [mode, setMode] = React.useState<"signin" | "signup">(() =>
    params.get("signup") === "1" ? "signup" : "signin"
  );
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [idType, setIdType] = React.useState<IdentityType>("NIC");
  const [idNumber, setIdNumber] = React.useState("");
  const [orgName, setOrgName] = React.useState("");
  const [orgType, setOrgType] = React.useState<string>(CREATOR_TYPES[0].value);
  const [placesCatalog, setPlacesCatalog] = React.useState<{
    mains: { id: string; name: string; slug: string }[];
    tags: { id: string; name: string; slug: string }[];
  }>({ mains: [], tags: [] });
  const [placesPick, setPlacesPick] = React.useState<CatalogPick>({
    mainCategoryId: "",
    subCategoryId: null,
    tagIds: [],
  });
  const [loadingPlaces, setLoadingPlaces] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(() => {
    const err = params.get("error");
    if (err === "window") {
      return "This gate session belongs to another browser window. Sign in again in this window.";
    }
    if (params.get("reason") === "idle") {
      return "You were signed out after 1 hour of inactivity. Please sign in again.";
    }
    if (err) return "Authentication failed. Please sign in again.";
    return null;
  });
  const [wrongDoor, setWrongDoor] = React.useState<{ href: string; label: string } | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const next = safeNextPath(params.get("next"));

  React.useEffect(() => {
    if (!isOrganizer || orgType !== OrgType.BUSINESS_OWNER) return;
    let cancelled = false;
    setLoadingPlaces(true);
    fetch("/api/catalog/categories?module=PLACES")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPlacesCatalog({ mains: data.mains ?? [], tags: data.tags ?? [] });
      })
      .finally(() => {
        if (!cancelled) setLoadingPlaces(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOrganizer, orgType]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    setWrongDoor(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Wait for auth cookies before hitting server routes.
      await supabase.auth.getSession();

      let role: string | null = null;
      try {
        const res = await fetch("/api/auth/role", { cache: "no-store", credentials: "include" });
        role = (await res.json())?.role ?? null;
      } catch {
        role = null;
      }

      if (role && !ALLOWED_ROLES[variant].includes(role)) {
        await clearBrowserSession();
        await supabase.auth.signOut();
        setWrongDoor(correctDoorFor(role));
        setError(
          variant === "customer"
            ? "This login is for ticket buyers only."
            : variant === "organizer"
            ? "This login is for organizers & gate staff only."
            : "This login is for platform admins only."
        );
        return;
      }

      await bindBrowserSession();

      if (isCustomer && next?.startsWith("/checkout")) {
        try {
          const meRes = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
          const me = await meRes.json();
          if (!me.profileComplete) {
            router.push(`${ROUTES.profile}?next=${encodeURIComponent(next)}`);
            router.refresh();
            return;
          }
        } catch {
          /* fall through to checkout */
        }
      }

      router.push(next ?? destinationFor(role));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const customerName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    let customerIdentity: { idType: IdentityType; idNumber: string } | null = null;
    if (isCustomer) {
      if (!firstName.trim() || !lastName.trim()) {
        setError("First name and last name are required.");
        setLoading(false);
        return;
      }

      const identityCheck = validateIdentity(idType, idNumber);
      if (!identityCheck.ok) {
        setError(identityCheck.error ?? "Enter a valid identity number.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/auth/check-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idType, idNumber: identityCheck.normalized }),
      });
      const identityData = await res.json().catch(() => ({}));
      if (!res.ok || !identityData.available) {
        setError(identityData?.error ?? "That identity number is already linked to another account.");
        setLoading(false);
        return;
      }
      customerIdentity = {
        idType,
        idNumber: identityData.normalized ?? identityCheck.normalized,
      };
    }

    const metadata: Record<string, string> = {
      name: isOrganizer ? name : isCustomer ? customerName : name,
      role: isOrganizer ? orgType : isCustomer ? UserRole.CUSTOMER : UserRole.SUPER_ADMIN,
    };
    if (isOrganizer) {
      metadata.orgType = orgType;
      metadata.orgName = orgName || name;
      if (orgType === OrgType.BUSINESS_OWNER) {
        if (!placesPick.mainCategoryId) {
          setError("Please select a Places to Go category.");
          setLoading(false);
          return;
        }
        metadata.placesMainCategoryId = placesPick.mainCategoryId;
        if (placesPick.subCategoryId) metadata.placesSubCategoryId = placesPick.subCategoryId;
        if (placesPick.tagIds.length) metadata.placesTagIds = JSON.stringify(placesPick.tagIds);
      }
    } else if (customerIdentity) {
      metadata.firstName = firstName.trim();
      metadata.lastName = lastName.trim();
      metadata.idType = customerIdentity.idType;
      metadata.idNumber = customerIdentity.idNumber;
      if (customerIdentity.idType === "NIC") metadata.nic = customerIdentity.idNumber;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/?verified=1")}`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      await bindBrowserSession();
      if (isOrganizer) {
        router.push(next ?? "/portal");
      } else if (next) {
        router.push(next);
      } else {
        router.push(`${ROUTES.discover}?welcome=1`);
      }
      router.refresh();
    } else {
      setInfo("Account created. Check your email to confirm, then sign in.");
      setMode("signin");
    }
  }

  const defaultTitle = isOrganizer
    ? mode === "signin"
      ? "Organizer sign in"
      : "Create your organizer account"
    : mode === "signin"
    ? "Sign in"
    : "Create your account";

  const defaultSubtitle = isOrganizer
    ? mode === "signin"
      ? "Event organizers, artist managers, artists & gate staff - sign in to your portal."
      : "Choose your role: Event Organizer, Artist Manager, Artist, or Company / Venue Owner."
    : next?.startsWith("/checkout")
    ? mode === "signin"
      ? "Sign in to complete your ticket purchase."
      : "Create an account to buy tickets - you'll finish your profile next."
    : mode === "signin"
    ? "Welcome back. Sign in to buy tickets and view your wallet."
    : "Create your account to buy tickets - we'll verify your identity and keep your data secure.";

  const residency = RESIDENCY_OPTIONS.find((o) => o.value === idType) ?? RESIDENCY_OPTIONS[0];

  return (
    <div className="rounded-3xl border bg-card p-8 shadow-xl">
      <div className="text-center">
        <Logo className="justify-center" />
        <h1 className="mt-6 font-display text-2xl font-bold">{title ?? defaultTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle ?? defaultSubtitle}</p>
      </div>

      <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="mt-6 space-y-3">
        {mode === "signup" && (
          <>
            {isCustomer ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">First name</span>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    required
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Last name</span>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </label>
                <div className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium">Are you a Sri Lankan resident?</span>
                  <p className="text-xs text-muted-foreground">
                  Your identification helps us securely verify your Entertain Passport.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {RESIDENCY_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                          idType === option.value ? "border-primary bg-primary/5" : "bg-background"
                        }`}
                      >
                        <input
                          type="radio"
                          name="residency"
                          value={option.value}
                          checked={idType === option.value}
                          onChange={() => {
                            setIdType(option.value);
                            setIdNumber("");
                          }}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        />
                        <span className="leading-snug">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{residency.description}</p>
                </div>
                <label className="block space-y-1.5 text-sm sm:col-span-2">
                  <span className="font-medium">{residency.fieldLabel}</span>
                  <Input
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                    placeholder={residency.fieldPlaceholder}
                    required
                  />
                </label>
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 sm:col-span-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                  Your NIC or passport is securely encrypted and used only to verify your identity 
                  and authenticate your Entertain Passport. We never misuse your personal data.
                  </p>
                </div>
              </div>
            ) : (
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Full name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </label>
            )}

            {isOrganizer && (
              <>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">I am a…</span>
                  <select
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {CREATOR_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">
                    {CREATOR_TYPES.find((t) => t.value === orgType)?.hint}
                  </span>
                </label>
                {orgType === OrgType.BUSINESS_OWNER && (
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Places to Go · registration
                    </p>
                    {loadingPlaces ? (
                      <p className="text-sm text-muted-foreground">Loading categories…</p>
                    ) : (
                      <CategoryTagPicker
                        module="PLACES"
                        mains={placesCatalog.mains}
                        tags={placesCatalog.tags}
                        value={placesPick}
                        onChange={setPlacesPick}
                        mainLabel="Places to Go category"
                        subLabel="Subcategory"
                        subRequired={false}
                        supportHref={ROUTES.contact}
                      />
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Company / venue owners get access to both Discover &amp; Shows (events) and{" "}
                      {PLACES_LABEL} from the organizer portal.
                    </p>
                  </div>
                )}
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">
                    {orgType === "ARTIST"
                      ? "Artist / stage name"
                      : orgType === "ARTIST_MANAGER"
                      ? "Artist / management name"
                      : "Organization / artist / brand name"}
                  </span>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder={
                      orgType === "ARTIST"
                        ? "e.g. Maya Ray"
                        : orgType === "ARTIST_MANAGER"
                        ? "e.g. Maya Ray Management"
                        : "e.g. BeatPulse Events"
                    }
                    required
                  />
                </label>
              </>
            )}
          </>
        )}

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Email</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            required
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            required
          />
        </label>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p>{error}</p>
            {wrongDoor && (
              <a href={wrongDoor.href} className="mt-1 inline-block font-medium underline">
                Go to {wrongDoor.label}
              </a>
            )}
          </div>
        )}
        {info && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Mail className="h-4 w-4" />
            {info}
          </p>
        )}

        <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      {allowSignup && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      )}

      {!isOrganizer && variant === "customer" && (
        <p className="mt-6 border-t pt-5 text-center text-xs text-muted-foreground">
          Want to sell tickets and publish shows?{" "}
          <a href={ROUTES.organizerLogin} className="font-medium text-primary hover:underline">
            Go to the organizer portal
          </a>
        </p>
      )}
    </div>
  );
}
