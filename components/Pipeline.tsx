"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  isStage,
  PAGE_SIZE,
  STAGES,
  type Candidate,
  type CandidatePage,
  type Stage,
} from "@/lib/stages";

type Toast = { id: number; tone: "ok" | "err"; text: string };
type EditState = { id: number; field: "name" | "role"; value: string; who: string };

const BOARD_LIMIT = 50;
const penClass = "shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900";

const emptyCounts: CandidatePage["counts"] = {
  Sourced: 0,
  Screening: 0,
  Interview: 0,
  Hired: 0,
}; 

function stageColor(stage: Stage) {
  if (stage === "Screening") return "border-amber-200 bg-amber-50 text-amber-950";
  if (stage === "Interview") return "border-sky-200 bg-sky-50 text-sky-950";
  if (stage === "Hired") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  return "border-zinc-200 bg-zinc-100 text-zinc-800";
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function pageUrl(q: string, stage: string, offset: number, limit: number) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (stage) params.set("stage", stage);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return `/api/candidates?${params}`;
}

async function fetchPage(q: string, stage: string, offset: number, limit: number) {
  const res = await fetch(pageUrl(q, stage, offset, limit), { cache: "no-store" });
  const data = (await res.json()) as CandidatePage & { error?: string };
  if (!res.ok || !data.candidates) {
    throw new Error(data.error || "Could not load candidates.");
  }
  return data;
}

