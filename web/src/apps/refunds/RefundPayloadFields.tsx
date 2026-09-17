import type { RequestPayload } from "@tools/contracts";
import { formatMoney } from "../../format";
import { KeyValueRow } from "@tools/ui";

type Props = { payload: Extract<RequestPayload, { kind: "refund" }> };

export function RefundPayloadFields({ payload }: Props) {
  return (
    <>
      <KeyValueRow label="Amount">{formatMoney(payload.amountMinor, payload.currency)} <span className="muted small">({payload.amountMinor} minor units, server-derived)</span></KeyValueRow>
      <KeyValueRow label="Currency">{payload.currency}</KeyValueRow>
      <KeyValueRow label="Customer ref">{payload.customerRef} <span className="muted small">(masked)</span></KeyValueRow>
      <KeyValueRow label="Payment id"><code>{payload.paymentId}</code></KeyValueRow>
    </>
  );
}
