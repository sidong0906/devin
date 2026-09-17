"""Generates docs/diagrams/system-design.excalidraw (+ .svg preview) from one layout description."""
import json, random, html
from pathlib import Path

OUT = Path(__file__).resolve().parent

random.seed(7)
E = []  # excalidraw elements
NODES = {}  # id -> dict(x,y,w,h,...) for arrows + svg

FONT = 2  # 1 = hand-drawn Virgil, 2 = Helvetica (tighter, matches the SVG preview metrics)
def nonce(): return random.randint(1, 2**31 - 1)

def base(kind, id, x, y, w, h, **kw):
    d = dict(type=kind, id=id, x=x, y=y, width=w, height=h, angle=0,
             strokeColor="#1e1e1e", backgroundColor="transparent", fillStyle="solid",
             strokeWidth=1, strokeStyle="solid", roughness=1, opacity=100, groupIds=[], frameId=None,
             roundness={"type": 3} if kind == "rectangle" else None, seed=nonce(), version=1,
             versionNonce=nonce(), isDeleted=False, boundElements=[], updated=1, link=None, locked=False)
    d.update(kw); return d

def text_el(id, x, y, w, h, text, size=16, color="#1e1e1e", align="center", valign="middle", container=None, bold=False):
    lines = text.count("\n") + 1
    return base("text", id, x, y, w, h, text=text, originalText=text, fontSize=size, fontFamily=FONT,
                textAlign=align, verticalAlign=valign, containerId=container, lineHeight=1.25,
                strokeColor=color, autoResize=False, roundness=None)

def box(id, x, y, w, h, label, fill="transparent", stroke="#1e1e1e", size=16, dashed=False, color="#1e1e1e",
        label_top=False, strokeWidth=1):
    r = base("rectangle", id, x, y, w, h, backgroundColor=fill, strokeColor=stroke,
             strokeStyle="dashed" if dashed else "solid", strokeWidth=strokeWidth)
    tid = id + "_t"
    if label_top:
        t = text_el(tid, x + 12, y + 8, w - 24, size * 1.25 * (label.count("\n") + 1), label, size, color, align="left", valign="top")
    else:
        t = text_el(tid, x + 8, y + 8, w - 16, h - 16, label, size, color, container=id)
        r["boundElements"].append({"id": tid, "type": "text"})
    E.extend([r, t])
    NODES[id] = dict(x=x, y=y, w=w, h=h, label=label, fill=fill, stroke=stroke, dashed=dashed, size=size, color=color, label_top=label_top, sw=strokeWidth)
    return id

def arrow(id, a, b, label=None, dashed=False, side=("bottom", "top"), color="#1e1e1e", via=()):
    A, B = NODES[a], NODES[b]
    def pt(n, s):
        cx, cy = n["x"] + n["w"] / 2, n["y"] + n["h"] / 2
        return {"top": (cx, n["y"]), "bottom": (cx, n["y"] + n["h"]), "left": (n["x"], cy), "right": (n["x"] + n["w"], cy)}[s]
    (x1, y1), (x2, y2) = pt(A, side[0]), pt(B, side[1])
    pts = [[0, 0]] + [[vx - x1, vy - y1] for vx, vy in via] + [[x2 - x1, y2 - y1]]
    ar = base("arrow", id, x1, y1, x2 - x1, y2 - y1, points=pts, roundness=None if via else {"type": 2},
              strokeStyle="dashed" if dashed else "solid", strokeColor=color, strokeWidth=1 if dashed else 2,
              startBinding={"elementId": a, "focus": 0, "gap": 1}, endBinding={"elementId": b, "focus": 0, "gap": 1},
              startArrowhead=None, endArrowhead="arrow", lastCommittedPoint=None, elbowed=False)
    for n in (a, b):
        for el in E:
            if el["id"] == n: el["boundElements"].append({"id": id, "type": "arrow"})
    E.append(ar)
    lab = None
    if label:
        tid = id + "_t"
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        w = 9 * max(len(l) for l in label.split("\n")) + 16
        h = 20 * (label.count("\n") + 1)
        t = text_el(tid, mx - w / 2, my - h / 2, w, h, label, 13, color, container=id)
        ar["boundElements"].append({"id": tid, "type": "text"}); E.append(t)
        lab = (mx, my, label, w, h)
    ARROWS.append(dict(pts=[(x1, y1)] + list(via) + [(x2, y2)], dashed=dashed, color=color, label=lab))

