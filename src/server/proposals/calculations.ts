type ProposalLineCalculationInput = {
  quantity: number;
  unitPricePaisa: number;
  gstRateBps: number;
  manualTaxPaisa?: number;
};

type ProposalLineCalculation = ProposalLineCalculationInput & {
  lineSubtotalPaisa: number;
  lineGstPaisa: number;
  lineTotalPaisa: number;
};

export function calculateProposalTotals(lines: ProposalLineCalculationInput[]) {
  const calculatedLines: ProposalLineCalculation[] = lines.map((line) => {
    const lineSubtotalPaisa = line.quantity * line.unitPricePaisa;
    const lineGstPaisa = line.manualTaxPaisa ?? Math.round((lineSubtotalPaisa * line.gstRateBps) / 10_000);
    const lineTotalPaisa = lineSubtotalPaisa + lineGstPaisa;

    return {
      ...line,
      lineSubtotalPaisa,
      lineGstPaisa,
      lineTotalPaisa
    };
  });

  return {
    lines: calculatedLines,
    subtotalPaisa: calculatedLines.reduce((sum, line) => sum + line.lineSubtotalPaisa, 0),
    gstPaisa: calculatedLines.reduce((sum, line) => sum + line.lineGstPaisa, 0),
    totalPaisa: calculatedLines.reduce((sum, line) => sum + line.lineTotalPaisa, 0)
  };
}
