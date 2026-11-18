export const BRAND = {
  name: "BorrowBee",
  tagline: "Borrow what you need. Earn from what you own.",
  community: "Ajeenkya DY Patil University",
  communityShort: "ADYPU",
  supportEmail: "support@borrowbee.app",
} as const;

export const PLATFORM_FEE_RATE = 0.125;
export const PLATFORM_FEE_LABEL = "12.5%";

export const CURRENCY = { code: "INR", symbol: "₹", locale: "en-IN" } as const;

export function formatMoney(amount: number) {
  return new Intl.NumberFormat(CURRENCY.locale, {
    style: "currency",
    currency: CURRENCY.code,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export const CAMPUS_LOCATIONS = [
  "Main Gate",
  "Central Library Plaza",
  "Engineering Block",
  "School of Design Studio",
  "Boys Hostel, Block A",
  "Girls Hostel, Block B",
  "Food Court",
  "Sports Complex",
  "Auditorium Lobby",
] as const;

export const CATEGORIES = [
  { value: "tools", label: "Tools & equipment", icon: "construction", examples: "Drills, saws, pressure washers, ladders" },
  { value: "event", label: "Party & event gear", icon: "celebration", examples: "Tables, chairs, bounce houses, heaters" },
  { value: "outdoor", label: "Outdoor & camping", icon: "forest", examples: "Tents, coolers, kayaks, bike racks" },
  { value: "electronics", label: "Cameras & electronics", icon: "photo_camera", examples: "Cameras, drones, projectors, speakers" },
  { value: "books", label: "Books & study gear", icon: "menu_book", examples: "Textbooks, calculators, lab coats, drafters" },
  { value: "other", label: "Everything else", icon: "category", examples: "Costumes, instruments, sports kit" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const CONDITIONS = ["New", "Like new", "Good", "Fair"] as const;

export const AGREEMENT_TEMPLATES = [
  {
    value: "standard",
    label: "Standard rental agreement",
    summary: "Return on time, in the same condition. Borrower covers damage beyond normal wear.",
  },
  {
    value: "event",
    label: "Event & party equipment",
    summary: "Includes setup/teardown responsibility and a cleaning clause for food or outdoor use.",
  },
  {
    value: "electronics",
    label: "Electronics & cameras",
    summary: "Covers battery, accessories and water damage. No modifications or firmware changes.",
  },
] as const;

export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 10,
  accept: ["image/png", "image/jpeg", "image/webp", "video/mp4"] as string[],
  acceptLabel: "PNG, JPG, WebP or MP4",
};

export const MOCK_OTP_CODE = "123456";
export const MEDIA_ROUTE_PREFIX = "/api/public/media/";
