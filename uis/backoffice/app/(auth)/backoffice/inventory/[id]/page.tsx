import { ManagedInventoryDetail } from "@/components/ManagedInventory";
import { notFound } from "next/navigation";

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isSafeInteger(itemId) || itemId <= 0) notFound();
  return <ManagedInventoryDetail itemId={itemId} />;
}
