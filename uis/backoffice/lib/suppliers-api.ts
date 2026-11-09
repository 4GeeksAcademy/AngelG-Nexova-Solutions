import { authRequest } from "@/lib/api-client";

export const supplierCategories = {
  job_boards: "Portales de empleo",
  ats_software: "Software ATS",
  assessment_tools: "Evaluación de candidatos",
  training_platforms: "Plataformas de formación",
  payroll_and_hr_software: "Nóminas y RRHH",
  video_interview: "Videoentrevistas",
  background_check: "Verificación de antecedentes",
  office_and_facilities: "Oficina e instalaciones",
  it_and_software_licenses: "TI y licencias",
};

export interface SupplierPayload {
  name: string;
  country: "Spain" | "USA";
  categories: (keyof typeof supplierCategories)[];
  monthly_rate: number;
  currency: "EUR" | "USD";
  status: "active" | "suspended";
  contract_renewal_date: string | null;
  contact_email: string | null;
  notes: string | null;
}

export interface Supplier extends SupplierPayload {
  id: number;
  updated_at: string;
}

/** Compact fields returned by GET /suppliers for directory rows and selectors. */
export type SupplierListItem = Pick<
  Supplier,
  "id" | "name" | "country" | "categories" | "monthly_rate" | "currency" | "status"
>;

export const getSuppliers = () => authRequest<SupplierListItem[]>("/suppliers");
export const getSupplier = (id: number) => authRequest<Supplier>(`/suppliers/${id}`);
export const createSupplier = (payload: SupplierPayload) =>
  authRequest<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(payload) });
export const updateSupplierRate = (id: number, monthly_rate: number) =>
  authRequest<Supplier>(`/suppliers/${id}/rate`, { method: "PATCH", body: JSON.stringify({ monthly_rate }) });
export const updateSupplierStatus = (id: number, status: Supplier["status"]) =>
  authRequest<Supplier>(`/suppliers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
export const deleteSupplier = (id: number) =>
  authRequest<void>(`/suppliers/${id}`, { method: "DELETE" });
