import type { CategoryValue } from "./config";

export type Media = { url: string; type: "image" | "video" };

export type Listing = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  category: CategoryValue;
  condition: string;
  description: string;
  tags: string[];
  hourlyRate: number | null;
  dailyRate: number | null;
  flatRate: number | null;
  quantity: number;
  deposit: number;
  available: boolean;
  rules: string[];
  agreementTemplate: string;
  media: Media[];
  location: string;
  createdAt: string;
};

export type ListingDraft = {
  title: string;
  category: CategoryValue | "";
  condition: string;
  description: string;
  tags: string[];
  hourlyRate: number | null;
  dailyRate: number | null;
  flatRate: number | null;
  quantity: number;
  deposit: number;
  available: boolean;
  rules: string[];
  agreementTemplate: string;
  media: Media[];
  location: string;
};

export type RentalStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";

export type Rental = {
  id: string;
  listingId: string | null;
  listingTitle: string;
  borrowerId: string;
  borrowerName: string;
  ownerId: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  days: number;
  quantity: number;
  subtotal: number;
  fee: number;
  deposit: number;
  status: RentalStatus;
  note: string;
  createdAt: string;
};

export type Me = {
  id: string;
  name: string;
  phoneLast4: string;
  verified: boolean;
  stripeConnected: boolean;
  unread: number;
};

export type ConversationSummary = {
  id: string;
  listingId: string | null;
  listingTitle: string;
  otherName: string;
  lastMessage: string | null;
  updatedAt: string;
};

export type Message = { id: string; senderId: string; body: string; createdAt: string };

export type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};
