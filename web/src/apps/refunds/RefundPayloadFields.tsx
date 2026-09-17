import type { RequestPayload } from "@tools/contracts";
import { formatMoney } from "../../format";

type Props = { payload: Extract<RequestPayload, { kind: "refund" }> };

export function RefundPayloadFields({ payload }: Props) {
  return (
    <>
      <dt>Amount</dt><dd>{formatMoney(payload.amountMinor, payload.currency)} <span className="muted small">({payload.amountMinor} minor units, server-derived)</span></dd>
      <dt>Currency</dt><dd>{payload.currency}</dd>
      <dt>Customer ref</dt><dd>{payload.customerRef} <span className="muted small">(masked)</span></dd>
      <dt>Payment id</dt><dd><code>{payload.paymentId}</code></dd>
    </>
  );
}
