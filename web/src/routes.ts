import { useEffect, useState } from "react";
import { WEB_APPS, appForHash } from "./apps";

export type Route = { name: "app"; app: string } | { name: "approvals" } | { name: "request"; id: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, "");
  const m = /^\/approvals\/([^/]+)$/.exec(h);
  if (m && m[1]) return { name: "request", id: decodeURIComponent(m[1]) };
  if (h === "/approvals") return { name: "approvals" };
  const app = appForHash(`#${h}`) ?? WEB_APPS[0];
  if (!app) return { name: "approvals" };
  return { name: "app", app: app.name };
}

export { requestHref } from "./hrefs";

export function useHashRoute(): [Route, (hash: string) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const navigate = (hash: string) => {
    if (window.location.hash === hash) return;
    window.location.hash = hash;
  };
  return [route, navigate];
}
