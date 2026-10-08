import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}