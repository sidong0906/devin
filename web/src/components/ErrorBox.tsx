import { describeError } from "../api/client";

export function ErrorBox({ error, prefix }: { error: unknown; prefix?: string }) {
  const e = describeError(error);
  return (
    <div className="alert alert-error" role="alert">
      {prefix ? <strong>{prefix} </strong> : null}
      <code>
        {e.status ? `${e.status} ` : ""}
        {e.code}
      </code>{" "}
      {e.message}
      {e.requestId ? <span className="muted"> (requestId {e.requestId})</span> : null}
    </div>
  );
}
