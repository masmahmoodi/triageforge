import type { IssueListItem, Repository } from "@triageforge/contracts";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import {
  Filter,
  GitBranch,
  RefreshCcw,
  Search,
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
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor
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
    <div className="space-y-5">
      <section className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Issues</h1>
          <p className="text-sm text-slate-600">
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

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr]">
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
              className="focus-ring h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm"
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

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Loading issues
          </p>
        ) : issuesQuery.error ? (
          <ErrorPanel message={issuesQuery.error.message} />
        ) : issues.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No issues match the current filters.
          </p>
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
        className="grid gap-2 px-4 py-4 transition hover:bg-slate-50 md:grid-cols-[1fr_auto] md:items-center"
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              #{issue.number}
            </span>
            <h3 className="truncate text-sm font-semibold text-slate-950">
              {issue.title}
            </h3>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">
            {repository?.fullName ?? "Unknown repository"} · {issue.authorLogin ?? "unknown"}
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
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
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
        className="focus-ring h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-8 text-sm"
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
    <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}
