import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Sparkle, Trash2 } from "lucide-react";
import { useState } from "react";

import { FormatSelector, OwnershipSlider } from "@/components/wire/Controls";
import { Page, SectionLabel } from "@/components/wire/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askWaiver, deleteAskEntry, getAskHistory, type AskAnswer } from "@/lib/ask.functions";
import { useEspnConnection, useLeagueProfile } from "@/lib/league-store";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title: "Ask the Waiver Advisor — Wire Tap" },
      {
        name: "description",
        content:
          "Ask a waiver wire question about your own roster and get a plain-language answer naming the available players who fit your needs best.",
      },
      { property: "og:title", content: "Ask the Wire Tap Waiver Advisor" },
      {
        property: "og:description",
        content:
          "Type your waiver question, and Wire Tap explains which available players fit your roster and why.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AskPage,
});

const EXAMPLES = [
  "My RB2 is banged up — who should I grab this week?",
  "Should I stream a tight end or add depth at receiver?",
  "I have one waiver claim left. Who has the best rest-of-season upside?",
];

function AnswerCard({ entry, onDelete }: { entry: AskAnswer; onDelete?: () => void }) {
  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold leading-snug">{entry.question}</p>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete this question"
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="space-y-2 text-xs leading-relaxed text-foreground">
        {entry.answer.split(/\n{1,2}/).map((para, i) =>
          para.trim() ? (
            <p key={i} className="whitespace-pre-wrap">
              {para.trim()}
            </p>
          ) : null,
        )}
      </div>
      {entry.candidates.length > 0 && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Based on {entry.candidates.length} available players, including{" "}
          {entry.candidates
            .slice(0, 4)
            .map((c) => c.name)
            .join(", ")}
          .
        </p>
      )}
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {new Date(entry.createdAt).toLocaleString()}
      </p>
    </article>
  );
}

function AskPage() {
  const queryClient = useQueryClient();
  const { profile, update } = useLeagueProfile();
  const { connection, cred } = useEspnConnection();
  const [question, setQuestion] = useState("");
  const [maxOwnership, setMaxOwnership] = useState(50);
  const [latest, setLatest] = useState<AskAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leagueFormat = cred ? connection.summary?.format : null;
  const format = leagueFormat ?? profile.format;

  const history = useQuery({ queryKey: ["ask-history"], queryFn: () => getAskHistory() });

  const ask = useMutation({
    mutationFn: () =>
      askWaiver({
        data: { question, format, roster: profile.roster, maxOwnership },
      }),
    onSuccess: (answer) => {
      setLatest(answer);
      setQuestion("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["ask-history"] });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Couldn't get an answer — try again."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAskEntry({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ask-history"] }),
  });

  const previous = (history.data ?? []).filter((h) => h.id !== latest?.id);

  return (
    <Page format={format}>
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkle className="size-5 text-action" strokeWidth={2.5} />
          <h1 className="font-display text-2xl uppercase leading-none">Ask the advisor</h1>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Type a waiver question in your own words. Wire Tap reads your saved roster, checks who's
          actually available, and explains which pickups fit your needs.
        </p>
        {profile.roster.length === 0 ? (
          <p className="rounded-xl border border-action/50 bg-card p-4 text-xs leading-relaxed">
            You don't have a roster saved yet. Add or sync it on the{" "}
            <Link to="/analyzer" className="font-bold text-turf underline">
              Roster
            </Link>{" "}
            tab for answers tailored to your team — you can still ask general questions now.
          </p>
        ) : (
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Using your {profile.roster.length}-player roster
          </p>
        )}
      </section>

      <section className="space-y-4">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. My RB2 is out this week — who's the best replacement on the wire?"
          rows={4}
          maxLength={600}
          className="text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuestion(ex)}
              className="rounded-full border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground"
            >
              {ex}
            </button>
          ))}
        </div>

        {!leagueFormat && (
          <FormatSelector value={profile.format} onChange={(f) => update({ format: f })} />
        )}
        <OwnershipSlider value={maxOwnership} onChange={setMaxOwnership} />

        <Button
          type="button"
          disabled={ask.isPending || question.trim().length < 5}
          onClick={() => ask.mutate()}
          className="w-full font-bold uppercase tracking-tight"
        >
          {ask.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Thinking…
            </>
          ) : (
            "Get my answer"
          )}
        </Button>

        {error && (
          <p className="rounded-xl border border-destructive/50 bg-card p-4 text-xs font-bold text-destructive">
            {error}
          </p>
        )}
      </section>

      {latest && (
        <section className="space-y-3">
          <SectionLabel>Your answer</SectionLabel>
          <AnswerCard entry={latest} />
        </section>
      )}

      {previous.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Saved questions</SectionLabel>
          <div className="space-y-4">
            {previous.map((entry) => (
              <AnswerCard
                key={entry.id}
                entry={entry}
                onDelete={() => remove.mutate(entry.id)}
              />
            ))}
          </div>
        </section>
      )}

      <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
        Answers come from an AI model reading only your roster and Wire Tap's current available
        player list. Double-check anything surprising before you burn a waiver claim.
      </p>
    </Page>
  );
}
