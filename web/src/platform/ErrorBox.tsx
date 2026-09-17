import { Alert } from "@tools/ui";
import { describeError } from "../api/client";

/** Renders a server error verbatim: status, code, message, requestId. Never paraphrase the code. */
export function ErrorBox({ error, prefix }: { error: unknown; prefix?: string }) {
  const e = describeError(error);
  return (
    <Alert tone="danger" role="alert">
      {prefix ? <strong>{prefix} </strong> : null}
      <code>
        {e.status ? `${e.status} ` : ""}
        {e.code}
      </code>{" "}
      {e.message}
      {e.requestId ? <span className="muted"> (requestId {e.requestId})</span> : null}
    </Alert>
  );
}
