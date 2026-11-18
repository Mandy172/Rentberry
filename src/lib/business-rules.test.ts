import { describe, expect, it } from "vitest";
import { PLATFORM_FEE_RATE } from "./config";
import { daysBetween, estimateEarnings, rentalQuote } from "./pricing";
import { remainingQuantity } from "./rentals.functions";
import { isAllowedMediaUrl, normalizePhone } from "./validation";

const rates = { dailyRate: null, hourlyRate: null, flatRate: null, deposit: 0 };

describe("BorrowBee business rules", () => {
  it("charges a 12.5% platform fee", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.125);
    expect(rentalQuote({ ...rates, dailyRate: 300 }, 1, 1)).toMatchObject({ subtotal: 300, fee: 37.5, ownerPayout: 262.5 });
  });

  it("prices daily first, then flat, then hourly at 8 hours a day", () => {
    expect(rentalQuote({ ...rates, dailyRate: 100, flatRate: 999, hourlyRate: 50 }, 3, 1).subtotal).toBe(300);
    expect(rentalQuote({ ...rates, flatRate: 500, hourlyRate: 50 }, 3, 2).subtotal).toBe(1000);
    expect(rentalQuote({ ...rates, hourlyRate: 50 }, 2, 1).subtotal).toBe(800);
  });

  it("multiplies the deposit by quantity", () => {
    expect(rentalQuote({ ...rates, dailyRate: 100, deposit: 1500 }, 1, 2).deposit).toBe(3000);
  });

  it("counts rental days inclusively", () => {
    expect(daysBetween("2026-11-18", "2026-11-18")).toBe(1);
    expect(daysBetween("2026-11-18", "2026-11-20")).toBe(3);
    expect(daysBetween("2026-11-20", "2026-11-18")).toBe(0);
  });

  it("estimates monthly earnings after the fee", () => {
    expect(estimateEarnings(400, 6)).toEqual({ gross: 2400, fee: 300, net: 2100 });
  });

  it("counts only overlapping pending or accepted rentals against stock", () => {
    const existing = [
      { startDate: "2026-11-18", endDate: "2026-11-20", quantity: 1, status: "accepted" as const },
      { startDate: "2026-11-19", endDate: "2026-11-19", quantity: 1, status: "pending" as const },
      { startDate: "2026-11-18", endDate: "2026-11-20", quantity: 5, status: "declined" as const },
      { startDate: "2026-11-25", endDate: "2026-11-26", quantity: 2, status: "accepted" as const },
    ];
    expect(remainingQuantity(3, existing, "2026-11-19", "2026-11-19")).toBe(1);
    expect(remainingQuantity(3, existing, "2026-11-21", "2026-11-24")).toBe(3);
  });

  it("accepts Indian 10-digit mobiles and E.164 numbers only", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+14155550100")).toBe("+14155550100");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
  });

  it("only lets owners attach media from their own upload folder", () => {
    const owner = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    const file = "33333333-3333-4333-8333-333333333333.jpg";
    expect(isAllowedMediaUrl(`/api/public/media/${owner}/${file}`, owner)).toBe(true);
    expect(isAllowedMediaUrl(`/api/public/media/${other}/${file}`, owner)).toBe(false);
    expect(isAllowedMediaUrl("https://evil.example.com/x.jpg", owner)).toBe(false);
  });
});
