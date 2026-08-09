import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCcw,
  SearchCheck,
  Sparkles,
  Tags
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  approveIssue,
  getIssue,
  retriageIssue
} from "../api/client";
import { Button } from "../components/Button";
import { ErrorPanel, Pill } from "./DashboardPage";

export function IssueDetailPage(): React.ReactElement {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const issueQuery = useQuery({
    queryKey: ["issue", id],
    queryFn: () => getIssue(id ?? ""),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.data.latestAnalysis?.status;

      return status === "pending" ? 2500 : false;
    }
  });
  const issue = issueQuery.data?.data;
  const analysis = issue?.latestAnalysis?.analysis ?? null;
  const appliedApproval = issue?.approvals.find(
    (approval) =>
      approval.status === "applied" &&
      approval.analysisId === issue.latestAnalysis?.id
  );
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [includeComment, setIncludeComment] = useState(true);
  const retriageMutation = useMutation({
    mutationFn: () => retriageIssue(id ?? ""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issue", id] });
      await queryClient.invalidateQueries({ queryKey: ["issues"] });
    }
  });
  const isAnalysisRunning =
    retriageMutation.isPending || issue?.latestAnalysis?.status === "pending";
  const approvalMutation = useMutation({
    mutationFn: () =>
      approveIssue({
        issueId: id ?? "",
        analysisId: issue?.latestAnalysis?.id ?? "",
        labels: selectedLabels,
        comment: includeComment ? comment : ""
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issue", id] });
      await queryClient.invalidateQueries({ queryKey: ["issues"] });
    }
  });
  useEffect(() => {
    if (analysis) {
      setSelectedLabels(analysis.suggestedLabels.map((label) => label.name));
      setComment(analysis.draftResponse);
      setIncludeComment(true);
    }
  }, [analysis]);

  if (issueQuery.isLoading) {
    return (
      <div className="surface mx-auto max-w-2xl rounded-lg p-6 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-slate-900">Loading issue</p>
        <p className="mt-1 text-sm text-slate-500">
          Fetching the stored GitHub issue and latest AI analysis.
        </p>
      </div>
    );
  }

  if (issueQuery.error || !issue) {
    return (
      <ErrorPanel
        message={issueQuery.error?.message ?? "Issue could not be loaded"}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Link className="text-sm font-medium text-teal-700 hover:text-teal-800" to="/">
            Back to issues
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {issue.repository.fullName} #{issue.number}
            </span>
            <Pill value={issue.state} tone={issue.state === "open" ? "green" : "slate"} />
            <Pill value={issue.priority ?? "untriaged"} tone="blue" />
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            {issue.title}
          </h1>
          <a
            className="mt-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-950"
            href={issue.htmlUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open on GitHub
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
        <Button
          variant="secondary"
          onClick={() => retriageMutation.mutate()}
          disabled={retriageMutation.isPending}
        >
          {retriageMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          )}
          {retriageMutation.isPending ? "Re-triaging" : "Re-triage"}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <Panel title="Issue Body">
            <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {issue.body || "No body provided."}
            </pre>
          </Panel>

          <Panel title="AI Analysis">
            {isAnalysisRunning ? (
              <TriageProgress
                title={
                  retriageMutation.isPending
                    ? "Re-running AI triage"
                    : "AI triage is running"
                }
                description={
                  retriageMutation.isPending
                    ? "We are creating a fresh analysis from the latest issue text."
                    : "GitHub delivered the issue. TriageForge is reading it, asking OpenAI for structured analysis, building an embedding, and checking for similar issues."
                }
              />
            ) : issue.latestAnalysis?.status === "failed" ? (
              <ErrorPanel
                message={
                  issue.latestAnalysis.errorMessage ??
                  "Analysis failed. Check API configuration and logs."
                }
              />
            ) : analysis ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Category" value={analysis.category} />
                  <Metric label="Priority" value={analysis.priority} />
                  <Metric
                    label="Confidence"
                    value={`${Math.round(analysis.confidence * 100)}%`}
                  />
                </div>
                <TextBlock label="Summary" value={analysis.summary} />
                <TextBlock label="User Impact" value={analysis.userImpact} />
                <TextBlock label="Rationale" value={analysis.rationale} />
                {analysis.missingInformation.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Missing information
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {analysis.missingInformation.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <TriageProgress
                title="Waiting for AI triage"
                description="The issue is stored, but no analysis has been generated yet. Refresh or click Re-triage to start a new pass."
                idle
              />
            )}
          </Panel>

          <Panel title="Similar Issues">
            {isAnalysisRunning ? (
              <SimilarIssuesLoading />
            ) : issue.latestAnalysis?.similarIssues.length ? (
              <ul className="divide-y divide-slate-200">
                {issue.latestAnalysis.similarIssues.map((candidate) => (
                  <li key={candidate.issueId} className="py-3">
                    <a
                      className="font-medium text-slate-950 hover:text-teal-700"
                      href={candidate.htmlUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      #{candidate.issueNumber} {candidate.title}
                    </a>
                    <p className="mt-1 text-xs text-slate-500">
                      {Math.round(candidate.similarity * 100)}% similar - {candidate.state}
                    </p>
                    {candidate.summary ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {candidate.summary}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No similar issues found.</p>
            )}
          </Panel>
        </section>

        <aside className="space-y-4">
          <Panel title="Approve Actions">
            {isAnalysisRunning ? (
              <div className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-800">
                Approval unlocks after AI suggestions are ready. Nothing is sent to GitHub automatically.
              </div>
            ) : analysis ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  approvalMutation.mutate();
                }}
              >
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Tags className="h-4 w-4" aria-hidden="true" />
                    Labels
                  </div>
                  <div className="space-y-2">
                    {analysis.suggestedLabels.map((label) => (
                      <label
                        className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm"
                        key={label.name}
                      >
                        <input
                          className="mt-1"
                          type="checkbox"
                          checked={selectedLabels.includes(label.name)}
                          disabled={Boolean(appliedApproval)}
                          onChange={(event) =>
                            setSelectedLabels((current) =>
                              event.target.checked
                                ? [...current, label.name]
                                : current.filter((value) => value !== label.name)
                            )
                          }
                        />
                        <span>
                          <span className="font-medium text-slate-900">
                            {label.name}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {label.rationale}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <input
                      className="h-4 w-4"
                      type="checkbox"
                      checked={includeComment}
                      disabled={Boolean(appliedApproval)}
                      onChange={(event) => setIncludeComment(event.target.checked)}
                    />
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    Comment
                  </span>
                  <textarea
                    className="focus-ring min-h-44 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm"
                    disabled={Boolean(appliedApproval) || !includeComment}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </label>
                {approvalMutation.error ? (
                  <ErrorPanel message={approvalMutation.error.message} />
                ) : null}
                {approvalMutation.isSuccess || appliedApproval ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Applied to GitHub
                  </div>
                ) : null}
                <Button
                  className="w-full"
                  disabled={
                    Boolean(appliedApproval) ||
                    approvalMutation.isPending ||
                    (!selectedLabels.length &&
                      (!includeComment || !comment.trim()))
                  }
                  type="submit"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Apply to GitHub
                </Button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">
                Approval controls appear after analysis completes.
              </p>
            )}
          </Panel>

          <Panel title="History">
            {issue.approvals.length ? (
              <ul className="space-y-3">
                {issue.approvals.map((approval) => (
                  <li
                    className="rounded-md border border-slate-200 p-3 text-sm"
                    key={approval.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {approval.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(approval.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {approval.approvedLabels.join(", ") || "comment only"}
                    </p>
                    {approval.errorMessage ? (
                      <p className="mt-2 text-xs text-rose-600">
                        {approval.errorMessage}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No approvals yet.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function TriageProgress({
  title,
  description,
  idle = false
}: {
  title: string;
  description: string;
  idle?: boolean;
}): React.ReactElement {
  const steps = [
    {
      icon: Sparkles,
      label: "Structured triage",
      text: "Category, priority, confidence, summary, missing info, and draft reply."
    },
    {
      icon: SearchCheck,
      label: "Similarity search",
      text: "Embedding is compared with older issues in pgvector."
    },
    {
      icon: Tags,
      label: "Human approval",
      text: "Labels and comments stay local until you approve them."
    }
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-teal-100 bg-teal-50 p-4">
        <div className="flex items-start gap-3">
          {idle ? (
            <Sparkles className="mt-0.5 h-5 w-5 text-teal-700" aria-hidden="true" />
          ) : (
            <Loader2
              className="mt-0.5 h-5 w-5 animate-spin text-teal-700"
              aria-hidden="true"
            />
          )}
          <div>
            <h3 className="text-sm font-semibold text-teal-950">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-teal-800">
              {description}
            </p>
          </div>
        </div>
        {!idle ? (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-teal-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-600" />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;

          return (
            <div
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              key={step.label}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
                {step.label}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {step.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SimilarIssuesLoading(): React.ReactElement {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Checking previous issues for possible duplicates or related reports.
      </p>
      <div className="space-y-2">
        {[0, 1, 2].map((index) => (
          <div
            className="skeleton h-10 rounded-lg"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

function Panel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="surface rounded-lg p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function TextBlock({
  label,
  value
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}
