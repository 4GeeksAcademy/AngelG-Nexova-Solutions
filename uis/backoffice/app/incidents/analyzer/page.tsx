import { IncidentsAnalyzerPanel } from "@/components/IncidentsAnalyzerPanel";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function IncidentsAnalyzerPage() {
  return (
    <ProtectedRoute>
      <IncidentsAnalyzerPanel />
    </ProtectedRoute>
  );
}