import Pipeline from "@/components/Pipeline";
import { isStage } from "@/lib/stages";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const params = await searchParams;
  const stage = (params.stage ?? "").trim();

  if (stage && !isStage(stage)) {
    return <p className="px-4 py-8 text-sm">That stage is not valid.</p>;
  }

  return <Pipeline initialQuery={(params.q ?? "").trim()} initialStage={stage} />;
}
