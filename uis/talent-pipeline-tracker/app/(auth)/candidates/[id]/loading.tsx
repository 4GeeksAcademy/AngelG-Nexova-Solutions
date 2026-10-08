import { Loading } from "@/components/Loading";

export default function CandidateDetailLoading() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <Loading />
      </section>
    </main>
  );
}
