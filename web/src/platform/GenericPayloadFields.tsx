import type { RequestPayload } from "@tools/contracts";

/** Fallback for a request kind with no registered web app: show the immutable payload verbatim. */
export function GenericPayloadFields({ payload }: { payload: RequestPayload }) {
  return (
    <>
      <dt>Payload</dt><dd><code>{JSON.stringify(payload)}</code></dd>
    </>
  );
}
