import { ManagedInventoryDetail } from "@/components/ManagedInventory";
import { notFound } from "next/navigation";

export default async function NewInventoryOperationPage({ params }: {
  params: Promise<{ id: string; operation: string }>;
}) {
  const { id, operation } = await params;
  const itemId = Number(id);
  if (!Number.isSafeInteger(itemId) || itemId <= 0 || !["lots", "movements"].includes(operation)) notFound();
  return <ManagedInventoryDetail itemId={itemId} creation={operation === "lots" ? "lot" : "movement"} />;
}