ARROWS = []

# ---------- palette (Excalidraw defaults) ----------
BLUE, BLUE_F = "#1971c2", "#a5d8ff"
TEAL, TEAL_F = "#0c8599", "#99e9f2"
VIOLET, VIOLET_F = "#6741d9", "#d0bfff"
AMBER, AMBER_F = "#e8590c", "#ffd8a8"
GREEN, GREEN_F = "#2f9e44", "#b2f2bb"
GREY, GREY_F = "#495057", "#e9ecef"
RED = "#c92a2a"

# ---------- title ----------
E.append(text_el("title", 40, 20, 900, 40, "Governed internal-tools platform — system design (as built)", 28, align="left", valign="top"))
E.append(text_el("subtitle", 40, 62, 1200, 24, "Solid = in the tree and covered by tests/contracts.  Dashed = planned or scoped, not built.  One request lifecycle: request → independent approval → execution → audit.", 14, GREY, align="left", valign="top"))

# ---------- Browser ----------
box("browser", 40, 110, 1180, 190, "Browser — web/ (React 19 + Vite)", GREY_F, GREY, 18, label_top=True)
box("ui_pkg", 60, 150, 300, 130, "packages/ui  (@tools/ui)\nRadix Themes + Radix Icons + Recharts\n5 semantic tones · KPI tiles · charts\nonly layer that imports the library", BLUE_F, BLUE, 13)
box("shell", 380, 150, 380, 130, "web/src/platform  (shared shell)\nIdentity bar · Overview (tool filter)\nApprovals queue · Request detail\nAudit timeline", BLUE_F, BLUE, 13)
box("web_ref", 780, 150, 200, 130, "web/src/apps/refunds\nPayments · request refund\npayload fields", TEAL_F, TEAL, 13)
box("web_flg", 1000, 150, 200, 130, "web/src/apps/flags\nFlags · propose change\npayload fields", VIOLET_F, VIOLET, 13)

# ---------- API trust boundary ----------
box("api", 40, 370, 1180, 330, "Trust boundary — services/api (Fastify 5)", GREY_F, GREY, 18, label_top=True)
box("identity", 60, 410, 260, 110, "Identity resolver\nsynthetic identities, HttpOnly cookie\nprod boot guard (NODE_ENV=production)\nsame-origin check", BLUE_F, BLUE, 13)
box("dispatch", 350, 410, 240, 110, "Action dispatcher\ndeny by default\none permission per action\nunknown action → 403", BLUE_F, BLUE, 13)
box("manifest", 620, 410, 200, 110, "packages/app-manifest\nAPPS[]: register · routes\nseed · demoReset · executor", BLUE_F, BLUE, 13)
box("app_ref", 850, 410, 170, 110, "apps/refunds/server\nrefunds.request\nreview policy\nrefund executor", TEAL_F, TEAL, 13)
box("app_flg", 1040, 410, 160, 110, "apps/flags/server\nflags.propose\nreview policy\npublish in approval", VIOLET_F, VIOLET, 13)
box("core", 60, 550, 1140, 130, "packages/server-core  +  packages/contracts   (platform controls, specified and reviewed by a human, written by Devin)\n"
    "decideRequest: maker-checker — requester ≠ approver checked before role · one transaction: decision + audit event + execution job\n"
    "writeAudit: append-only against application code · maskPii in DTOs and audit summaries · stable idempotency key per request · frozen DTOs (Zod 4)", BLUE_F, BLUE, 13, strokeWidth=2)

