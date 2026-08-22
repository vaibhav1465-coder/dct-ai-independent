"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getArticleLabel } from "../../lib/article-label";

type AiDetection = {
  aiScore: number;
  humanScore: number;
  flagged: boolean;
  threshold: number;
  component: "headline" | "body";
};
type CviResult = {
  verdict: "PASS" | "WARNING";
  threshold: number;
  headline: AiDetection;
  body: AiDetection;
  highestScore: number;
  flaggedComponents: Array<"headline" | "body">;
};
type Result = {
  checkId: string | null;
  content: string;
  verdict: string;
  category: string;
  reliability: string;
  cvi?: CviResult;
};
type CviAction = "CONTINUE" | "CONTEST";
type SessionItem = {
  id: string;
  publication: string;
  headline: string;
  subhead: string;
  article: string;
  result: Result;
  createdAt: string;
};
type SessionState = {
  publication: string;
  headline: string;
  subhead: string;
  article: string;
  result: Result | null;
  history: SessionItem[];
};
type SavedAnalysis = {
  id: string;
  publication: string;
  articleLabel: string;
  headline: string;
  subhead: string;
  article: string;
  content: string;
  verdict: string;
  category: string;
  reliability: string;
  createdAt: string;
  journalistName: string;
  journalistEmail: string;
};

const SESSION_KEY = "dct-active-session-v2";

function getDraftLabel(headline: string, article: string) {
  return getArticleLabel(headline, article);
}

function buildReviewDocument(
  input: { publication: string; headline: string; subhead: string; article: string },
  output: string,
) {
  return `DCT — INPUT USED FOR THIS REVIEW

Publication: ${input.publication}
Suggested headline: ${input.headline || "[Not supplied]"}
Suggested subhead / strap / excerpt: ${input.subhead || "[Not supplied]"}

Article copy
${input.article || "[Article copy unavailable for this saved analysis]"}

============================================================

DCT — EDITORIAL COACHING OUTPUT

${output}`;
}

