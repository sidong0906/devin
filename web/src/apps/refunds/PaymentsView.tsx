import { useCallback, useEffect, useState } from "react";
import type { Actor, PaymentDto } from "@tools/contracts";
import { api } from "../../api/client";
import { formatDate, formatMoney } from "../../format";
import { ErrorBox } from "../../components/ErrorBox";
import { requestHref } from "../../hrefs";

type Props = { actor: Actor; onNavigate: (hash: string) => void };

export function PaymentsView({ actor, onNavigate }: Props) {
  const [payments, setPayments] = useState<PaymentDto[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<{ paymentId: string; error: unknown } | null>(null);
  const [success, setSuccess] = useState<{ paymentId: string; requestId: string } | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.payments();
      setPayments(res.payments);
    } catch (e) {
      setLoadError(e);
      setPayments(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, actor.id]);

  const canRequest = actor.permissions.includes("refunds.request");

  async function requestRefund(paymentId: string) {
    setSubmitting(paymentId);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await api.requestRefund(paymentId);
      setSuccess({ paymentId, requestId: res.requestId });
      await load();
    } catch (e) {
      setActionError({ paymentId, error: e });
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <section>
      <div className="section-head">
        <h2>Payments</h2>
        <button className="btn btn-secondary" onClick={() => void load()} disabled={payments === null && !loadError}>
          Refresh
        </button>
      </div>
      {!canRequest ? <p className="muted">You can view payments but cannot request refunds (requires <code>refunds.request</code>).</p> : null}
      {loadError ? <ErrorBox error={loadError} prefix="Could not load payments:" /> : null}
      {payments === null && !loadError ? <p className="muted">Loading payments…</p> : null}
      {payments && payments.length === 0 ? <p className="empty">No payments seeded.</p> : null}
      {success ? (
        <div className="alert alert-ok" role="status">
          Refund request <a href={requestHref(success.requestId)} onClick={(e) => { e.preventDefault(); onNavigate(requestHref(success.requestId)); }}>{success.requestId}</a> created for {success.paymentId}. It now awaits an independent reviewer.
        </div>
      ) : null}
      {actionError ? <ErrorBox error={actionError.error} prefix={`Request for ${actionError.paymentId} rejected by server:`} /> : null}
      {payments && payments.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>Payment</th>
              <th className="num">Amount</th>
              <th>Customer (masked)</th>
              <th>Captured</th>
              <th>Refund request</th>
              {canRequest ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const exists = p.refundRequestId !== null;
              return (
                <tr key={p.id}>
                  <td><code>{p.id}</code></td>
                  <td className="num">{formatMoney(p.amountMinor, p.currency)}</td>
                  <td>{p.customerEmailMasked}</td>
                  <td>{formatDate(p.capturedAt)}</td>
                  <td>
                    {p.refundRequestId ? (
                      <a href={requestHref(p.refundRequestId)} onClick={(e) => { e.preventDefault(); onNavigate(requestHref(p.refundRequestId ?? "")); }}>
                        {p.refundRequestId}
                      </a>
                    ) : (
                      <span className="muted">none</span>
                    )}
                  </td>
                  {canRequest ? (
                    <td className="actions">
                      <button
                        className="btn"
                        disabled={exists || submitting !== null}
                        title={exists ? "A refund request already exists for this payment (one request per payment)" : undefined}
                        onClick={() => void requestRefund(p.id)}
                      >
                        {submitting === p.id ? "Requesting…" : "Request full refund"}
                      </button>
                      {exists ? <div className="muted small">Already requested</div> : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