# ---------- Postgres ----------
box("pg", 40, 770, 760, 190, "PostgreSQL 16 — app role tools_app; schema owned by tools_migrator", GREY_F, GREY, 16, label_top=True)
box("t_req", 60, 810, 170, 120, "approval_requests\npayload immutable\n(no UPDATE of payload)", AMBER_F, AMBER, 13)
box("t_aud", 250, 810, 170, 120, "audit_events\nINSERT only for tools_app\nno UPDATE / DELETE", AMBER_F, AMBER, 13)
box("t_flg", 440, 810, 160, 120, "feature_flags\nversion column\noptimistic check\nstale version → 409", AMBER_F, AMBER, 13)
box("t_job", 620, 810, 160, 120, "execution_jobs\nunique per request\nlease · attempts\nretry_wait", AMBER_F, AMBER, 13)

# ---------- Side-effect boundary ----------
box("side", 860, 770, 430, 190, "External side-effect boundary", GREY_F, GREY, 16, label_top=True)
box("worker", 880, 810, 185, 120, "services/worker\nlease job → app executor\nfor job.kind → outcome\nHTTP + Idempotency-Key, retry", GREEN_F, GREEN, 13)
box("sim", 1105, 810, 165, 120, "services/payment-simulator\nseparate process\ncan drop responses\nSUCCEEDED / NEEDS_REVIEW", GREEN_F, GREEN, 13)

# ---------- Planned / not built ----------
box("idp", 1310, 410, 230, 80, "Company IdP (OIDC)\nreplaces the identity resolver\nplanned, not built", "transparent", GREY, 13, dashed=True, color=GREY)
box("kyc", 1310, 550, 230, 100, "apps/kyc — case aggregate,\nassignment, SLAs, vendor webhooks\nregisters via app-manifest\nscoped (docs/KYC_SCOPE.md), not built", "transparent", GREY, 13, dashed=True, color=GREY)
box("psp", 1310, 830, 230, 80, "Real PSP + reconciliation\nreplaces the payment simulator\nplanned, not built", "transparent", GREY, 13, dashed=True, color=GREY)

# ---------- Arrows ----------
arrow("a1", "shell", "identity", "same-origin HTTP\nHttpOnly cookie", side=("bottom", "top"))
arrow("a1b", "web_ref", "app_ref", "POST /api/refunds/…", side=("bottom", "top"), color=TEAL)
arrow("a1c", "web_flg", "app_flg", "POST /api/flags/…", side=("bottom", "top"), color=VIOLET)
arrow("a2", "identity", "dispatch", side=("right", "left"))
arrow("a3", "dispatch", "manifest", side=("right", "left"))
arrow("a4", "manifest", "app_ref", side=("right", "left"))
arrow("a5", "manifest", "app_flg", side=("bottom", "bottom"), via=[(720, 535), (1120, 535)])
arrow("a6", "dispatch", "core", "decideRequest · writeAudit", side=("bottom", "top"))
arrow("a7", "app_ref", "core", side=("bottom", "top"), color=TEAL)
arrow("a8", "app_flg", "core", side=("bottom", "top"), color=VIOLET)
arrow("a9", "core", "t_req", side=("bottom", "top"))
arrow("a10", "core", "t_aud", side=("bottom", "top"))
arrow("a11", "core", "t_job", side=("bottom", "top"))
arrow("a12", "core", "t_flg", "publish in tx", side=("bottom", "top"), color=VIOLET)
arrow("a13", "t_job", "worker", "lease", side=("right", "left"), color=GREEN)
arrow("a14", "worker", "sim", side=("right", "left"), color=GREEN)
arrow("a16", "psp", "sim", dashed=True, side=("left", "right"), color=GREY)

