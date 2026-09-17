import type { WebApp } from "../types";
import { PaymentsView } from "./PaymentsView";
import { RefundPayloadFields } from "./RefundPayloadFields";

export const refundsWebApp: WebApp<"refund"> = {
  name: "refunds",
  kind: "refund",
  tab: { label: "Payments / Request refund", hash: "#/payments" },
  reviewPermission: "refunds.review",
  View: PaymentsView,
  PayloadFields: RefundPayloadFields,
  approvedNote: null,
};
