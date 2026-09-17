import { useState } from "react";
import { DEMO_USERS, DemoUserKey } from "@tools/contracts";
import type { Actor } from "@tools/contracts";
import { PermissionChip } from "./Badges";
import { ErrorBox } from "./ErrorBox";
import { USE_FIXTURES } from "../api/client";
import { ChipGroup, Select } from "@tools/ui";

type Props = {
  actor: Actor | null;
  selected: DemoUserKey | null;
  busy: boolean;
  error: unknown;
  onSelect: (key: DemoUserKey) => void;
};

export function IdentityBar({ actor, selected, busy, error, onSelect }: Props) {
  const [pending, setPending] = useState<DemoUserKey | "">(selected ?? "");
  return (
    <header className="identity-bar">
      <div className="identity-row">
        <span className="demo-banner">DEMO AUTH — synthetic identities</span>
        {USE_FIXTURES ? <span className="fixture-badge" title="Data served from in-memory fixtures, not the API">FIXTURE DATA</span> : null}
        <label className="identity-select">
          Act as
          <Select
            aria-label="Demo identity"
            value={pending}
            disabled={busy}
            onChange={(e) => {
              const key = DemoUserKey.safeParse(e.target.value);
              if (!key.success) return;
              setPending(key.data);
              onSelect(key.data);
            }}
          >
            <option value="" disabled>
              Select identity…
            </option>
            {DemoUserKey.options.map((key) => (
              <option key={key} value={key}>
                {DEMO_USERS[key].displayName}
              </option>
            ))}
          </Select>
        </label>
        <div className="identity-actor">
          {busy ? <span className="muted">Signing in…</span> : null}
          {!busy && actor ? (
            <>
              <strong data-testid="actor-name">{actor.displayName}</strong>
              <span className="muted">({actor.id})</span>
              <ChipGroup data-testid="permission-chips">
                {actor.permissions.map((p) => (
                  <PermissionChip key={p} permission={p} />
                ))}
              </ChipGroup>
            </>
          ) : null}
          {!busy && !actor ? <span className="muted">No session — pick an identity to begin</span> : null}
        </div>
      </div>
      {error ? <ErrorBox error={error} prefix="Sign-in failed:" /> : null}
    </header>
  );
}
