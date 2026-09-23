import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { projectPoints, rankWaiverPool, type ScoringFormat, type SlotPosition } from "./ranking";

import type { RosterEntry } from "./weakness";

export interface AskInput {
  question: string;
  format: ScoringFormat;
  roster: RosterEntry[];
  maxOwnership: number;
}

export interface AskAnswer {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
  /** The available players the model was shown, so the UI can list its sources. */
  candidates: CandidateBrief[];
}

export interface CandidateBrief {
  name: string;
  position: string;
  team: string | null;
  ownership: number;
  projection: number;
  score: number;
}

const SLOTS: SlotPosition[] = ["QB", "RB", "WR", "TE"];
const PER_SLOT = 8;

/** Ask the Lovable AI Gateway and return the finished text (streamed on the wire). */
async function askGateway(system: string, prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this app yet.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions: system,
      input: prompt,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("The advisor is busy right now — try again shortly.");
    if (res.status === 402)
      throw new Error("AI credits have run out for this app. Top up to keep asking questions.");
    throw new Error(`The advisor could not answer just now. (${res.status}) ${detail.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (!text && event.type === "response.completed" && event.response?.output_text) {
          text = event.response.output_text;
        }
      } catch {
        /* ignore keep-alive and partial frames */
      }
    }
  }

  return text.trim();
}

function rosterLine(e: RosterEntry, points: number | null): string {
  return `- ${e.name} (${e.position}, ${e.starter ? "starter" : "bench"})${
    points === null ? "" : ` — projected ${points.toFixed(1)} pts/wk`
  }`;
}

const SYSTEM = [
  "You are Wire Tap's fantasy football waiver advisor.",
  "Answer only from the roster and the available-player list you are given — never invent players, stats or ownership numbers.",
  "Be direct and specific: name the one or two best fits, say which roster player they replace or sit behind, and give the reason in plain language a casual player understands.",
  "Mention projected points and rostered % when they support the call. Flag injuries you were told about.",
  "Keep it under 220 words, no headings, short paragraphs or a tight list.",
].join(" ");

export const askWaiver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AskInput) => {
    const question = data.question?.trim() ?? "";
    if (question.length < 5) throw new Error("Add a little more detail to your question.");
    if (question.length > 600) throw new Error("That question is too long — trim it a bit.");
    return { ...data, question };
  })
  .handler(async ({ data, context }): Promise<AskAnswer> => {
    const { getPlayerPool } = await import("./players.server");
    const pool = await getPlayerPool();
    const stats = new Map(pool.map((p) => [p.id, p]));

    const rosterIds = new Set(data.roster.map((r) => r.id));
    const available = pool.filter((p) => !rosterIds.has(p.id));

    const seen = new Set<string>();
    const candidates: CandidateBrief[] = [];
    for (const slot of SLOTS) {
      const ranked = rankWaiverPool(available, {
        format: data.format,
        slot,
        maxOwnership: data.maxOwnership,
      }).slice(0, PER_SLOT);
      for (const p of ranked) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        candidates.push({
          name: p.name,
          position: p.position,
          team: p.team,
          ownership: Math.round(p.ownership),
          projection: Math.round(p.projection * 10) / 10,
          score: Math.round(p.score),
        });
      }
    }

    const rosterText =
      data.roster.length === 0
        ? "(no roster saved yet)"
        : data.roster
            .map((e) => {
              const s = stats.get(e.id);
              return rosterLine(e, s ? projectPoints(s, data.format) : null);
            })
            .join("\n");

    const candidateText = candidates
      .map(
        (c) =>
          `- ${c.name} (${c.position}${c.team ? `, ${c.team}` : ""}) — projected ${c.projection} pts/wk, ${c.ownership}% rostered, Wire Tap score ${c.score}`,
      )
      .join("\n");

    const prompt = [
      `Scoring format: ${data.format === "std" ? "standard" : data.format}.`,
      "",
      "My roster:",
      rosterText,
      "",
      `Players available on the wire (under ${data.maxOwnership}% rostered):`,
      candidateText || "(none available under that threshold)",
      "",
      "My question:",
      data.question,
    ].join("\n");

    const answer = await askGateway(SYSTEM, prompt);
    if (!answer) throw new Error("The advisor came back empty — try rephrasing your question.");

    const { data: row, error } = await context.supabase
      .from("waiver_questions")
      .insert({
        user_id: context.userId,
        question: data.question,
        format: data.format,
        roster: data.roster as unknown as never,
        candidates: candidates as unknown as never,
        answer,
      })
      .select("id, created_at")
      .single();

    if (error) throw new Error(error.message);

    return {
      id: row.id,
      question: data.question,
      answer,
      createdAt: row.created_at,
      candidates,
    };
  });

export const getAskHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AskAnswer[]> => {
    const { data, error } = await context.supabase
      .from("waiver_questions")
      .select("id, question, answer, created_at, candidates")
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      createdAt: row.created_at,
      candidates: (row.candidates ?? []) as unknown as CandidateBrief[],
    }));
  });

export const deleteAskEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("waiver_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
