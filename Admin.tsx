/** Signal Library design: editorial review desk for genuine locally stored feedback, using evidence-first hierarchy, mineral-paper tone, and non-fabricated records only. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Flag,
  MessageSquareText,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  FeedbackIssueCategory,
  FeedbackRating,
  FeedbackRecord,
  FeedbackReviewStatus,
  FeedbackSentiment,
} from "@/lib/feedback";
import { Tooltip as ShortcutTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { getSentimentDistribution } from "@/lib/sentimentDistribution";
import { detectNegativeFeedbackSpike, getNegativeFeedbackSpikeHistory } from "@/lib/negativeFeedbackSpike";
import { DEFAULT_NEGATIVE_FEEDBACK_ALERT_SETTINGS, readNegativeFeedbackAlertSettings, type NegativeFeedbackAlertSettings, writeNegativeFeedbackAlertSettings } from "@/lib/negativeFeedbackAlertSettings";
import { NegativeFeedbackSpikeMonitor } from "@/components/NegativeFeedbackSpikeMonitor";
import { NegativeFeedbackSpikeHistory } from "@/components/NegativeFeedbackSpikeHistory";
import { NegativeFeedbackAlertSettingsPanel } from "@/components/NegativeFeedbackAlertSettingsPanel";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";

type Filter = "all" | FeedbackRating;
type Range = "week" | "month";
type SortBy = "newest" | "oldest" | "needs_review" | "pinned";
type SavedView = "all" | "attention" | "new_flags" | "with_comments" | "pinned";

type TrendDatum = {
  date: string;
  label: string;
  observedAt: string;
  positive: number;
  negative: number;
  positiveRatio: number;
  negativeRatio: number;
};

type SentimentChartDatum = {
  label: string;
  positive: number;
  neutral: number;
  negative: number;
};

type DeskPreferences = {
  pageSize: number;
  sortBy: SortBy;
  savedView: SavedView;
};

const PAGE_SIZE_OPTIONS = [8, 16, 32, 64];
const PREFERENCES_KEY = "signal-library-review-desk-preferences";
const ALERT_SETTINGS_KEY = "signal-library-negative-feedback-alert-settings";

const issueLabels: Record<FeedbackIssueCategory, string> = {
  none: "No issue tagged",
  inaccurate: "Inaccurate answer",
  missing_detail: "Missing detail",
  unclear: "Unclear response",
  outdated: "Outdated guidance",
  other: "Other issue",
};

const statusLabels: Record<FeedbackReviewStatus, string> = {
  new: "New",
  investigating: "Investigating",
  resolved: "Resolved",
};

function loadPreferences(): DeskPreferences {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "{}") as Partial<DeskPreferences>;
    return {
      pageSize: PAGE_SIZE_OPTIONS.includes(saved.pageSize ?? 8) ? saved.pageSize ?? 8 : 8,
      sortBy: saved.sortBy ?? "newest",
      savedView: saved.savedView ?? "all",
    };
  } catch {
    return { pageSize: 8, sortBy: "newest", savedView: "all" };
  }
}

function loadNegativeFeedbackAlertSettings(): NegativeFeedbackAlertSettings {
  return readNegativeFeedbackAlertSettings(window.localStorage, ALERT_SETTINGS_KEY);
}

function escapeCsv(value: string | number | boolean | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function periodFor(isoDate: string, range: Range) {
  const source = new Date(isoDate);
  const periodStart = new Date(source.getFullYear(), source.getMonth(), source.getDate());
  if (range === "week") periodStart.setDate(periodStart.getDate() - ((periodStart.getDay() + 6) % 7));
  else periodStart.setDate(1);
  const key = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}-${String(periodStart.getDate()).padStart(2, "0")}`;
  const label = range === "week"
    ? `Week of ${periodStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : periodStart.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return { key, label };
}

function RatingBadge({ rating }: { rating: FeedbackRating }) {
  return rating === "up" ? (
    <span className="rating-badge rating-positive"><ThumbsUp size={13} /> Accurate</span>
  ) : (
    <span className="rating-badge rating-negative"><ThumbsDown size={13} /> Needs work</span>
  );
}

function StatusBadge({ status }: { status: FeedbackReviewStatus }) {
  return <span className={`review-status status-${status}`}>{statusLabels[status]}</span>;
}

function SentimentBadge({ sentiment, source }: { sentiment: FeedbackSentiment; source: "ai" | "fallback" }) {
  return <span className={`sentiment-badge sentiment-${sentiment}`} title={source === "ai" ? "AI-classified sentiment" : "Rating-based sentiment fallback"}>{sentiment}<small>{source === "ai" ? "AI" : "Fallback"}</small></span>;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendDatum }> }) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
  return (
    <div className="trend-tooltip">
      <strong>{datum.label}</strong>
      <span><i className="trend-dot positive" /> {datum.positiveRatio}% positive · {datum.positive} signal{datum.positive === 1 ? "" : "s"}</span>
      <span><i className="trend-dot negative" /> {datum.negativeRatio}% negative · {datum.negative} signal{datum.negative === 1 ? "" : "s"}</span>
    </div>
  );
}

function SentimentDistributionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SentimentChartDatum }> }) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
  const total = datum.positive + datum.neutral + datum.negative;
  return (
    <div className="trend-tooltip sentiment-chart-tooltip">
      <strong>{total} active feedback record{total === 1 ? "" : "s"}</strong>
      <span><i className="trend-dot positive" /> Positive · {datum.positive}</span>
      <span><i className="sentiment-dot neutral" /> Neutral · {datum.neutral}</span>
      <span><i className="trend-dot negative" /> Negative · {datum.negative}</span>
    </div>
  );
}

function ReviewDesk() {
  const initialPreferences = useMemo(loadPreferences, []);
  const initialAlertSettings = useMemo(loadNegativeFeedbackAlertSettings, []);
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [ratingFilter, setRatingFilter] = useState<Filter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackReviewStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | FeedbackIssueCategory>("all");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | FeedbackSentiment>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exported, setExported] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [sortBy, setSortBy] = useState<SortBy>(initialPreferences.sortBy);
  const [savedView, setSavedView] = useState<SavedView>(initialPreferences.savedView);
  const [alertSettings, setAlertSettings] = useState<NegativeFeedbackAlertSettings>(initialAlertSettings);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const detailPanelRef = useRef<HTMLElement>(null);
  const shortcutHelpTriggerRef = useRef<HTMLButtonElement>(null);
  const shortcutHelpCloseRef = useRef<HTMLButtonElement>(null);
  const reportFilters = useMemo(() => ({
    rating: ratingFilter === "all" ? undefined : ratingFilter,
    reviewStatus: statusFilter === "all" ? undefined : statusFilter,
    issueCategory: categoryFilter === "all" ? undefined : categoryFilter,
    sentiment: sentimentFilter === "all" ? undefined : sentimentFilter,
    search: search.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    savedView,
    sortBy,
  }), [categoryFilter, endDate, ratingFilter, savedView, search, sentimentFilter, sortBy, startDate, statusFilter]);
  const reportQuery = trpc.feedback.report.useQuery(reportFilters, {
    enabled: Boolean(user?.role === "admin"),
    refetchOnWindowFocus: true,
  });
  const alertSummaryQuery = trpc.feedback.alertSummary.useQuery(undefined, {
    enabled: Boolean(user?.role === "admin"),
    refetchOnWindowFocus: true,
  });
  const updateReviewMutation = trpc.feedback.updateReview.useMutation({
    onSuccess: () => { void reportQuery.refetch(); void alertSummaryQuery.refetch(); },
    onError: () => void reportQuery.refetch(),
  });
  const exportMutation = trpc.feedback.exportCsv.useMutation({
    onSuccess: ({ csv }) => {
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `signal-library-review_${startDate || "all"}_to_${endDate || "all"}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExported(true);
      window.setTimeout(() => setExported(false), 2200);
    },
  });

  useEffect(() => {
    if (!reportQuery.data) return;
    setRecords(reportQuery.data.records.map((record) => ({
      id: record.publicId,
      question: record.question,
      answer: record.answer,
      rating: record.rating,
      comment: record.comment,
      sentiment: record.sentiment,
      sentimentSource: record.sentimentSource,
      issueCategory: record.issueCategory,
      reviewStatus: record.reviewStatus,
      reviewerNote: record.reviewerNote,
      pinned: record.pinned,
      updatedAt: record.createdAt.toISOString(),
      reviewedAt: record.updatedAt.toISOString(),
      alertedAt: record.alertedAt?.toISOString(),
    })));
  }, [reportQuery.data]);

  const dateRangeValid = !startDate || !endDate || startDate <= endDate;
  const rangeFilteredRecords = records;
  const filteredRecords = records;

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selected = records.find((record) => record.id === selectedId) ?? pagedRecords[0];

  const trendData = useMemo<TrendDatum[]>(() => {
    const byDate = new Map<string, { positive: number; negative: number; observedAt: string }>();
    const labels = new Map<string, string>();
    rangeFilteredRecords.forEach((record) => {
      const period = periodFor(record.updatedAt, range);
      const current = byDate.get(period.key) ?? { positive: 0, negative: 0, observedAt: record.updatedAt };
      if (record.rating === "up") current.positive += 1;
      else current.negative += 1;
      if (record.updatedAt > current.observedAt) current.observedAt = record.updatedAt;
      byDate.set(period.key, current);
      labels.set(period.key, period.label);
    });
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, counts]) => {
      const total = counts.positive + counts.negative;
      return {
        date,
        label: labels.get(date) ?? date,
        observedAt: counts.observedAt,
        positive: counts.positive,
        negative: counts.negative,
        positiveRatio: Math.round((counts.positive / total) * 100),
        negativeRatio: Math.round((counts.negative / total) * 100),
      };
    });
  }, [range, rangeFilteredRecords]);

  const sentimentDistribution = useMemo(() => getSentimentDistribution(records), [records]);
  const sentimentTotal = sentimentDistribution.reduce((total, item) => total + item.count, 0);
  const sentimentChartData = useMemo<SentimentChartDatum[]>(() => [{
    label: "Filtered feedback",
    positive: sentimentDistribution.find((item) => item.sentiment === "positive")?.count ?? 0,
    neutral: sentimentDistribution.find((item) => item.sentiment === "neutral")?.count ?? 0,
    negative: sentimentDistribution.find((item) => item.sentiment === "negative")?.count ?? 0,
  }], [sentimentDistribution]);
  const negativeSpike = useMemo(() => detectNegativeFeedbackSpike(trendData.map((period) => ({ label: period.label, positive: period.positive, negative: period.negative })), alertSettings), [alertSettings, trendData]);
  const negativeSpikeHistory = useMemo(() => getNegativeFeedbackSpikeHistory(trendData.map((period) => ({ label: period.label, positive: period.positive, negative: period.negative, observedAt: period.observedAt })), alertSettings), [alertSettings, trendData]);
  const spikeScopeIsComparable = ratingFilter === "all" && sentimentFilter === "all" && savedView === "all";

  const positiveCount = reportQuery.data?.metrics.positive ?? 0;
  const negativeCount = reportQuery.data?.metrics.negative ?? 0;
  const openCount = reportQuery.data?.metrics.unresolved ?? 0;
  const resolvedCount = reportQuery.data?.metrics.resolved ?? 0;
  const resolutionRate = reportQuery.data?.metrics.resolutionRate ?? 0;
  const commentCount = reportQuery.data?.metrics.commented ?? 0;
  const latestTrend = trendData.at(-1);
  const previousTrend = trendData.at(-2);
  const trendChange = latestTrend && previousTrend ? latestTrend.positiveRatio - previousTrend.positiveRatio : null;

  useEffect(() => {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ pageSize, sortBy, savedView } satisfies DeskPreferences));
  }, [pageSize, savedView, sortBy]);

  useEffect(() => {
    writeNegativeFeedbackAlertSettings(window.localStorage, ALERT_SETTINGS_KEY, alertSettings);
  }, [alertSettings]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!detailsOpen || !selected) return;
    window.requestAnimationFrame(() => {
      detailPanelRef.current?.focus({ preventScroll: true });
      detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [detailsOpen, selected]);

  useEffect(() => {
    if (!shortcutHelpOpen) return;
    window.requestAnimationFrame(() => shortcutHelpCloseRef.current?.focus());
  }, [shortcutHelpOpen]);

  const resetListFocus = () => {
    setCurrentPage(1);
    setSelectedId(null);
    setDetailsOpen(false);
  };

  const refreshRecords = () => {
    void reportQuery.refetch();
    void alertSummaryQuery.refetch();
    resetListFocus();
  };

  const clearReviewFilters = () => {
    setRatingFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSentimentFilter("all");
    setSearch("");
    setSavedView("all");
    resetListFocus();
  };

  const applySavedView = (view: SavedView) => {
    setSavedView(view);
    resetListFocus();
  };

  const goToPage = (nextPage: number) => {
    const boundedPage = Math.max(1, Math.min(nextPage, totalPages));
    setCurrentPage(boundedPage);
    setSelectedId(null);
    setDetailsOpen(false);
    window.requestAnimationFrame(() => document.getElementById("feedback-list")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const moveToIndex = (nextIndex: number) => {
    if (filteredRecords.length === 0) return;
    const boundedIndex = Math.max(0, Math.min(nextIndex, filteredRecords.length - 1));
    const nextRecord = filteredRecords[boundedIndex];
    setSelectedId(nextRecord.id);
    setCurrentPage(Math.floor(boundedIndex / pageSize) + 1);
    setDetailsOpen(false);
    window.requestAnimationFrame(() => {
      const nextElement = document.getElementById(`feedback-record-${nextRecord.id}`);
      nextElement?.focus({ preventScroll: true });
      nextElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const moveFeedbackSelection = (direction: 1 | -1) => {
    const selectedIndex = selectedId ? filteredRecords.findIndex((record) => record.id === selectedId) : -1;
    moveToIndex(selectedIndex < 0 ? 0 : selectedIndex + direction);
  };

  const openSelectedDetails = () => {
    if (selected) setDetailsOpen(true);
  };

  const closeSelectedDetails = () => {
    if (!selected) return;
    setDetailsOpen(false);
    window.requestAnimationFrame(() => {
      const selectedElement = document.getElementById(`feedback-record-${selected.id}`);
      selectedElement?.focus({ preventScroll: true });
      selectedElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const persistReview = (updates: Pick<Partial<FeedbackRecord>, "issueCategory" | "reviewStatus" | "reviewerNote" | "pinned">) => {
    if (!selected) return;
    setRecords((current) => current.map((record) => record.id === selected.id ? { ...record, ...updates, reviewedAt: new Date().toISOString() } : record));
    updateReviewMutation.mutate({ publicId: selected.id, ...updates });
  };

  const exportCsv = () => {
    if (!dateRangeValid || !reportQuery.data?.total) return;
    exportMutation.mutate(reportFilters);
  };

  const closeShortcutHelp = () => {
    setShortcutHelpOpen(false);
    window.requestAnimationFrame(() => shortcutHelpTriggerRef.current?.focus());
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inTextField = Boolean(target?.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
      if (event.key === "Escape" && shortcutHelpOpen) {
        event.preventDefault();
        closeShortcutHelp();
        return;
      }
      if (event.key === "?" && !inTextField) {
        event.preventDefault();
        setShortcutHelpOpen((open) => !open);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (inTextField || shortcutHelpOpen) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveFeedbackSelection(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Home") {
        event.preventDefault();
        moveToIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        moveToIndex(filteredRecords.length - 1);
      } else if (event.key === "Enter" && selected) {
        if (target?.closest("button:not(.feedback-record), a")) return;
        event.preventDefault();
        openSelectedDetails();
      } else if (event.key === "Escape" && detailsOpen && detailPanelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        closeSelectedDetails();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailsOpen, filteredRecords, pageSize, selected, selectedId, shortcutHelpOpen]);

  if (authLoading) return <div className="admin-access-state">Loading secured Review Desk…</div>;
  if (user?.role !== "admin") return <div className="admin-access-state"><span>Review Desk</span><h1>Owner access required.</h1><p>Sign in with the project owner account to review centralized support feedback.</p><Link href="/">Return to support workspace</Link></div>;

  return (
    <div className="admin-page admin-page-embedded">

      <main className="admin-main">
        <header className="admin-header">
          <div><p className="admin-kicker"><span /> Feedback operations</p><h1>Review the signals<br /><em>behind the answer.</em></h1></div>
          <div className="admin-header-actions">
            <ShortcutTooltip><TooltipTrigger asChild><button ref={shortcutHelpTriggerRef} className="shortcut-help-trigger" onClick={() => setShortcutHelpOpen(true)}><span>Shortcuts</span><kbd>?</kbd></button></TooltipTrigger><TooltipContent className="shortcut-tooltip" side="bottom">Keyboard guide <kbd>?</kbd></TooltipContent></ShortcutTooltip>
            <button className="refresh-button" onClick={refreshRecords}><RefreshCw size={15} /> Refresh records</button>
          </div>
        </header>

        <section className="admin-notice"><MessageSquareText size={18} /><p><strong>Shared review mode.</strong> Feedback and reviewer updates are centrally stored. {alertSummaryQuery.data?.unresolved ? `${alertSummaryQuery.data.unresolved} negative-feedback item${alertSummaryQuery.data.unresolved === 1 ? " remains" : "s remain"} unresolved; the owner notification workflow is active.` : "New negative feedback alerts the project owner automatically; dashboard view settings stay in this browser."}</p></section>

        <NegativeFeedbackAlertSettingsPanel settings={alertSettings} onChange={setAlertSettings} onReset={() => setAlertSettings(DEFAULT_NEGATIVE_FEEDBACK_ALERT_SETTINGS)} />

        <NegativeFeedbackSpikeMonitor spike={negativeSpike} isComparable={spikeScopeIsComparable} />

        <NegativeFeedbackSpikeHistory spikes={negativeSpikeHistory} isComparable={spikeScopeIsComparable} />

        <section className="admin-stats admin-stats-expanded" aria-label="Feedback totals">
          <div><span>Captured signals</span><strong>{records.length}</strong><small>shared database</small></div>
          <div><span>Marked accurate</span><strong>{positiveCount}</strong><small>thumbs-up</small></div>
          <div><span>Open review</span><strong>{openCount}</strong><small>{negativeCount ? `${negativeCount} downvotes` : "no flags yet"}</small></div>
          <div><span>Resolution rate</span><strong>{negativeCount ? `${resolutionRate}%` : "—"}</strong><small>{resolvedCount} resolved</small></div>
          <div><span>Written context</span><strong>{commentCount}</strong><small>user comments</small></div>
        </section>

        <section className="sentiment-distribution-section" aria-labelledby="sentiment-distribution-title">
          <div className="sentiment-distribution-heading">
            <div><span className="section-number">01</span><p>Feedback sentiment</p><h2 id="sentiment-distribution-title">How the current view <em>feels.</em></h2></div>
            <span className="sentiment-filter-note">Reflects active Review Desk filters</span>
          </div>
          <div className="sentiment-distribution-grid">
            <div className="sentiment-chart-shell">
              {sentimentTotal > 0 ? <><p id="sentiment-distribution-summary" className="sr-only">{sentimentDistribution.map((item) => `${item.label}: ${item.count} (${item.percentage}%).`).join(" ")}</p><ResponsiveContainer width="100%" height={172}><BarChart data={sentimentChartData} layout="vertical" stackOffset="expand" margin={{ top: 32, right: 6, left: 6, bottom: 16 }} role="img" aria-labelledby="sentiment-distribution-title" aria-describedby="sentiment-distribution-summary"><XAxis type="number" hide domain={[0, 1]} /><YAxis type="category" dataKey="label" hide /><Tooltip cursor={{ fill: "rgba(18, 126, 102, 0.06)" }} content={<SentimentDistributionTooltip />} /><Bar dataKey="positive" stackId="sentiment" fill="#127e66" radius={[2, 0, 0, 2]} /><Bar dataKey="neutral" stackId="sentiment" fill="#81969a" /><Bar dataKey="negative" stackId="sentiment" fill="#c3704f" radius={[0, 2, 2, 0]} /></BarChart></ResponsiveContainer><div className="sentiment-chart-scale" aria-hidden="true"><span>0%</span><span>100% of active feedback</span></div></> : <div className="sentiment-chart-empty"><BarChart3 size={27} /><div><strong>Waiting for sentiment signals.</strong><span>The distribution appears when feedback reaches this view.</span></div></div>}
            </div>
            <div className="sentiment-breakdown" aria-label="Sentiment distribution details">
              {sentimentDistribution.map((item) => <div key={item.sentiment} className={`sentiment-breakdown-item ${item.sentiment}`}><span className="sentiment-breakdown-marker" /><div><strong>{item.label}</strong><small>{item.sentiment === "positive" ? "Supportive or satisfied" : item.sentiment === "neutral" ? "Mixed or informational" : "Frustrated or dissatisfied"}</small></div><b>{item.percentage}%</b><em>{item.count} record{item.count === 1 ? "" : "s"}</em></div>)}
            </div>
          </div>
          <p className="sentiment-distribution-note">Counts are calculated from the shared records in the current view. Changing rating, status, category, sentiment, search, saved view, or date filters updates this distribution.</p>
        </section>

        <section className="trend-section" aria-labelledby="trend-title">
          <div className="trend-heading">
            <div><span className="section-number">02</span><p>Signal balance</p><h2 id="trend-title">Positive vs. negative, {range === "week" ? "by week" : "by month"}.</h2></div>
            <div className="trend-controls">
              <label className="trend-range"><span>Group by</span><select value={range} onChange={(event) => setRange(event.target.value as Range)} aria-label="Group feedback trend by"><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
              <div className="date-range-picker" aria-label="Custom feedback date range"><label><span>From</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setExported(false); }} /></label><span className="date-range-divider">to</span><label><span>To</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setExported(false); }} /></label>{(startDate || endDate) && <button type="button" onClick={() => { setStartDate(""); setEndDate(""); setExported(false); }}>All dates</button>}</div>
              <button className={exported ? "export-button exported" : "export-button"} type="button" onClick={exportCsv} disabled={!dateRangeValid || !(reportQuery.data?.total)}><Download size={13} /> {exported ? "Downloaded" : `Export ${reportQuery.data?.total ?? 0}`}</button>
              <div className="trend-legend" aria-label="Trend chart legend"><span><i className="trend-dot positive" /> Accurate</span><span><i className="trend-dot negative" /> Needs work</span></div>
            </div>
          </div>
          <div className="trend-chart-shell">
            {!dateRangeValid ? <div className="trend-empty trend-empty-error"><BarChart3 size={27} /><div><strong>Check the selected dates.</strong><span>The start date must be on or before the end date.</span></div></div>
              : trendData.length > 0 ? <ResponsiveContainer width="100%" height={250}><BarChart data={trendData} stackOffset="expand" margin={{ top: 8, right: 6, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#ccd7ce" strokeDasharray="2 4" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#607987", fontSize: 10, fontWeight: 700 }} /><YAxis hide domain={[0, 1]} /><Tooltip cursor={{ fill: "rgba(18, 126, 102, 0.06)" }} content={<TrendTooltip />} /><Bar dataKey="positiveRatio" stackId="ratio" fill="#127e66" radius={[2, 2, 0, 0]} /><Bar dataKey="negativeRatio" stackId="ratio" fill="#c3704f" radius={[0, 0, 2, 2]} /></BarChart></ResponsiveContainer>
                : <div className="trend-empty"><BarChart3 size={27} /><div><strong>{records.length ? "No feedback in this date range." : "Waiting for dated feedback signals."}</strong><span>{records.length ? "Adjust the start or end date to include captured feedback." : "The ratio chart will appear as visitors rate answers in this browser."}</span></div></div>}
          </div>
          <div className="trend-note-row"><p className="trend-note">{startDate || endDate ? "The custom date range is inclusive." : "All captured dates are included."} Each column is normalized to 100% for feedback captured in the selected calendar period.</p><span className="trend-comparison">{trendChange === null ? "Comparison appears after two periods." : `${trendChange >= 0 ? "+" : ""}${trendChange} pts vs. previous period`}</span></div>
        </section>

        <section className="review-section">
          <div className="review-toolbar review-toolbar-expanded">
            <div className="review-heading"><span className="section-number">03</span><h2>Captured feedback</h2><span className="record-nav-hint" aria-label="Use Arrow Up and Arrow Down to move through feedback records, Home and End to jump, Enter to open details, or Escape to return"><kbd>↑</kbd><kbd>↓</kbd> Move <kbd>↵</kbd> Open <kbd>Esc</kbd> Return</span></div>
            <div className="review-controls review-controls-expanded">
              <label className="saved-view-select"><Flag size={13} /><span className="sr-only">Saved review view</span><select value={savedView} onChange={(event) => applySavedView(event.target.value as SavedView)}><option value="all">All feedback</option><option value="attention">Needs attention</option><option value="new_flags">New flags</option><option value="with_comments">With comments</option><option value="pinned">Pinned records</option></select></label>
              <div className="filter-tabs" role="group" aria-label="Filter feedback by rating">{(["all", "up", "down"] as Filter[]).map((option) => <button key={option} className={ratingFilter === option ? "active" : ""} onClick={() => { setRatingFilter(option); resetListFocus(); }}>{option === "all" ? "All" : option === "up" ? "Accurate" : "Needs work"}</button>)}</div>
              <div className="admin-search-wrap"><label className="admin-search"><Search size={16} /><span className="sr-only">Search original query, user comment, or reviewer note</span><ShortcutTooltip><TooltipTrigger asChild><input ref={searchInputRef} type="search" value={search} onChange={(event) => { setSearch(event.target.value); resetListFocus(); }} placeholder="Search query, comment, note" aria-describedby="search-results-count" /></TooltipTrigger><TooltipContent className="shortcut-tooltip" side="top">Focus search <kbd>⌘/Ctrl K</kbd></TooltipContent></ShortcutTooltip><kbd className="search-shortcut" aria-label="Keyboard shortcut: Command or Control plus K">⌘/Ctrl K</kbd></label>{search && <button type="button" className="clear-search" onClick={() => { setSearch(""); resetListFocus(); }} aria-label="Clear keyword search"><X size={14} /></button>}<span className="search-results-count" id="search-results-count">{search ? `${filteredRecords.length} match${filteredRecords.length === 1 ? "" : "es"}` : "Query + comment + note"}</span></div>
            </div>
          </div>

          <div className="advanced-filters" aria-label="Advanced review filters"><SlidersHorizontal size={14} /><label>Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); resetListFocus(); }}><option value="all">Any status</option><option value="new">New</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option></select></label><label>Issue<select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value as typeof categoryFilter); resetListFocus(); }}><option value="all">Any issue</option>{Object.entries(issueLabels).filter(([value]) => value !== "none").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Sentiment<select value={sentimentFilter} onChange={(event) => { setSentimentFilter(event.target.value as typeof sentimentFilter); resetListFocus(); }}><option value="all">Any sentiment</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select></label><label>Sort<select value={sortBy} onChange={(event) => { setSortBy(event.target.value as SortBy); resetListFocus(); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="needs_review">Needs review first</option><option value="pinned">Pinned first</option></select></label><label>Rows<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetListFocus(); }}>{PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} per page</option>)}</select></label><button type="button" onClick={clearReviewFilters}>Clear filters</button></div>

          {filteredRecords.length === 0 ? <div className="feedback-empty"><div><ClipboardList size={26} /></div><h3>{records.length === 0 ? "No feedback collected here yet." : "No records match this view."}</h3><p>{records.length === 0 ? "Use the thumbs-up or thumbs-down controls in the support workspace, then return here to inspect the captured feedback. Tip: press ? for the full shortcut guide." : "Try clearing review filters or switch to a broader saved view."}</p><Link href="/" className="empty-action">Open support workspace <ArrowUpRight size={15} /></Link></div>
            : <div className={detailsOpen && selected ? "feedback-review-grid" : "feedback-review-grid detail-closed"}>
              <div className="feedback-record-list" id="feedback-list">
                {pagedRecords.map((record) => <ShortcutTooltip key={record.id}><TooltipTrigger asChild><button id={`feedback-record-${record.id}`} onClick={() => { setSelectedId(record.id); setDetailsOpen(true); }} className={selected?.id === record.id ? "feedback-record selected" : "feedback-record"} aria-current={selected?.id === record.id ? "true" : undefined}><div className="record-topline"><RatingBadge rating={record.rating} /><StatusBadge status={record.reviewStatus} /><SentimentBadge sentiment={record.sentiment} source={record.sentimentSource} />{record.pinned && <Pin size={13} className="pin-mark" />}</div><strong>{record.question}</strong><span>{record.comment || record.reviewerNote || "No written context"}</span><div className="record-footer"><time>{new Date(record.updatedAt).toLocaleString()}</time>{record.issueCategory !== "none" && <small>{issueLabels[record.issueCategory]}</small>}</div></button></TooltipTrigger><TooltipContent className="shortcut-tooltip" side="right">Open details <kbd>Enter</kbd> · Move <kbd>↑</kbd><kbd>↓</kbd></TooltipContent></ShortcutTooltip>)}
                <nav className="feedback-pagination" aria-label="Feedback list pagination"><span>Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredRecords.length)} of {filteredRecords.length}</span><div><button type="button" onClick={() => goToPage(safePage - 1)} disabled={safePage === 1} aria-label="Previous feedback page"><ChevronLeft size={16} /></button><select value={safePage} onChange={(event) => goToPage(Number(event.target.value))} aria-label="Select feedback page">{Array.from({ length: totalPages }, (_, index) => <option value={index + 1} key={index + 1}>Page {index + 1}</option>)}</select><button type="button" onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages} aria-label="Next feedback page"><ChevronRight size={16} /></button></div></nav>
              </div>

              {selected && detailsOpen && <article ref={detailPanelRef} tabIndex={-1} className="feedback-detail-card" aria-label={`Full details for: ${selected.question}`}><div className="detail-card-top"><span>Feedback record</span><ShortcutTooltip><TooltipTrigger asChild><span className="detail-close-hint"><kbd>Esc</kbd> Return to list</span></TooltipTrigger><TooltipContent className="shortcut-tooltip" side="top">Close details and return <kbd>Esc</kbd></TooltipContent></ShortcutTooltip><RatingBadge rating={selected.rating} /></div><div className="detail-block"><p>Original query</p><h3>{selected.question}</h3></div><div className="detail-block answer-block"><p>Generated answer</p><div>{selected.answer}</div></div><div className="detail-block"><p>AI sentiment</p><div className="sentiment-detail"><SentimentBadge sentiment={selected.sentiment} source={selected.sentimentSource} /><span>{selected.sentimentSource === "ai" ? "Classified from the written feedback." : "No written feedback: derived from the rating."}</span></div></div><div className="detail-block"><p>User comment</p><div className={selected.comment ? "comment-content" : "comment-content empty-comment"}>{selected.comment || "No optional comment was supplied with this rating."}</div></div><div className="review-editor"><div className="review-editor-heading"><span>Review workspace</span><button type="button" className={selected.pinned ? "pin-button pinned" : "pin-button"} onClick={() => persistReview({ pinned: !selected.pinned })}>{selected.pinned ? <PinOff size={13} /> : <Pin size={13} />}{selected.pinned ? "Unpin" : "Pin"}</button></div><div className="review-selects"><label>Status<select value={selected.reviewStatus} onChange={(event) => persistReview({ reviewStatus: event.target.value as FeedbackReviewStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Issue<select value={selected.issueCategory} onChange={(event) => persistReview({ issueCategory: event.target.value as FeedbackIssueCategory })}>{Object.entries(issueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><label className="review-note">Reviewer note<textarea value={selected.reviewerNote} onChange={(event) => persistReview({ reviewerNote: event.target.value.slice(0, 800) })} placeholder="Capture the follow-up, correction, or source to verify…" maxLength={800} rows={3} /><span>{selected.reviewerNote.length}/800 · saved to shared review</span></label></div><div className="detail-card-foot"><Check size={14} /> {selected.alertedAt ? "Owner alerted · " : ""}{selected.reviewedAt ? `Reviewed ${new Date(selected.reviewedAt).toLocaleString()}` : `Captured ${new Date(selected.updatedAt).toLocaleString()}`}</div></article>}
            </div>}
        </section>
      </main>
      {shortcutHelpOpen && <div className="shortcut-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeShortcutHelp(); }}><section className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-dialog-title"><div className="shortcut-dialog-top"><span>Review Desk</span><button ref={shortcutHelpCloseRef} type="button" onClick={closeShortcutHelp} aria-label="Close keyboard shortcuts"><X size={16} /></button></div><p className="shortcut-dialog-kicker">Keyboard reference <kbd>?</kbd></p><h2 id="shortcut-dialog-title">Work through feedback<br /><em>without leaving the keys.</em></h2><div className="shortcut-reference-list"><div><span><kbd>⌘/Ctrl</kbd><kbd>K</kbd></span><p><strong>Search feedback</strong><small>Focus the query, comment, and reviewer-note finder.</small></p></div><div><span><kbd>↑</kbd><kbd>↓</kbd></span><p><strong>Move selection</strong><small>Navigate feedback and cross pages.</small></p></div><div><span><kbd>Home</kbd><kbd>End</kbd></span><p><strong>Jump results</strong><small>Move to the first or last result.</small></p></div><div><span><kbd>↵</kbd></span><p><strong>Open details</strong><small>Expand the active feedback record.</small></p></div><div><span><kbd>Esc</kbd></span><p><strong>Return to list</strong><small>Close details or this reference.</small></p></div><div><span><kbd>?</kbd></span><p><strong>Toggle this guide</strong><small>Open or hide the shortcut reference.</small></p></div></div><p className="shortcut-dialog-foot">Shortcuts pause while you type in a form field. Settings and review labels are stored only in this browser.</p></section></div>}
    </div>
  );
}

export default function Admin() {
  return <DashboardLayout><ReviewDesk /></DashboardLayout>;
}
