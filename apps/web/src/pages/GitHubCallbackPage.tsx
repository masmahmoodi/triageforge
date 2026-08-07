import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export function GitHubCallbackPage(): React.ReactElement {
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
