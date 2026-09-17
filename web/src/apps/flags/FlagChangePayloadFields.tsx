import type { RequestPayload } from "@tools/contracts";

type Props = { payload: Extract<RequestPayload, { kind: "flag_change" }> };

export function FlagChangePayloadFields({ payload }: Props) {
  return (
    <>
      <dt>Flag</dt><dd><code>{payload.flagKey}</code></dd>
      <dt>Change</dt><dd>{payload.newValue ? "off" : "on"} → <strong>{payload.newValue ? "on" : "off"}</strong> <span className="muted small">(newValue={String(payload.newValue)})</span></dd>
      <dt>Expected version</dt><dd>v{payload.expectedVersion} <span className="muted small">(publish is refused if the flag moved)</span></dd>
    </>
  );
}
