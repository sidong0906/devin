import { useEffect, useState } from "react";
import type { Actor, DemoUserKey } from "@tools/contracts";
import { ApiClientError, api } from "./api/client";
import { IdentityBar } from "./platform/IdentityBar";
import { ApprovalsQueue } from "./platform/ApprovalsQueue";
import { RequestDetail } from "./platform/RequestDetail";
import { WEB_APPS } from "./apps";
import { APPROVALS_HREF } from "./hrefs";
import { useHashRoute, type Route } from "./routes";

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

  const tab = (active: boolean, label: string, hash: string) => (
    <a key={hash} href={hash} className={active ? "tab active" : "tab"} onClick={(e) => { e.preventDefault(); navigate(hash); }}>
      {label}
    </a>
  );

  return (
    <div className="app">
      <IdentityBar actor={actor} selected={selected} busy={busy} error={authError} onSelect={(k) => void selectIdentity(k)} />
      <nav className="tabs">
        {WEB_APPS.map((app) => tab(route.name === "app" && route.app === app.name, app.tab.label, app.tab.hash))}
        {tab(route.name === "approvals" || route.name === "request", "Approvals queue", APPROVALS_HREF)}
      </nav>
      <main>
        {!actor ? (
          <p className="empty">{busy ? "Checking session…" : "Select a demo identity above to load data."}</p>
        ) : (
          <RouteView actor={actor} route={route} onNavigate={navigate} />
        )}
      </main>
    </div>
  );
}

function RouteView({ actor, route, onNavigate }: { actor: Actor; route: Route; onNavigate: (hash: string) => void }) {
  if (route.name === "approvals") return <ApprovalsQueue actor={actor} onNavigate={onNavigate} />;
  if (route.name === "request") return <RequestDetail actor={actor} requestId={route.id} onNavigate={onNavigate} />;
  const app = WEB_APPS.find((a) => a.name === route.app);
  if (!app) return <p className="empty">Unknown app.</p>;
  return <app.View actor={actor} onNavigate={onNavigate} />;
}
