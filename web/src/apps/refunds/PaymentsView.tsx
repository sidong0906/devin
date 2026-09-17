import { useCallback, useEffect, useState } from "react";
import type { Actor, PaymentDto } from "@tools/contracts";
import { api } from "../../api/client";
import { formatDate, formatMoney } from "../../format";
import { ErrorBox } from "../../platform/ErrorBox";
import { requestHref } from "../../hrefs";
import { Alert, Button, EmptyState, Loading, SectionHead, Table } from "@tools/ui";

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
      <SectionHead heading="Payments">
        <Button variant="secondary" onClick={() => void load()} disabled={payments === null && !loadError}>
          Refresh
        </Button>
      </SectionHead>
      {!canRequest ? <p className="muted">You can view payments but cannot request refunds (requires <code>refunds.request</code>).</p> : null}
      {loadError ? <ErrorBox error={loadError} prefix="Could not load payments:" /> : null}
      {payments === null && !loadError ? <Loading>Loading payments…</Loading> : null}
      {payments && payments.length === 0 ? <EmptyState>No payments seeded.</EmptyState> : null}
      {success ? (
        <Alert tone="ok">
          Refund request <a href={requestHref(success.requestId)} onClick={(e) => { e.preventDefault(); onNavigate(requestHref(success.requestId)); }}>{success.requestId}</a> created for {success.paymentId}. It now awaits an independent reviewer.
        </Alert>
      ) : null}
      {actionError ? <ErrorBox error={actionError.error} prefix={`Request for ${actionError.paymentId} rejected by server:`} /> : null}
      {payments && payments.length > 0 ? (
        <Table.Root>
          <Table.Head>
            <Table.Row>
              <Table.Th>Payment</Table.Th>
              <Table.Th className="num">Amount</Table.Th>
              <Table.Th>Customer (masked)</Table.Th>
              <Table.Th>Captured</Table.Th>
              <Table.Th>Refund request</Table.Th>
              {canRequest ? <Table.Th></Table.Th> : null}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {payments.map((p) => {
              const exists = p.refundRequestId !== null;
              return (
                <Table.Row key={p.id}>
                  <Table.Td><code>{p.id}</code></Table.Td>
                  <Table.Td className="num">{formatMoney(p.amountMinor, p.currency)}</Table.Td>
                  <Table.Td>{p.customerEmailMasked}</Table.Td>
                  <Table.Td>{formatDate(p.capturedAt)}</Table.Td>
                  <Table.Td>
                    {p.refundRequestId ? (
                      <a href={requestHref(p.refundRequestId)} onClick={(e) => { e.preventDefault(); onNavigate(requestHref(p.refundRequestId ?? "")); }}>
                        {p.refundRequestId}
                      </a>
                    ) : (
                      <span className="muted">none</span>
                    )}
                  </Table.Td>
                  {canRequest ? (
                    <Table.Td className="actions">
                      <Button
                        disabled={exists || submitting !== null}
                        title={exists ? "A refund request already exists for this payment (one request per payment)" : undefined}
                        onClick={() => void requestRefund(p.id)}
                      >
                        {submitting === p.id ? "Requesting…" : "Request full refund"}
                      </Button>
                      {exists ? <div className="muted small">Already requested</div> : null}
                    </Table.Td>
                  ) : null}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      ) : null}
    </section>
  );
}
