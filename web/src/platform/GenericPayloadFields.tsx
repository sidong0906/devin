import type { RequestPayload } from "@tools/contracts";
import { KeyValueRow } from "@tools/ui";

/** Fallback for a request kind with no registered web app: show the immutable payload verbatim. */
export function GenericPayloadFields({ payload }: { payload: RequestPayload }) {
  return (
    <KeyValueRow label="Payload"><code>{JSON.stringify(payload)}</code></KeyValueRow>
  );
}
