import type { ProductUser } from "./types";

export function assertCanViewProductServices(user: ProductUser) {
  if (user.role !== "ADMIN" && user.role !== "SALES") {
    throw new Error("You do not have permission to view products and services.");
  }
}

export function assertCanManageProductServices(user: ProductUser) {
  if (user.role !== "ADMIN") {
    throw new Error("Only Admin can manage products and services.");
  }
}
