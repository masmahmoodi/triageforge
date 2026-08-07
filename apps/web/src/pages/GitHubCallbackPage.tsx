import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

export function GitHubCallbackPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const connected = searchParams.get("connected") === "1";
  const reason = searchParams.get("reason");

  if (!connected) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-amber-200 bg-white p-6 text-center shadow-sm">
        <AlertCircle
          className="mx-auto h-10 w-10 text-amber-600"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-xl font-semibold text-slate-950">
          Repository connection needs one more step
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {callbackFailureMessage(reason)}
        </p>
        <Link
          className="focus-ring mt-5 inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
          to="/"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold text-slate-950">
        Repository connection updated
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        New GitHub issues will appear after webhooks arrive. Existing repositories are ready for review.
      </p>
      <Link
        className="focus-ring mt-5 inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
        to="/"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

function callbackFailureMessage(reason: string | null): string {
  if (reason === "missing_state") {
    return "Start from the Connect repository button inside TriageForge so the installation can be securely linked to your account.";
  }

  if (reason === "missing_installation") {
    return "GitHub did not send an installation id. Please try connecting the repository again from TriageForge.";
  }

  return "The GitHub installation could not be linked. Please try connecting the repository again from TriageForge.";
}
