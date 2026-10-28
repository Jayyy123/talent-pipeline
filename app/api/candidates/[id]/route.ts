import { NextResponse } from "next/server";
import { getDb, updateCandidate } from "@/lib/db";
import { isStage, type Stage } from "@/lib/stages";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

function textField(value: unknown) {
  if (typeof value !== "string") return { error: "Name and role are required" as const };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return { error: "Name and role are required" as const };
  return { value: trimmed };
}

export async function PATCH(request: Request, context: Context) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid candidate id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const patch: { name?: string; role?: string; stage?: Stage } = {};

  if ("name" in record) {
    const name = textField(record.name);
    if ("error" in name) return NextResponse.json({ error: name.error }, { status: 400 });
    patch.name = name.value;
  }
  if ("role" in record) {
    const role = textField(record.role);
    if ("error" in role) return NextResponse.json({ error: role.error }, { status: 400 });
    patch.role = role.value;
  }
  if ("stage" in record) {
    if (!isStage(record.stage)) {
      return NextResponse.json(
        { error: "Stage must be Sourced, Screening, Interview, or Hired" },
        { status: 400 },
      );
    }
    patch.stage = record.stage;
  }

  if (patch.name === undefined && patch.role === undefined && patch.stage === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const candidate = updateCandidate(getDb(), id, patch);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    return NextResponse.json({ candidate });
  } catch {
    return NextResponse.json({ error: "Could not update candidate" }, { status: 500 });
  }
}
