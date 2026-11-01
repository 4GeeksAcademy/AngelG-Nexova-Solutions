import { notFound } from "next/navigation";
import { SupplierDirectory } from "@/components/SupplierDirectory";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  return <SupplierDirectory key={id} supplierId={Number(id)} />;
}
