export type ReportCurrency = "INR" | "USD";

export function formatCurrencyPaisa(value: number, currency: ReportCurrency) {
  const locale = currency === "USD" ? "en-US" : "en-IN";

  return `${currency} ${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

export function formatInrPaisa(value: number) {
  return formatCurrencyPaisa(value, "INR");
}

export function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value) : "Not set";
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}
