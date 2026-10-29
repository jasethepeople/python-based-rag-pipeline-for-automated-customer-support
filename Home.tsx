/**
 * Signal Library design: editorial field-guide support desk with mineral paper,
 * midnight ink, Evidence Green verification signals, and visible provenance.
 */
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

const sourceCards = [
  {
    id: "S1",
    type: "Official documentation",
    title: "Metabot in Slack",
    excerpt: "Use Metabot in Slack to explore saved work, ask data questions, and collaborate with teammates.",
    url: "https://www.metabase.com/docs/latest/ai/metabot-slack",
  },
  {
    id: "S2",
    type: "Official documentation",
    title: "Metabot — Metabase’s AI assistant",
    excerpt: "How to open Metabot, what it can do, and how conversation context behaves.",
    url: "https://www.metabase.com/docs/latest/ai/metabot",
  },
  {
    id: "S3",
    type: "Official documentation",
    title: "AI settings",
    excerpt: "Controls for enabling Metabot, embedded experiences, access scope, and token usage.",
    url: "https://www.metabase.com/docs/latest/ai/settings",
  },
  {
    id: "S4",
    type: "Official documentation",
    title: "AI in Metabase overview",
    excerpt: "An overview of the product’s built-in AI experiences and their capabilities.",
    url: "https://www.metabase.com/docs/latest/ai/overview",
  },
];

const questions = [
  "What is Metabot and where can I find its settings?",
  "How does Metabot work in Slack?",
  "How can I control embedded Metabot?",
];

