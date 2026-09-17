import { useEffect, useState, type ReactNode } from "react";
import type { Actor, DemoUserKey } from "@tools/contracts";
import { ApiClientError, api } from "./api/client";
import { IdentityBar } from "./platform/IdentityBar";
import { ApprovalsQueue } from "./platform/ApprovalsQueue";
import { RequestDetail } from "./platform/RequestDetail";
import { Overview } from "./platform/Overview";
import { WEB_APPS } from "./apps";
import { APPROVALS_HREF, HOME_HREF } from "./hrefs";
import { useHashRoute, type Route } from "./routes";
import { AppIcon, AppShell, EmptyState, Icons, NavItem, NavSection, Sidebar } from "@tools/ui";

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

  const item = (active: boolean, label: string, hash: string, icon: ReactNode) => (
    <NavItem key={hash} href={hash} active={active} icon={icon} onClick={(e) => { e.preventDefault(); navigate(hash); }}>
      {label}
    </NavItem>
  );

  const sidebar = (
    <Sidebar
      brand={
        <>
          <AppIcon color="pending"><Icons.LayersIcon /></AppIcon>
          <span>Internal tools</span>
        </>
      }
      footer="Every write goes through request → independent approval → audit."
    >
      <NavSection title="Home">
        {item(route.name === "home", "Overview", HOME_HREF, <AppIcon color="pending" size="sm"><Icons.DashboardIcon /></AppIcon>)}
        {item(route.name === "approvals" || route.name === "request", "Approvals queue", APPROVALS_HREF, <AppIcon color="amber" size="sm"><Icons.CheckCircledIcon /></AppIcon>)}
      </NavSection>
      <NavSection title="Tools">
        {WEB_APPS.map((app) => item(route.name === "app" && route.app === app.name, app.tab.label, app.tab.hash, <AppIcon color={app.color} size="sm">{app.icon}</AppIcon>))}
      </NavSection>
    </Sidebar>
  );

  return (
    <AppShell sidebar={sidebar} header={<IdentityBar actor={actor} selected={selected} busy={busy} error={authError} onSelect={(k) => void selectIdentity(k)} />}>
      {!actor ? (
        <EmptyState>{busy ? "Checking session…" : "Select a demo identity above to load data."}</EmptyState>
      ) : (
        <RouteView actor={actor} route={route} onNavigate={navigate} />
      )}
    </AppShell>
  );
}

function RouteView({ actor, route, onNavigate }: { actor: Actor; route: Route; onNavigate: (hash: string) => void }) {
  if (route.name === "home") return <Overview actor={actor} onNavigate={onNavigate} />;
  if (route.name === "approvals") return <ApprovalsQueue actor={actor} onNavigate={onNavigate} />;
  if (route.name === "request") return <RequestDetail actor={actor} requestId={route.id} onNavigate={onNavigate} />;
  const app = WEB_APPS.find((a) => a.name === route.app);
  if (!app) return <EmptyState>Unknown app.</EmptyState>;
  return <app.View actor={actor} onNavigate={onNavigate} />;
}
