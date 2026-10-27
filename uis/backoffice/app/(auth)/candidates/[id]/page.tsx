import { CandidateDetail } from "@/components/CandidateDetail";

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({
  params,
}: CandidateDetailPageProps) {
  const { id } = await params;

  return <CandidateDetail candidateId={id} />;
}