function SourceMarker({ id }: { id: string }) {
  return (
    <a className="source-marker" href={`#${id}`} aria-label={`Jump to ${id} source`}>
      {id}
    </a>
  );
}

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [question, setQuestion] = useState(questions[0]);
  const [submittedQuestion, setSubmittedQuestion] = useState(questions[0]);
  const [copied, setCopied] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [feedbackDetail, setFeedbackDetail] = useState("");
  const [feedbackDetailSubmitted, setFeedbackDetailSubmitted] = useState(false);
  const [feedbackRecordId, setFeedbackRecordId] = useState<string | null>(null);
  const feedbackMutation = trpc.feedback.submit.useMutation();

  useEffect(() => {
    const storedFeedback = window.localStorage.getItem(`signal-library-feedback:${submittedQuestion}`);
    const storedDetail = window.localStorage.getItem(`signal-library-feedback-detail:${submittedQuestion}`) ?? "";
    setFeedback(storedFeedback === "up" || storedFeedback === "down" ? storedFeedback : null);
    setFeedbackDetail(storedDetail);
    setFeedbackDetailSubmitted(Boolean(storedDetail));
    setFeedbackRecordId(null);
  }, [submittedQuestion]);

  const isSlackQuery = submittedQuestion.toLowerCase().includes("slack");
  const answer = useMemo(
    () =>
      isSlackQuery
        ? {
            eyebrow: "Sourced support answer",
            title: "Metabot in Slack, explained.",
            lead: "Metabot can be used from Slack for private analysis or shared, channel-based work with a team.",
          }
        : {
            eyebrow: "Sourced support answer",
            title: "Metabot is Metabase’s built-in AI assistant.",
            lead: "It helps people explore data, create queries, find saved work, and turn questions into useful analysis.",
          },
    [isSlackQuery],
  );

  const submitQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (question.trim()) setSubmittedQuestion(question.trim());
  };

  const copyAnswer = async () => {
    const text = `${answer.title}\n\n${answer.lead}\n\nMetabot’s controls live in Settings → AI. See source links S1–S4.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const sharedAnswer = `${answer.title}\n\n${answer.lead}\n\nMetabot’s controls live in Settings → AI. See linked sources S1–S4 for the relevant product documentation.`;

  const recordFeedback = (choice: "up" | "down") => {
    setFeedback(choice);
    window.localStorage.setItem(`signal-library-feedback:${submittedQuestion}`, choice);
    void feedbackMutation.mutateAsync({ question: submittedQuestion, answer: sharedAnswer, rating: choice, comment: choice === "down" ? feedbackDetail.trim() : "" })
      .then((record) => setFeedbackRecordId(record?.publicId ?? null))
      .catch(() => setFeedbackRecordId(null));
    if (choice === "down") setFeedbackDetailSubmitted(false);
  };

  const submitFeedbackDetail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = feedbackDetail.trim();
    if (!note) return;
    window.localStorage.setItem(`signal-library-feedback-detail:${submittedQuestion}`, note);
    void feedbackMutation.mutateAsync({
      publicId: feedbackRecordId ?? undefined,
      question: submittedQuestion,
      answer: sharedAnswer,
      rating: "down",
      comment: note,
    }).then((record) => setFeedbackRecordId(record?.publicId ?? feedbackRecordId)).catch(() => undefined);
    setFeedbackDetailSubmitted(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f3ed] text-[#102a43]">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Signal Library home">
          <img src="/manus-storage/signal-library-mark_4a19444f.png" alt="" />
          <span className="brand-type">signal<br />library</span>
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#answer">Answer</a>
          <a href="#sources">Sources</a>
          <a href="#method">Method</a>
          <a href="/admin">Review desk</a>
        </nav>

        <div className="header-meta">
          <span className="status-dot" />
          <span>50 public records</span>
        </div>

        <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        {mobileOpen && (
          <div className="mobile-menu">
            <a href="#answer" onClick={() => setMobileOpen(false)}>Answer</a>
            <a href="#sources" onClick={() => setMobileOpen(false)}>Sources</a>
            <a href="#method" onClick={() => setMobileOpen(false)}>Method</a>
          </div>
        )}
      </header>

      <main id="top">
        <section className="intro-section">
          <div className="intro-copy">
            <p className="kicker"><span /> Evidence-first support</p>
            <h1>Ask once.<br /><em>Inspect everything.</em></h1>
            <p className="intro-text">Public product knowledge, connected to the exact pages that support each reply.</p>
            <div className="intro-stats" aria-label="Support index statistics">
              <div><strong>174</strong><span>evidence chunks</span></div>
              <div><strong>4</strong><span>linked sources</span></div>
              <div><strong>100%</strong><span>visible provenance</span></div>
            </div>
          </div>
          <div className="hero-art-wrap" aria-hidden="true">
            <img className="hero-art" src="/manus-storage/signal-library-hero_682a9cfe.png" alt="" />
            <div className="hero-caption"><span>01</span> The answer canvas</div>
          </div>
        </section>

        <section className="search-section" aria-label="Support question search">
          <div className="search-intro">
            <span className="section-number">01</span>
            <p>Ask the library</p>
          </div>
          <form className="search-shell" onSubmit={submitQuestion}>
            <Search size={21} strokeWidth={1.7} />
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              aria-label="Ask a support question"
              placeholder="Ask about your Metabase workspace..."
            />
            <button type="submit" aria-label="Search support library"><ArrowUpRight size={20} /></button>
          </form>
          <div className="question-chips" aria-label="Example questions">
            {questions.map((item) => (
              <button key={item} className={question === item ? "active" : ""} onClick={() => { setQuestion(item); setSubmittedQuestion(item); }}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section id="answer" className="answer-section">
          <aside className="answer-rail">
            <div className="rail-line" />
            <div className="confidence-seal">
              <span>high</span>
              <strong>confidence</strong>
              <i />
            </div>
            <p>Retrieved from official product documentation.</p>
          </aside>

          <article className="answer-canvas">
            <div className="canvas-topline">
              <span>{answer.eyebrow}</span>
              <button onClick={copyAnswer} className="copy-button">
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied" : "Copy reply"}
              </button>
            </div>
            <p className="asked-question">“{submittedQuestion}”</p>
            <h2>{answer.title}</h2>
            <p className="answer-lead">{answer.lead} <SourceMarker id="S4" /><SourceMarker id="S1" /><SourceMarker id="S2" /></p>

            <div className="answer-rule" />
            <div className="answer-columns">
              <div>
                <p className="answer-label">Where to configure it</p>
                <p>Metabot’s toggles and configuration live in <strong>Settings → AI</strong>. The Internal tab controls the in-app experience, while the Embedded tab controls Metabot in embeds. Additional AI controls handle access scope and token usage. <SourceMarker id="S3" /><SourceMarker id="S4" /></p>
              </div>
              <div>
                <p className="answer-label">Useful details</p>
                <p>{isSlackQuery ? "In Slack, direct-message Metabot for private analysis or mention @Metabot in a channel to collaborate with your team." : "Open the chat sidebar from the Metabot icon in the top right. A new conversation discards the previous chat context."} <SourceMarker id={isSlackQuery ? "S1" : "S2"} /></p>
              </div>
            </div>
            <div className="next-step">
              <Sparkles size={18} />
              <span>Need the exact setting? Open the evidence cards below and follow the original documentation.</span>
              <ChevronRight size={19} />
            </div>
            <div className="feedback-panel" aria-labelledby="feedback-question">
              <div className="feedback-copy">
                <span id="feedback-question">Was this answer accurate?</span>
                <p>{feedback === "up" ? "Marked accurate. Thank you for the signal." : feedback === "down" ? "Thanks for flagging this reply. Add context below if you can." : "Your feedback helps improve which sources the library prioritizes."}</p>
              </div>
              <div className="feedback-actions" role="group" aria-label="Answer accuracy feedback">
                <button
                  className={feedback === "up" ? "feedback-button selected-up" : "feedback-button"}
                  onClick={() => recordFeedback("up")}
                  aria-pressed={feedback === "up"}
                  title="This answer was accurate"
                >
                  <ThumbsUp size={16} />
                  <span>Accurate</span>
                </button>
                <button
                  className={feedback === "down" ? "feedback-button selected-down" : "feedback-button"}
                  onClick={() => recordFeedback("down")}
                  aria-pressed={feedback === "down"}
                  title="This answer needs improvement"
                >
                  <ThumbsDown size={16} />
                  <span>Needs work</span>
                </button>
              </div>
            </div>
            {feedback === "down" && (
              <form className="feedback-detail" onSubmit={submitFeedbackDetail}>
                <div className="feedback-detail-heading">
                  <label htmlFor="feedback-detail">What was unhelpful? <span>Optional</span></label>
                  <p>Tell us what was missing, inaccurate, or unclear.</p>
                </div>
                <textarea
                  id="feedback-detail"
                  value={feedbackDetail}
                  onChange={(event) => { setFeedbackDetail(event.target.value); setFeedbackDetailSubmitted(false); }}
                  placeholder="For example: the setting name was different in my workspace..."
                  maxLength={500}
                  rows={3}
                />
                <div className="feedback-detail-footer">
                  <span>{feedbackDetailSubmitted ? "Note saved in this browser." : `${feedbackDetail.length}/500`}</span>
                  <button type="submit" disabled={!feedbackDetail.trim()}>Save note <ArrowUpRight size={14} /></button>
                </div>
              </form>
            )}
          </article>
        </section>

        <section id="sources" className="sources-section">
          <div className="sources-heading">
            <div>
              <span className="section-number">02</span>
              <p className="eyebrow">The paper trail</p>
              <h2>Open the evidence behind this reply.</h2>
            </div>
            <img src="/manus-storage/source-trail-art_32a2ec00.png" alt="Abstract evidence cards linked by a line" />
          </div>
          <div className="source-grid">
            {sourceCards.map((source, index) => (
              <a key={source.id} id={source.id} href={source.url} target="_blank" rel="noreferrer" className="source-card">
                <div className="source-card-head">
                  <span className="source-code">{source.id}</span>
                  <span>{source.type}</span>
                  <ExternalLink size={16} />
                </div>
                <span className="archive-stamp">Reference file · 0{index + 1}</span>
                <h3>{source.title}</h3>
                <p>{source.excerpt}</p>
                <div className="source-card-foot"><FileText size={15} /> Official public page <span>0{index + 1}</span></div>
              </a>
            ))}
          </div>
        </section>

        <section id="method" className="method-section">
          <div className="method-image"><img src="/manus-storage/answer-canvas-art_74aad938.png" alt="Abstract answer canvas with evidence signal" /></div>
          <div className="method-copy">
            <span className="section-number">03</span>
            <p className="eyebrow">A quieter kind of assistance</p>
            <h2>Every answer stays close to its sources.</h2>
            <p>Signal Library retrieves relevant public documentation, ranks it by relevance and authority, then keeps the source links attached to the finished response.</p>
            <div className="method-list">
              <div><ShieldCheck size={20} /><span><strong>Confidence signaled</strong>Weak matches are clearly marked instead of made to sound certain.</span></div>
              <div><BookOpen size={20} /><span><strong>Sources remain visible</strong>Each marker maps to a real page you can inspect yourself.</span></div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-brand"><img src="/manus-storage/signal-library-mark_4a19444f.png" alt="" /><span>signal library</span></div>
        <p>Built around public documentation. No answer without a source.</p>
        <a href="#top">Back to top <ArrowUpRight size={15} /></a>
      </footer>
    </div>
  );
}
