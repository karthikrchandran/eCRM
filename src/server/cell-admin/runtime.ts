import { db } from "@/server/db";
import { PrismaCellAdministrationRepository } from "./repository";
import { CellAdministrationService } from "./service";

export function getCellAdministrationService() {
  return new CellAdministrationService(new PrismaCellAdministrationRepository(db));
}
