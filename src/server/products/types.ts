export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type ProductUser = {
  id: string;
  role: "ADMIN" | "SALES";
};

export type ProductServiceInput = {
  name: string;
  code?: string;
  category: string;
  description?: string;
  defaultGstRateBps: number;
  defaultProductionTemplateKey?: string;
  active: boolean;
  sortOrder: number;
};
