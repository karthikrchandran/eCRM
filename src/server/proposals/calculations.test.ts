import { describe, expect, it } from "vitest";
import { calculateProposalTotals } from "./calculations";

describe("proposal calculations", () => {
  it("calculates GST and proposal totals in integer paise", () => {
    expect(
      calculateProposalTotals([
        { quantity: 2, unitPricePaisa: 100_000, gstRateBps: 1800 },
        { quantity: 1, unitPricePaisa: 50_000, gstRateBps: 500 }
      ])
    ).toEqual({
      lines: [
        {
          quantity: 2,
          unitPricePaisa: 100_000,
          gstRateBps: 1800,
          lineSubtotalPaisa: 200_000,
          lineGstPaisa: 36_000,
          lineTotalPaisa: 236_000
        },
        {
          quantity: 1,
          unitPricePaisa: 50_000,
          gstRateBps: 500,
          lineSubtotalPaisa: 50_000,
          lineGstPaisa: 2_500,
          lineTotalPaisa: 52_500
        }
      ],
      subtotalPaisa: 250_000,
      gstPaisa: 38_500,
      totalPaisa: 288_500
    });
  });

  it("uses manually entered tax for USD lines", () => {
    expect(
      calculateProposalTotals([{ quantity: 2, unitPricePaisa: 50_000, gstRateBps: 0, manualTaxPaisa: 8_875 }])
    ).toEqual({
      lines: [
        {
          quantity: 2,
          unitPricePaisa: 50_000,
          gstRateBps: 0,
          manualTaxPaisa: 8_875,
          lineSubtotalPaisa: 100_000,
          lineGstPaisa: 8_875,
          lineTotalPaisa: 108_875
        }
      ],
      subtotalPaisa: 100_000,
      gstPaisa: 8_875,
      totalPaisa: 108_875
    });
  });
});
