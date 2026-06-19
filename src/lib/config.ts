/**
 * Platform-wide configuration constants for the Entertain Passport app.
 * Centralized here so links and defaults are not hard-coded across the UI.
 */

/** nZO Innovations contact page (legacy external link). Prefer in-app `/contact`. */
export const NZO_CONTACT_URL = "https://nzoinnovations.com/contact";

/** In-app contact & WhatsApp support. */
export const SUPPORT_CONTACTS = [
  {
    label: "Entertain Passport Support",
    display: "+94 773638063",
    tel: "+94773638063",
    whatsapp: "https://wa.me/94773638063",
  },
  {
    label: "Entertain Passport Support (Alt)",
    display: "+94 76 465 5741",
    tel: "+94764655741",
    whatsapp: "https://wa.me/94764655741",
  },
] as const;

/** Default platform commission percentage applied to new events. */
export const DEFAULT_COMMISSION_PCT = 5;

/** Auth entry points. */
export const ROUTES = {
  customerLogin: "/login",
  organizerLogin: "/organizer/login",
  organizerLanding: "/venues",
  venues: "/venues",
  adminLogin: "/third-eye/999/login",
  profile: "/account/profile",
  tickets: "/account/tickets",
  createEvent: "/portal/events/new",
  gate: "/gate",
  contact: "/contact",
} as const;

/** Public nav label for /venues — pubs, clubs, cafés, restaurants & dating spots. */
export const PLACES_LABEL = "Places to Go";

/**
 * Creator types at organizer signup. Each value is stored as both `User.role`
 * and `Organization.type` so each lane is easy to filter and manage.
 */
export const CREATOR_TYPES = [
  { value: "ORGANIZER", label: "Event Organizer", hint: "Promote concerts, festivals & shows" },
  { value: "ARTIST_MANAGER", label: "Artist Manager", hint: "Manage artist tours & album launches" },
  { value: "ARTIST", label: "Artist (self-managed)", hint: "An artist without a manager - run your own shows" },
  { value: "BUSINESS_OWNER", label: "Company / Venue Owner", hint: "Pub, café, club, restaurant or dating spot" },
] as const;

/** Payment methods surfaced at checkout (WebXPay gateway). */
export const PAYMENT_METHODS = [
  { id: "card", label: "Card", hint: "Visa · Mastercard · Amex", available: true },
  { id: "koko", label: "KOKO", hint: "Buy now, pay later - coming soon", available: false },
] as const;
