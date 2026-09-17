import type { WebApp } from "../types";
import { refundsMeta } from "./meta";
import { PaymentsView } from "./PaymentsView";
import { RefundPayloadFields } from "./RefundPayloadFields";

export const refundsWebApp: WebApp<"refund"> = {
  name: "refunds",
  kind: "refund",
  tab: { label: refundsMeta.label, hash: "#/payments" },
  description: refundsMeta.description,
  icon: refundsMeta.icon,
  color: refundsMeta.color,
  reviewPermission: "refunds.review",
  View: PaymentsView,
  PayloadFields: RefundPayloadFields,
  approvedNote: null,
};