export default function Pipeline({
  initialQuery,
  initialStage,
}: {
  initialQuery: string;
  initialStage: string;
}) {
  const [candidates, setCandidates] = useState<CandidatePage["candidates"]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(emptyCounts);
  const [query, setQuery] = useState(initialQuery);
  const [stage, setStage] = useState(initialStage);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(true);
  const [slow, setSlow] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState<number[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("");
  const [draftStage, setDraftStage] = useState<Stage>("Sourced");
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [view, setView] = useState<"table" | "board">("table");
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const requestId = useRef(0);
  const firstLoad = useRef(true);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savingIds = useRef(new Set<number>());

  function pushToast(tone: Toast["tone"], text: string) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }

  function applyPage(data: CandidatePage) {
    setCandidates(data.candidates);
    setTotal(data.total);
    setCounts(data.counts);
    setReady(true);
  }

  useEffect(() => {
    if (!pending || !ready) return;
    const timer = setTimeout(() => setSlow(true), 180);
    return () => clearTimeout(timer);
  }, [pending, ready]);

  useEffect(() => {
    const delay = firstLoad.current ? 0 : 200;
    firstLoad.current = false;
    const stageFilter = view === "board" ? "" : stage;
    const limit = view === "board" ? BOARD_LIMIT : PAGE_SIZE;
    const timer = setTimeout(() => {
      const id = ++requestId.current;
      setPending(true);
      fetchPage(query, stageFilter, 0, limit)
        .then((data) => {
          if (id !== requestId.current) return;
          applyPage(data);
          const params = new URLSearchParams();
          if (query.trim()) params.set("q", query.trim());
          if (stage) params.set("stage", stage);
          const qs = params.toString();
          window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
        })
        .catch((error: Error) => {
          if (id !== requestId.current) return;
          pushToast("err", error.message || "Could not load candidates.");
        })
        .finally(() => {
          if (id === requestId.current) {
            setPending(false);
            setSlow(false);
          }
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [query, stage, view]);

  useEffect(() => {
    if (!edit) return;
    dialogRef.current?.showModal();
  }, [edit]);

  async function reloadWindow(quiet = false) {
    const id = ++requestId.current;
    if (!quiet) setPending(true);
    const stageFilter = view === "board" ? "" : stage;
    const limit = view === "board" ? BOARD_LIMIT : Math.max(PAGE_SIZE, candidates.length);
    try {
      const data = await fetchPage(query, stageFilter, 0, limit);
      if (id !== requestId.current) return;
      applyPage(data);
    } catch (error) {
      if (id === requestId.current) {
        pushToast("err", error instanceof Error ? error.message : "Could not load candidates.");
      }
    } finally {
      if (id === requestId.current && !quiet) {
        setPending(false);
        setSlow(false);
      }
    }
  }

  async function onMore() {
    setLoadingMore(true);
    const id = ++requestId.current;
    try {
      const data = await fetchPage(query, stage, candidates.length, PAGE_SIZE);
      if (id !== requestId.current) return;
      setCandidates((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...data.candidates.filter((c) => !seen.has(c.id))];
      });
      setTotal(data.total);
      setCounts(data.counts);
    } catch (error) {
      if (id === requestId.current) {
        pushToast("err", error instanceof Error ? error.message : "Could not load candidates.");
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!draftName.trim() || !draftRole.trim()) {
      pushToast("err", "Name and role are required.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName, role: draftRole, stage: draftStage }),
      });
      const data = (await res.json()) as { error?: string; candidate?: { name: string } };
      if (!res.ok) {
        pushToast("err", data.error || "Could not add that candidate.");
        return;
      }
      setDraftName("");
      setDraftRole("");
      pushToast("ok", `Added ${data.candidate?.name || "candidate"}.`);
      await reloadWindow();
    } catch {
      pushToast("err", "Could not add that candidate.");
    } finally {
      setAdding(false);
    }
  }

  async function onStage(id: number, next: Stage) {
    const current = candidates.find((candidate) => candidate.id === id);
    if (!current || current.stage === next || savingIds.current.has(id)) return;
    const prevStage = current.stage;
    savingIds.current.add(id);
    setSaving((ids) => [...ids, id]);

    const move = (from: Stage, to: Stage) => {
      setCandidates((rows) => rows.map((candidate) => (candidate.id === id ? { ...candidate, stage: to } : candidate)));
      setCounts((prev) => ({
        ...prev,
        [from]: prev[from] - 1,
        [to]: prev[to] + 1,
      }));
    };

    move(prevStage, next);
    let saved = false;
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        move(next, prevStage);
        pushToast("err", data.error || "Could not save the stage.");
        return;
      }
      saved = true;
      await reloadWindow(true);
      pushToast("ok", "Stage saved.");
    } catch {
      if (!saved) {
        move(next, prevStage);
        pushToast("err", "Could not save the stage.");
      }
    } finally {
      savingIds.current.delete(id);
      setSaving((ids) => ids.filter((n) => n !== id));
    }
  }

  function openEdit(candidate: Candidate, field: "name" | "role") {
    setEditError("");
    setEdit({
      id: candidate.id,
      field,
      value: field === "name" ? candidate.name : candidate.role,
      who: candidate.name,
    });
  }

  function onCardDragStart(event: DragEvent<HTMLElement>, id: number) {
    if ((event.target as HTMLElement).closest("button")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", String(id));
    event.dataTransfer.effectAllowed = "move";
  }

  function onColumnDrop(event: DragEvent<HTMLElement>, next: Stage) {
    event.preventDefault();
    setOverStage(null);
    const id = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(id)) return;
    void onStage(id, next);
  }

  async function onEditSave(event: FormEvent) {
    event.preventDefault();
    if (!edit) return;
    const value = edit.value.trim();
    if (!value) {
      setEditError(edit.field === "name" ? "Name is required." : "Role is required.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/candidates/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [edit.field]: value }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        const message = data.error || "Could not save.";
        setEditError(message);
        pushToast("err", message);
        return;
      }
      setEdit(null);
      pushToast("ok", edit.field === "name" ? "Name saved." : "Role saved.");
      await reloadWindow();
    } catch {
      setEditError("Could not save.");
      pushToast("err", "Could not save.");
    } finally {
      setEditSaving(false);
    }
  }

  const allCount = STAGES.reduce((sum, item) => sum + counts[item], 0);
  const showSkeleton = !ready || slow;
  const fieldClass =
    "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Talent pipeline</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Name, role, and where they are in hiring.
        </p>
      </header>

      {showSkeleton ? (
        <div className="animate-pulse" aria-hidden="true">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-20 rounded-lg bg-zinc-200" />
            ))}
          </div>
          <div className="h-56 rounded-lg bg-zinc-200" />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <button
              type="button"
              aria-pressed={stage === ""}
              onClick={() => setStage("")}
              className={`rounded-lg border px-3 py-3 text-left shadow-sm transition-colors hover:shadow ${
                stage === "" ? "border-zinc-900 bg-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
              }`}
            >
              <span className="block text-2xl font-semibold">{allCount}</span>
              <span className="text-sm text-zinc-600">All</span>
            </button>
            {STAGES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={stage === item}
                onClick={() => setStage(stage === item ? "" : item)}
                className={`rounded-lg border px-3 py-3 text-left shadow-sm transition-colors hover:shadow ${
                  stage === item ? "ring-2 ring-zinc-900 ring-offset-2" : ""
                } ${stageColor(item)}`}
              >
                <span className="block text-2xl font-semibold">{counts[item]}</span>
                <span className="text-sm">{item}</span>
              </button>
            ))}
          </div>

          <div className="card-in mb-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <label className="block text-sm" htmlFor="name-search">
              <span className="mb-1 block">Search by name</span>
              <input
                id="name-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={fieldClass}
              />
            </label>

            <form onSubmit={(event) => void onAdd(event)} className="mt-4 border-t border-zinc-100 pt-4">
              <p className="mb-2 text-sm font-medium">Add a candidate</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 text-sm" htmlFor="new-name">
                  <span className="mb-1 block">Name</span>
                  <input
                    id="new-name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="flex-1 text-sm" htmlFor="new-role">
                  <span className="mb-1 block">Role</span>
                  <input
                    id="new-role"
                    value={draftRole}
                    onChange={(event) => setDraftRole(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="text-sm sm:w-40" htmlFor="new-stage">
                  <span className="mb-1 block">Stage</span>
                  <select
                    id="new-stage"
                    value={draftStage}
                    onChange={(event) => {
                      if (isStage(event.target.value)) setDraftStage(event.target.value);
                    }}
                    className={fieldClass}
                  >
                    {STAGES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-60"
                >
                  {adding ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>

          <div className="mb-3 flex justify-end gap-1">
            <button
              type="button"
              title="Table view"
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className={`group relative rounded-md border p-2 ${
                view === "table" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <TableIcon />
              <Tip>Table view</Tip>
            </button>
            <button
              type="button"
              title="Board view"
              aria-label="Board view"
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
              className={`group relative rounded-md border p-2 ${
                view === "board" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <BoardIcon />
              <Tip>Board view</Tip>
            </button>
          </div>

          {view === "board" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STAGES.map((item) => {
                const rows = candidates.filter((candidate) => candidate.stage === item);
                return (
                  <section
                    key={item}
                    aria-label={item}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setOverStage(item);
                    }}
                    onDrop={(event) => onColumnDrop(event, item)}
                    className={`rounded-lg border p-2 ${stageColor(item)} ${
                      overStage === item ? "ring-2 ring-zinc-900 ring-offset-2" : ""
                    }`}
                  >
                    <h2 className="mb-2 flex items-baseline justify-between px-1 text-sm font-medium">
                      {item}
                      <span>{rows.length}</span>
                    </h2>
                    <div className="flex min-h-28 flex-col gap-2">
                      {rows.length === 0 ? (
                        <p className="px-1 py-4 text-sm opacity-70">None</p>
                      ) : (
                        rows.map((candidate) => (
                          <article
                            key={candidate.id}
                            draggable={!saving.includes(candidate.id)}
                            onDragStart={(event) => onCardDragStart(event, candidate.id)}
                            onDragEnd={() => setOverStage(null)}
                            className={`cursor-grab rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-sm active:cursor-grabbing ${
                              saving.includes(candidate.id) ? "stage-pending" : ""
                            }`}
                          >
                            <span className="flex items-start gap-2">
                              <span className="min-w-0 flex-1 break-words font-medium">{candidate.name}</span>
                              <button
                                type="button"
                                title="Edit name"
                                aria-label={`Edit name for ${candidate.name}`}
                                onClick={() => openEdit(candidate, "name")}
                                className={penClass}
                              >
                                <PenIcon />
                              </button>
                            </span>
                            <span className="mt-1 flex items-start gap-2">
                              <span className="min-w-0 flex-1 break-words text-zinc-600">{candidate.role}</span>
                              <button
                                type="button"
                                title="Edit role"
                                aria-label={`Edit role for ${candidate.name}`}
                                onClick={() => openEdit(candidate, "role")}
                                className={penClass}
                              >
                                <PenIcon />
                              </button>
                            </span>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <>
          <div className="card-in overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="w-[38%] rounded-tl-lg px-3 py-2 font-medium">Name</th>
                  <th className="w-[38%] px-3 py-2 font-medium">Role</th>
                  <th className="rounded-tr-lg px-3 py-2 font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-zinc-600">
                      No candidates match.
                    </td>
                  </tr>
                ) : (
                  candidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className={`border-t border-zinc-200 transition-colors hover:bg-zinc-50 ${
                        saving.includes(candidate.id) ? "stage-pending" : ""
                      }`}
                    >
                      <td className="px-3 py-2 align-top">
                        <span className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 break-words">{candidate.name}</span>
                          <button
                            type="button"
                            title="Edit name"
                            aria-label={`Edit name for ${candidate.name}`}
                            onClick={() => openEdit(candidate, "name")}
                            className={penClass}
                          >
                            <PenIcon />
                          </button>
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 break-words">{candidate.role}</span>
                          <button
                            type="button"
                            title="Edit role"
                            aria-label={`Edit role for ${candidate.name}`}
                            onClick={() => openEdit(candidate, "role")}
                            className={penClass}
                          >
                            <PenIcon />
                          </button>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Stage for ${candidate.name}`}
                          value={candidate.stage}
                          disabled={saving.includes(candidate.id)}
                          onChange={(event) => {
                            if (isStage(event.target.value)) {
                              void onStage(candidate.id, event.target.value);
                            }
                          }}
                          className={`rounded-md border px-2 py-1 ${stageColor(candidate.stage)}`}
                        >
                          {STAGES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-3 text-sm text-zinc-600">
            <span>
              Showing {candidates.length} of {total}
            </span>
            {candidates.length < total ? (
              <button
                type="button"
                onClick={() => void onMore()}
                disabled={loadingMore}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            ) : null}
          </div>
            </>
          )}
        </>
      )}

      {edit ? (
      <dialog
        ref={dialogRef}
        onClose={() => setEdit(null)}
        className="w-[min(24rem,calc(100%-2rem))] rounded-lg border border-zinc-200 bg-white p-5 text-zinc-900 shadow-lg"
      >
        <form onSubmit={(event) => void onEditSave(event)}>
          <h2 className="text-lg font-semibold">
            {edit?.field === "role" ? "Edit role" : "Edit name"}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">{edit?.who}</p>
          <label className="mt-4 block text-sm" htmlFor="edit-value">
            <span className="mb-1 block">{edit?.field === "role" ? "Role" : "Name"}</span>
            <input
              id="edit-value"
              value={edit?.value ?? ""}
              onChange={(event) => {
                setEdit((current) => (current ? { ...current, value: event.target.value } : current));
              }}
              className={fieldClass}
            />
          </label>
          {editError ? <p className="mt-2 text-sm text-red-700">{editError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEdit(null)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSaving}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-60"
            >
              {editSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </dialog>
      ) : null}

      <div className="fixed right-4 bottom-4 z-20 flex w-72 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "err" ? "alert" : "status"}
            className={`rounded-lg border bg-white px-3 py-2 text-sm shadow-lg ${
              toast.tone === "err" ? "border-red-300 text-red-800" : "border-emerald-300 text-emerald-900"
            }`}
          >
            <div className="flex items-start gap-2">
              {toast.tone === "err" ? <ErrorIcon /> : <CheckIcon />}
              <p className="flex-1">{toast.text}</p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                className="rounded p-1 hover:bg-zinc-100"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tip({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-1 hidden -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
      {children}
    </span>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="11" rx="1" />
      <rect x="17" y="4" width="4" height="14" rx="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
