import { validateDemoCellContract } from "@/server/deployment/demo-cell-contract";

const result = validateDemoCellContract(process.env);

if (result.cell) {
  console.log(`Demo cell: ${result.cell.displayName} (${result.cell.cellId})`);
}

for (const warning of result.warnings) {
  console.warn(`WARN: ${warning}`);
}

for (const error of result.errors) {
  console.error(`ERROR: ${error}`);
}

if (!result.ok) {
  process.exitCode = 1;
} else {
  console.log("Demo cell contract verified.");
}