# ---------- Lifecycle strip ----------
box("life", 40, 1000, 1180, 110, "Request lifecycle (every write in every tool)", GREY_F, GREY, 16, label_top=True)
steps = [("l1", "1. Request\nmaker (e.g. Ana Agent)\npermission refunds.request", TEAL_F, TEAL),
         ("l2", "2. Independent approval\nchecker ≠ maker, server-enforced (403)\npermission refunds.review", BLUE_F, BLUE),
         ("l3", "3. Execution\nworker job (refunds) or in-tx publish (flags)\nexactly-once via idempotency key", GREEN_F, GREEN),
         ("l4", "4. Audit\nappend-only event per step, PII masked\nvisible to approvals.read", AMBER_F, AMBER)]
x = 60
for id, lbl, f, s in steps:
    box(id, x, 1040, 270, 60, lbl, f, s, 12); x += 290
arrow("la1", "l1", "l2", side=("right", "left")); arrow("la2", "l2", "l3", side=("right", "left")); arrow("la3", "l3", "l4", side=("right", "left"))

# ---------- Legend ----------
E.append(text_el("legend", 1310, 1000, 240, 110,
                 "Colour key\nblue  platform layer (built once)\nteal  refunds app   violet  feature-flags app\namber  PostgreSQL   green  worker / side effects\ngrey dashed  planned, not built", 12, GREY, align="left", valign="top"))

doc = {"type": "excalidraw", "version": 2, "source": "https://github.com/sidong0906/devin", "elements": E,
       "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"}, "files": {}}
with open(OUT / "system-design.excalidraw", "w") as f:
    json.dump(doc, f, indent=1)

# ---------- SVG preview (same geometry) ----------
W, H = 1580, 1140
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">',
       f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
       '<defs><marker id="m" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>']
def svg_text(x, y, w, text, size, color, anchor="middle", weight="normal"):
    lines = text.split("\n"); lh = size * 1.3
    for i, l in enumerate(lines):
        out.append(f'<text x="{x}" y="{y + i * lh}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}">{html.escape(l)}</text>')
for id, n in NODES.items():
    dash = ' stroke-dasharray="6 4"' if n["dashed"] else ""
    out.append(f'<rect x="{n["x"]}" y="{n["y"]}" width="{n["w"]}" height="{n["h"]}" rx="8" fill="{n["fill"]}" stroke="{n["stroke"]}" stroke-width="{n["sw"]}"{dash}/>')
    lines = n["label"].count("\n") + 1; lh = n["size"] * 1.3
    if n["label_top"]:
        svg_text(n["x"] + 12, n["y"] + 8 + n["size"], n["w"], n["label"], n["size"], n["color"], "start", "bold")
    else:
        y0 = n["y"] + n["h"] / 2 - (lines - 1) * lh / 2 + n["size"] * 0.35
        svg_text(n["x"] + n["w"] / 2, y0, n["w"], n["label"], n["size"], n["color"])
for a in ARROWS:
    dash = ' stroke-dasharray="6 4"' if a["dashed"] else ""
    pts = " ".join(f"{x},{y}" for x, y in a["pts"])
    out.append(f'<polyline points="{pts}" fill="none" stroke="{a["color"]}" stroke-width="{1.5 if a["dashed"] else 2}" marker-end="url(#m)"{dash}/>')
    if a["label"]:
        mx, my, lbl, w, h = a["label"]
        out.append(f'<rect x="{mx - w/2}" y="{my - h/2}" width="{w}" height="{h}" fill="#ffffff" opacity="0.9"/>')
        svg_text(mx, my - (lbl.count("\n")) * 8 + 5, w, lbl, 12, a["color"])
for el in E:
    if el["type"] == "text" and el.get("containerId") is None and el["id"] in ("title", "subtitle", "legend"):
        svg_text(el["x"], el["y"] + el["fontSize"], el["width"], el["text"], el["fontSize"], el["strokeColor"], "start", "bold" if el["id"] == "title" else "normal")
out.append("</svg>")
with open(OUT / "system-design.svg", "w") as f:
    f.write("\n".join(out))
print(len(E), "elements")
