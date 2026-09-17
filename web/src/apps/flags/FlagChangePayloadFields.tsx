import type { RequestPayload } from "@tools/contracts";
import { KeyValueRow } from "@tools/ui";

type Props = { payload: Extract<RequestPayload, { kind: "flag_change" }> };

export function FlagChangePayloadFields({ payload }: Props) {
  return (
    <>
      <KeyValueRow label="Flag"><code>{payload.flagKey}</code></KeyValueRow>
      <KeyValueRow label="Change">{payload.newValue ? "off" : "on"} → <strong>{payload.newValue ? "on" : "off"}</strong> <span className="muted small">(newValue={String(payload.newValue)})</span></KeyValueRow>
      <KeyValueRow label="Expected version">v{payload.expectedVersion} <span className="muted small">(publish is refused if the flag moved)</span></KeyValueRow>
    </>
  );
}
