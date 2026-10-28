export const STAGES = ["Sourced", "Screening", "Interview", "Hired"] as const;

export const PAGE_SIZE = 5;

export type Stage = (typeof STAGES)[number];

export type Candidate = {
  id: number;
  name: string;
  role: string;
  stage: Stage;
};

export type CandidatePage = {
  candidates: Candidate[];
  total: number;
  counts: Record<Stage, number>;
};

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export function parseListQuery(input: {
  q?: string | null;
  stage?: string | null;
  limit?: string | null;
  offset?: string | null;
}) {
  const q = (input.q ?? "").trim();
  const stage = (input.stage ?? "").trim(); 

  if (stage && !isStage(stage)) {
    return { error: "Stage must be Sourced, Screening, Interview, or Hired" as const };
  }

  let limit = input.limit == null || input.limit === "" ? PAGE_SIZE : Number(input.limit);
  let offset = input.offset == null || input.offset === "" ? 0 : Number(input.offset);
  if (!Number.isInteger(limit) || limit < 1) limit = PAGE_SIZE;
  if (limit > 50) limit = 50;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;

  return { q, stage, limit, offset };
}
