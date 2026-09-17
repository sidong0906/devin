import { useEffect, useState } from "react";
import type { Actor, DemoUserKey } from "@tools/contracts";
import { ApiClientError, api } from "./api/client";
import { IdentityBar } from "./platform/IdentityBar";
import { ApprovalsQueue } from "./platform/ApprovalsQueue";
import { RequestDetail } from "./platform/RequestDetail";
import { WEB_APPS } from "./apps";
import { APPROVALS_HREF } from "./hrefs";
import { useHashRoute, type Route } from "./routes";
import { EmptyState, TabLink, Tabs } from "@tools/ui";

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
    <TabLink key={hash} href={hash} active={active} onClick={(e) => { e.preventDefault(); navigate(hash); }}>
      {label}
    </TabLink>
  );

  return (
    <div className="app">
      <IdentityBar actor={actor} selected={selected} busy={busy} error={authError} onSelect={(k) => void selectIdentity(k)} />
      <Tabs>
        {WEB_APPS.map((app) => tab(route.name === "app" && route.app === app.name, app.tab.label, app.tab.hash))}
        {tab(route.name === "approvals" || route.name === "request", "Approvals queue", APPROVALS_HREF)}
      </Tabs>
      <main>
        {!actor ? (
          <EmptyState>{busy ? "Checking session…" : "Select a demo identity above to load data."}</EmptyState>
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
  if (!app) return <EmptyState>Unknown app.</EmptyState>;
  return <app.View actor={actor} onNavigate={onNavigate} />;
}
