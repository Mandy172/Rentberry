import { queryOptions } from "@tanstack/react-query";
import { getMe } from "./auth.functions";
import { getDraft, getListing, getMyListings, getSavedIds, getSavedListings, listListings, type ListingFilters } from "./listings.functions";
import { getMessages, listConversations, listNotifications } from "./messages.functions";
import { getMyRentals } from "./rentals.functions";

export const meQueryOptions = queryOptions({ queryKey: ["me"], queryFn: () => getMe(), staleTime: 30_000 });

export const listingsQueryOptions = (filters: ListingFilters) =>
  queryOptions({ queryKey: ["listings", filters], queryFn: () => listListings({ data: filters }) });

export const listingQueryOptions = (id: string) =>
  queryOptions({ queryKey: ["listing", id], queryFn: () => getListing({ data: { id } }) });

export const myListingsQueryOptions = queryOptions({ queryKey: ["me", "listings"], queryFn: () => getMyListings() });
export const draftQueryOptions = queryOptions({ queryKey: ["me", "draft"], queryFn: () => getDraft(), staleTime: Infinity });
export const savedIdsQueryOptions = queryOptions({ queryKey: ["me", "savedIds"], queryFn: () => getSavedIds() });
export const savedListingsQueryOptions = queryOptions({ queryKey: ["me", "saved"], queryFn: () => getSavedListings() });
export const myRentalsQueryOptions = queryOptions({ queryKey: ["me", "rentals"], queryFn: () => getMyRentals() });
export const conversationsQueryOptions = queryOptions({ queryKey: ["me", "conversations"], queryFn: () => listConversations() });
export const messagesQueryOptions = (conversationId: string) =>
  queryOptions({
    queryKey: ["me", "messages", conversationId],
    queryFn: () => getMessages({ data: { conversationId } }),
    refetchInterval: 10_000,
  });
export const notificationsQueryOptions = queryOptions({ queryKey: ["me", "notifications"], queryFn: () => listNotifications() });