export function CheckForm({ savedAnalyses }: { savedAnalyses: SavedAnalysis[] }) {
  const [publication, setPublication] = useState("Indian Express");
  const [headline, setHeadline] = useState("");
  const [subhead, setSubhead] = useState("");
  const [article, setArticle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<SessionItem[]>([]);
  const [visibleSaved, setVisibleSaved] = useState(3);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [cviWarning, setCviWarning] = useState<CviResult | null>(null);
  const submitLock = useRef(false);
  const resultRef = useRef<HTMLElement | null>(null);
  const words = article.trim() ? article.trim().split(/\s+/).length : 0;

  /* eslint-disable react-hooks/set-state-in-effect -- Restore client-only session data after hydration. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved) as SessionState;
        setPublication(session.publication || "Indian Express");
        setHeadline(session.headline || "");
        setSubhead(session.subhead || "");
        setArticle(session.article || "");
        setResult(session.result || null);
        setHistory(Array.isArray(session.history) ? session.history.slice(0, 8) : []);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    const session: SessionState = { publication, headline, subhead, article, result, history };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // Browser persistence is best-effort only.
    }
  }, [article, headline, history, hydrated, publication, result, subhead]);

  useEffect(() => {
    if (!result || !resultRef.current) return;
    resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const combinedSavedCount = useMemo(
    () => savedAnalyses.length + history.length,
    [history.length, savedAnalyses.length],
  );
  const shownSavedAnalyses = useMemo(
    () => savedAnalyses.slice(0, visibleSaved),
    [savedAnalyses, visibleSaved],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await runCheck();
  }

  async function runCheck(cviAction?: CviAction) {
    if (loading || submitLock.current) return;
    submitLock.current = true;
    setLoading(true);
    setResult(null);
    setError("");
    if (!cviAction) setCviWarning(null);
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json", "x-dct-csrf": "1" },
        body: JSON.stringify({
          publication,
          headline,
          subhead,
          article,
          cviAction,
          requestKey: crypto.randomUUID(),
        }),
      });
      const data = (await response.json()) as Result & {
        code?: string;
        error?: string;
        cvi?: CviResult;
      };
      if (!response.ok) throw new Error(data.error ?? "The check could not be completed.");
      if (data.code === "CVI_WARNING" && data.cvi) {
        setCviWarning(data.cvi);
        return;
      }
      const completed = data as Result;
      setCviWarning(null);
      setResult(completed);
      setHistory((current) =>
        [
          {
            id: crypto.randomUUID(),
            publication,
            headline,
            subhead,
            article,
            result: completed,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ].slice(0, 8),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The check could not be completed.");
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  function restore(item: SessionItem) {
    setPublication(item.publication);
    setHeadline(item.headline);
    setSubhead(item.subhead);
    setArticle(item.article);
    setResult(item.result);
    setError("");
    setCviWarning(null);
  }

  function restoreSaved(item: SavedAnalysis) {
    setPublication(item.publication);
    setHeadline(item.headline);
    setSubhead(item.subhead);
    setArticle(item.article);
    setResult({
      checkId: item.id,
      content: item.content,
      verdict: item.verdict,
      category: item.category,
      reliability: item.reliability,
    });
    setError("");
    setCviWarning(null);
  }

  function clearDraft() {
    setPublication("Indian Express");
    setHeadline("");
    setSubhead("");
    setArticle("");
    setResult(null);
    setError("");
    setCviWarning(null);
  }

  function downloadName(item: SessionItem) {
    const base = getDraftLabel(item.headline, item.article)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    return `${base || "draft-copy"}-dct-ai-independent-review.txt`;
  }

  function downloadContent(item: SessionItem) {
    return buildReviewDocument(
      {
        publication: item.publication,
        headline: item.headline,
        subhead: item.subhead,
        article: item.article,
      },
      item.result.content,
    );
  }

  function downloadSavedName(item: SavedAnalysis) {
    const base = item.articleLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    return `${base || "draft-copy"}-dct-ai-independent-review.txt`;
  }

  function downloadSavedContent(item: SavedAnalysis) {
    return buildReviewDocument(
      {
        publication: item.publication,
        headline: item.headline,
        subhead: item.subhead,
        article: item.article,
      },
      item.content,
    );
  }

  return (
    <section className="workarea grid">
      <form className="card form" onSubmit={submit}>
        <p className="eyebrow">NEW COACHING CHECK</p>
        <div className="form-head">
          <h2>Paste the draft copy here</h2>
          <button
            className="secondary-button"
            type="button"
            onClick={clearDraft}
            disabled={loading || (!headline && !subhead && !article && !result)}
          >
            Start new draft
          </button>
        </div>
        <div className="fields">
          <label>
            Publication
            <select
              value={publication}
              onChange={(event) => setPublication(event.target.value)}
              disabled={loading}
            >
              <option>Indian Express</option>
              <option>Financial Express</option>
              <option>Jansatta</option>
              <option>Loksatta</option>
            </select>
          </label>
          <label>
            Suggested Headline
            <input
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder="Paste the suggested headline"
              maxLength={240}
              required
              disabled={loading}
            />
          </label>
        </div>
        <label>
          Subhead / Straps / Excerpt (Optional)
          <input
            value={subhead}
            onChange={(event) => setSubhead(event.target.value)}
            placeholder="Paste the suggested subhead, strap or excerpt"
            maxLength={280}
            disabled={loading}
          />
        </label>
        <label>
          Article copy
          <textarea
            required
            minLength={201}
            maxLength={50_000}
            value={article}
            onChange={(event) => setArticle(event.target.value)}
            placeholder="Paste headline, excerpt, byline and complete article copy here..."
            disabled={loading}
          />
        </label>
        <div className="counter">
          <span>{words.toLocaleString("en-IN")} words</span>
          <span>
            {combinedSavedCount
              ? `${combinedSavedCount} saved analysis items visible`
              : "Website clutter is cleaned automatically"}
          </span>
        </div>
        {cviWarning ? (
          <div role="alert" className="ai-detection-block cvi-warning-block">
            <strong>CVI — Copy Verification warning</strong>
            <span>
              Headline {cviWarning.headline.aiScore.toFixed(1)}% · Body copy {cviWarning.body.aiScore.toFixed(1)}% · Threshold {cviWarning.threshold}%
            </span>
            <p>{warningSentence(cviWarning)}</p>
            <div className="cvi-actions">
              <button className="secondary-button" type="button" onClick={() => setCviWarning(null)} disabled={loading}>
                Rewrite and Submit
              </button>
              <button type="button" onClick={() => runCheck("CONTINUE")} disabled={loading}>
                Continue to Coaching
              </button>
              <button className="secondary-button" type="button" onClick={() => runCheck("CONTEST")} disabled={loading}>
                Contest this flag
              </button>
            </div>
          </div>
        ) : error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <button disabled={loading} aria-busy={loading}>
          {loading ? "Checking copy verification and editorial standards..." : "Check AI Detection"}
        </button>
        <small className="disclaimer ai-disclaimer">
          <mark>Important:</mark> AI detectors run only when article copy is <mark>more than 200 characters</mark>. Daily/monthly usage depends on the provider plan. Results can produce <mark>false positives</mark> and remain a <mark>detection estimate—not proof</mark>.
        </small>
        <small className="disclaimer">
          DCT AI Independent may flag facts for verification, but it will not invent context or
          replace editorial judgement.
        </small>
      </form>
      <div className="right-rail">
        <aside className="card session-history">
          <p className="eyebrow">ACTIVE SESSION HISTORY</p>
          {history.length ? (
            <div className="history-list">
              {history.map((item) => (
                <article className="history-item" key={item.id}>
                  <div className="history-copy">
                    <strong>{getDraftLabel(item.headline, item.article)}</strong>
                    <span>
                      {item.publication} ·{" "}
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="history-actions">
                    <button className="history-action" type="button" onClick={() => restore(item)}>
                      View
                    </button>
                    <a
                      className="history-action"
                      download={downloadName(item)}
                      href={`data:text/plain;charset=utf-8,${encodeURIComponent(downloadContent(item))}`}
                    >
                      Download .txt
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>No completed checks in this browser session yet.</p>
          )}
        </aside>
        <aside className="card saved-analyses">
          <p className="eyebrow">SAVED ANALYSES</p>
          {savedAnalyses.length ? (
            <>
              <div className="history-list">
                {shownSavedAnalyses.map((item) => (
                  <article className="history-item" key={item.id}>
                    <div className="history-copy">
                      <strong>{item.articleLabel}</strong>
                      <span>
                        {item.journalistName} · {item.publication}
                      </span>
                      <small>
                        {new Date(item.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                    <div className="history-actions">
                      <button
                        className="history-action"
                        type="button"
                        onClick={() => restoreSaved(item)}
                      >
                        View
                      </button>
                      <a
                        className="history-action"
                        download={downloadSavedName(item)}
                        href={`data:text/plain;charset=utf-8,${encodeURIComponent(downloadSavedContent(item))}`}
                      >
                        Download .txt
                      </a>
                    </div>
                  </article>
                ))}
              </div>
              {visibleSaved < savedAnalyses.length ? (
                <button
                  className="table-load-more"
                  type="button"
                  onClick={() => setVisibleSaved((count) => count + 3)}
                >
                  Load More
                </button>
              ) : null}
            </>
          ) : (
            <p>Saved analyses will appear here after successful checks.</p>
          )}
        </aside>
        <aside className="card next">
          <p className="eyebrow">WHAT HAPPENS NEXT</p>
          {[
            ["Verify", "CVI checks headline and body copy independently before coaching runs."],
            ["Clean", "Remove website interface noise without changing the article."],
            ["Check", "Run seven editorial dimensions, seven coaching checks and copy rules."],
            [
              "Prioritise",
              "Surface the single most important coaching priority, while also flagging what is being done well and what does not yet meet the coaching guidelines.",
            ],
            [
              "Validate",
              "Check headline and subhead standards and confirm the output is complete.",
            ],
          ].map((step, index) => (
            <div className="step" key={step[0]}>
              <b>{index + 1}</b>
              <p>
                <strong>{step[0]}</strong>
                <span>{step[1]}</span>
              </p>
            </div>
          ))}
        </aside>
      </div>
      {result ? (
        <ResultPanel
          result={result}
          publication={publication}
          headline={headline}
          subhead={subhead}
          article={article}
          panelRef={resultRef}
          onStartNewDraft={clearDraft}
        />
      ) : null}
    </section>
  );
}

function warningSentence(cvi: CviResult) {
  const component = cvi.flaggedComponents.length === 2
    ? "headline and body copy"
    : cvi.flaggedComponents[0] === "headline"
      ? "headline"
      : "body copy";
  return cvi.highestScore.toFixed(1) + "% of your " + component + " appears to be generated or influenced by an external tool.";
}

const ResultPanel = ({
  result,
  publication,
  headline,
  subhead,
  article,
  panelRef,
  onStartNewDraft,
}: {
  result: Result;
  publication: string;
  headline: string;
  subhead: string;
  article: string;
  panelRef: React.RefObject<HTMLElement | null>;
  onStartNewDraft: () => void;
}) => {
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function rate() {
    if (!result.checkId) {
      setFeedback("Sign in through Google to save feedback.");
      return;
    }
    if (!rating || submittingRating) {
      setFeedback("Please choose a star rating first.");
      return;
    }
    setSubmittingRating(true);
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-dct-csrf": "1" },
      body: JSON.stringify({ checkId: result.checkId, rating }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      emailed?: boolean;
    } | null;
    setFeedback(
      response.ok
        ? `Rating saved${data?.emailed ? " and emailed to Vaibhav." : "."} Thank you.`
        : (data?.error ?? "Feedback could not be saved."),
    );
    setSubmittingRating(false);
  }

  async function shareResult() {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: "DCT AI Independent review", text: result.content });
        setFeedback("Review shared.");
      } else {
        await navigator.clipboard.writeText(result.content);
        setFeedback("Review copied so it can be shared.");
      }
    } catch {
      setFeedback("Sharing was cancelled.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <article className="card result" ref={panelRef}>
      <div>
        <p className="eyebrow">EDITORIAL COACHING COMPLETE</p>
        <h2>DCT AI Independent review</h2>
        {result.cvi ? (
          <p className="ai-detection-pass">
            <strong>CVI cleared:</strong>{" "}
            {result.cvi.highestScore.toFixed(1)}% estimated AI content · threshold{" "}
            {result.cvi.threshold}%
          </p>
        ) : null}
      </div>
      <div className="result-actions result-toolbar">
        <button type="button" onClick={() => navigator.clipboard.writeText(result.content)}>
          Copy
        </button>
        <button type="button" onClick={shareResult} disabled={sharing}>
          {sharing ? "Sharing..." : "Share"}
        </button>
        <a
          download="dct-ai-independent-review.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(buildReviewDocument({ publication, headline, subhead, article }, result.content))}`}
        >
          Download .txt
        </a>
        <button className="secondary-button" type="button" onClick={onStartNewDraft}>
          Start new draft
        </button>
      </div>
      <div className="verdict">
        <strong>{result.verdict}</strong>
        <span>
          Primary coaching focus: {result.category} · Validation: {result.reliability}
        </span>
      </div>
      <div className="result-input">
        <p className="eyebrow">INPUT USED FOR THIS REVIEW</p>
        <div className="result-input-meta">
          <p>
            <strong>Publication:</strong> {publication}
          </p>
          <p>
            <strong>Suggested headline:</strong> {headline}
          </p>
          <p>
            <strong>Suggested subhead:</strong> {subhead || "None"}
          </p>
          <p>
            <strong>Article copy:</strong>
          </p>
        </div>
        <pre>{article || "[Article copy unavailable for this saved analysis]"}</pre>
      </div>
      <pre>{result.content}</pre>
      <div className="result-actions feedback-actions rating-actions">
        <span>Rate this tool</span>
        <div
          className="star-rating"
          role="radiogroup"
          aria-label="Rate this tool from 1 to 5 stars"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={value <= rating ? "star active" : "star"}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              aria-pressed={value === rating}
              onClick={() => setRating(value)}
            >
              ★
            </button>
          ))}
        </div>
        <button type="button" onClick={rate} disabled={submittingRating || !rating}>
          {submittingRating ? "Sending rating..." : "Send rating"}
        </button>
        <span aria-live="polite">{feedback}</span>
      </div>
    </article>
  );
};
