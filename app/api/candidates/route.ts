import { NextResponse } from "next/server";
import { addCandidate, getDb, listCandidates } from "@/lib/db";
import { isStage, parseListQuery } from "@/lib/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseListQuery({
    q: url.searchParams.get("q"),
    stage: url.searchParams.get("stage"),
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
  });

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    return NextResponse.json(listCandidates(getDb(), parsed));
  } catch {
    return NextResponse.json({ error: "Could not load candidates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  } 

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const role = typeof record.role === "string" ? record.role.trim() : "";

  if (!name || !role || name.length > 80 || role.length > 80) {
    return NextResponse.json({ error: "Name and role are required" }, { status: 400 });
  }
  if (!isStage(record.stage)) {
    return NextResponse.json(
      { error: "Stage must be Sourced, Screening, Interview, or Hired" },
      { status: 400 },
    );
  }

  try {
    const candidate = addCandidate(getDb(), name, role, record.stage);
    return NextResponse.json({ candidate }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not add candidate" }, { status: 500 });
  }
}
