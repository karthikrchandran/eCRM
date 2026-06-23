import { describe, expect, test } from "vitest";
import { formatCurrencyPaisa, formatDate } from "./report-formatters";

describe("report formatters", () => {
  test("formats money with the selected business currency", () => {
    expect(formatCurrencyPaisa(123456, "INR")).toBe("INR 1,234.56");
    expect(formatCurrencyPaisa(123456, "USD")).toBe("USD 1,234.56");
  });

  test("keeps report date empty states readable", () => {
    expect(formatDate(null)).toBe("Not set");
  });
});
