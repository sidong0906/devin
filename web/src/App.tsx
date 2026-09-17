import { useEffect, useState } from "react";
import type { Actor, DemoUserKey } from "@tools/contracts";
import { ApiClientError, api } from "./api/client";
import { IdentityBar } from "./components/IdentityBar";
import { PaymentsView } from "./components/PaymentsView";
import { ApprovalsQueue } from "./components/ApprovalsQueue";
import { RequestDetail } from "./components/RequestDetail";
import { FlagsView } from "./components/FlagsView";
import { useHashRoute } from "./routes";

export function App() {
  const [actor, setActor] = useState<Actor | null>(null);
  const [selected, setSelected] = useState<DemoUserKey | null>(null);
  const [busy, setBusy] = useState(true);
  const [authError, setAuthError] = useState<unknown>(null);
  const [route, navigate] = useHashRoute();

  // Restore an existing cookie session on load (401 simply means "not signed in").
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((a) => {
        if (!cancelled) setActor(a);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiClientError && e.status === 401) return;
        setAuthError(e);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectIdentity(key: DemoUserKey) {
    setBusy(true);
    setAuthError(null);
    setSelected(key);
    try {
      await api.demoSession(key);
      setActor(await api.me());
    } catch (e) {
      setAuthError(e);
      setActor(null);
    } finally {
      setBusy(false);
    }
  }

  const tab = (name: "payments" | "approvals" | "flags", label: string, hash: string) => (
    <a href={hash} className={route.name === name || (name === "approvals" && route.name === "request") ? "tab active" : "tab"} onClick={(e) => { e.preventDefault(); navigate(hash); }}>
      {label}
    </a>
  );

  return (
    <div className="app">
      <IdentityBar actor={actor} selected={selected} busy={busy} error={authError} onSelect={(k) => void selectIdentity(k)} />
      <nav className="tabs">
        {tab("payments", "Payments / Request refund", "#/payments")}
        {tab("approvals", "Approvals queue", "#/approvals")}
        {tab("flags", "Feature flags", "#/flags")}
      </nav>
      <main>
        {!actor ? (
          <p className="empty">{busy ? "Checking session…" : "Select a demo identity above to load data."}</p>
        ) : route.name === "payments" ? (
          <PaymentsView actor={actor} onNavigate={navigate} />
        ) : route.name === "approvals" ? (
          <ApprovalsQueue actor={actor} onNavigate={navigate} />
        ) : route.name === "flags" ? (
          <FlagsView actor={actor} onNavigate={navigate} />
        ) : (
          <RequestDetail actor={actor} requestId={route.id} onNavigate={navigate} />
        )}
      </main>
    </div>
  );
}
