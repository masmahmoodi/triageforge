import type { IssueListItem, Repository } from "@triageforge/contracts";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import {
  Filter,
  GitBranch,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Tags
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getGitHubSetupUrl,
  listIssues,
  listRepositories
} from "../api/client";
import { Button } from "../components/Button";

export function DashboardPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");
  const repositoriesQuery = useQuery({
    queryKey: ["repositories"],
    queryFn: listRepositories
  });
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    const repositoryId = searchParams.get("repositoryId");
    const state = searchParams.get("state");
    const priority = searchParams.get("priority");
    const q = searchParams.get("q");

    params.set("limit", "20");

    if (repositoryId) {
      params.set("repositoryId", repositoryId);
    }

    if (state) {
      params.set("state", state);
    }

    if (priority) {
      params.set("priority", priority);
    }

    if (q) {
      params.set("q", q);
    }

    return params;
  }, [searchParams]);
  const issuesQuery = useInfiniteQuery({
    queryKey: ["issues", queryParams.toString()],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams(queryParams);

      if (pageParam) {
        params.set("cursor", pageParam);
      }

      return listIssues(params);
    },
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor,
    refetchInterval: (query) => {
      const pages = query.state.data?.pages ?? [];
      const hasPendingAnalysis = pages.some((page) =>
        page.data.some((issue) => issue.analysisStatus === "pending")
      );

      return hasPendingAnalysis ? 3000 : false;
    }
  });
  const setupMutation = useMutation({
    mutationFn: getGitHubSetupUrl,
    onSuccess: (response) => {
      window.location.assign(response.data.url);
    }
  });
  const issues =
    issuesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const repositories = repositoriesQuery.data?.data ?? [];
  const pendingCount = issues.filter(
    (issue) => issue.analysisStatus === "pending"
  ).length;
  const completedCount = issues.filter(
    (issue) => issue.analysisStatus === "completed"
  ).length;

  function updateParam(name: string, value: string): void {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(name, value);
    } else {
      next.delete(name);
    }

    setSearchParams(next);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
            GitHub issue intelligence
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Issues</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review AI triage before labels or comments reach GitHub.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setupMutation.mutate()}
          disabled={setupMutation.isPending}
        >
          <GitBranch className="h-4 w-4" aria-hidden="true" />
          Connect repository
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<GitBranch className="h-4 w-4" aria-hidden="true" />}
          label="Connected repositories"
          value={repositoriesQuery.isLoading ? "..." : repositories.length.toString()}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          label="Completed triage"
          value={completedCount.toString()}
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          label="AI jobs running"
          value={pendingCount.toString()}
        />
      </section>

      <section className="surface grid gap-3 rounded-lg p-4 md:grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr]">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            updateParam("q", searchDraft.trim());
          }}
        >
          <label className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              className="focus-ring h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search issues"
            />
          </label>
          <Button variant="secondary" type="submit" title="Search">
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
        <Select
          icon={<GitBranch className="h-4 w-4" aria-hidden="true" />}
          value={searchParams.get("repositoryId") ?? ""}
          onChange={(value) => updateParam("repositoryId", value)}
          options={[
            { label: "All repositories", value: "" },
            ...repositories.map((repository) => ({
              label: repository.fullName,
              value: repository.id
            }))
          ]}
        />
        <Select
          icon={<Filter className="h-4 w-4" aria-hidden="true" />}
          value={searchParams.get("state") ?? ""}
          onChange={(value) => updateParam("state", value)}
          options={[
            { label: "Any state", value: "" },
            { label: "Open", value: "open" },
            { label: "Closed", value: "closed" }
          ]}
        />
        <Select
          icon={<Tags className="h-4 w-4" aria-hidden="true" />}
          value={searchParams.get("priority") ?? ""}
          onChange={(value) => updateParam("priority", value)}
          options={[
            { label: "Any priority", value: "" },
            { label: "Urgent", value: "urgent" },
            { label: "High", value: "high" },
            { label: "Medium", value: "medium" },
            { label: "Low", value: "low" }
          ]}
        />
      </section>

      {setupMutation.error ? (
        <ErrorPanel message={setupMutation.error.message} />
      ) : null}

      <section className="surface overflow-hidden rounded-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {issues.length} loaded
          </h2>
          <Button
            variant="ghost"
            onClick={() => void issuesQuery.refetch()}
            disabled={issuesQuery.isFetching}
            title="Refresh"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {issuesQuery.isLoading ? (
          <IssueListSkeleton />
        ) : issuesQuery.error ? (
          <ErrorPanel message={issuesQuery.error.message} />
        ) : issues.length === 0 ? (
          <EmptyIssues />
        ) : (
          <ul className="divide-y divide-slate-200">
            {issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} repositories={repositories} />
            ))}
          </ul>
        )}
      </section>

      {issuesQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => void issuesQuery.fetchNextPage()}
            disabled={issuesQuery.isFetchingNextPage}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function IssueRow({
  issue,
  repositories
}: {
  issue: IssueListItem;
  repositories: Repository[];
}): React.ReactElement {
  const repository = repositories.find((candidate) => candidate.id === issue.repositoryId);

  return (
    <li>
      <Link
        to={`/issues/${issue.id}`}
        className="grid gap-3 px-4 py-4 transition hover:bg-teal-50/40 md:grid-cols-[1fr_auto] md:items-center"
      >
        <div className="min-w-0 border-l-2 border-teal-200 pl-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              #{issue.number}
            </span>
            <h3 className="truncate text-sm font-semibold text-slate-950">
              {issue.title}
            </h3>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">
            {repository?.fullName ?? "Unknown repository"} - {issue.authorLogin ?? "unknown"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {issue.labels.slice(0, 6).map((label) => (
              <span
                key={label}
                className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              >
                {label}
              </span>
            ))}
            {issue.analysisStatus === "pending" ? (
              <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-100">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                AI triage running
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Pill value={issue.state} tone={issue.state === "open" ? "green" : "slate"} />
          <Pill value={issue.priority ?? "untriaged"} tone="blue" />
          <Pill value={issue.analysisStatus ?? "no analysis"} tone="amber" />
        </div>
      </Link>
    </li>
  );
}

export function Pill({
  value,
  tone
}: {
  value: string;
  tone: "green" | "blue" | "amber" | "slate";
}): React.ReactElement {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200"
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${tones[tone]}`}>
      {value}
    </span>
  );
}

function Select({
  icon,
  value,
  onChange,
  options
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}): React.ReactElement {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
        {icon}
      </span>
      <select
        className="focus-ring h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm shadow-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ErrorPanel({ message }: { message: string }): React.ReactElement {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

function IssueListSkeleton(): React.ReactElement {
  return (
    <div className="space-y-3 px-4 py-5">
      {[0, 1, 2].map((item) => (
        <div className="flex items-center justify-between gap-4" key={item}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-2/5 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
          <div className="hidden gap-2 sm:flex">
            <div className="skeleton h-6 w-16 rounded-full" />
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
      <p className="pt-1 text-center text-sm text-slate-500">
        Loading issues and checking analysis status.
      </p>
    </div>
  );
}

function EmptyIssues(): React.ReactElement {
  return (
    <div className="px-4 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Search className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-900">
        No issues match the current filters.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        New issues appear here after GitHub sends a verified webhook.
      </p>
    </div>
  );
}
