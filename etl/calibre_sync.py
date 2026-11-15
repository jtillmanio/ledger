#!/usr/bin/env python3
"""
calibre_sync.py — the Calibre sync, both ways: `npm run calibre:sync` (task 4.4, D-133).

    npm run calibre:sync                 # the app in CALIBRE_SYNC_URL, the library in CALIBRE_LIBRARY
    py etl/calibre_sync.py --env <file>  # settings from another env file

One run, on the owner's PC, by hand (a desktop shortcut) or once a week (Task
Scheduler; scripts/calibre-sync-schedule.ps1):

1. Reads a temp copy of the library's metadata.db (calibre.py's reading; the
   library's own file is only copied, never opened).
2. Signs in to the app with the passcode, as a browser does, and sends every
   Calibre book to `POST /api/calibre/sync` (task 4.4 part 1). The app applies
   only what changed (Calibre wins on a book's data, D-87), logs the run, and
   answers what the Ledger holds for each Calibre book and what differs.
3. Writes what differs into Calibre with `calibredb set_metadata`: through
   Calibre's content server while it answers on CALIBRE_SERVER_URL (the Calibre
   window is open), otherwise against the library folder. `#read`, the
   date-read column (`--date-column`), `#ledger_status` and `#owned` (5.17's
   formats). A column the library lacks is named and skipped. Until the books
   cutover (1.26) the Ledger's reads are not written (`CALIBRE_SYNC_READS`
   off): extract still loads Calibre's reads (D-87), and a read the Ledger
   lacks would clear Calibre's.
4. Asks the app to backfill Hardcover for books with no Hardcover id, giving it
   Calibre's ISBNs (task 4.2, `POST /api/books/backfill`); its answer is
   printed, not part of the sync's log.

It talks to the app's URL, never to a database. It exits non-zero, having
written nothing to Calibre, when the app can't be reached, refuses the passcode
or the sync fails; and non-zero when a calibredb write fails.

Settings, from the environment or `--env` (default .env): CALIBRE_LIBRARY,
APP_PASSCODE, CALIBRE_SYNC_URL (default http://localhost:3000),
CALIBRE_SERVER_URL (default http://localhost:8080; a `#library_id` on it
overrides the folder's), CALIBREDB (default calibredb on PATH, else Calibre's
Windows install) and CALIBRE_SYNC_READS (`true` from the books cutover).
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, time as dtime
from http.cookies import SimpleCookie
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import calibre as cal  # noqa: E402
import enrich_books as eb  # noqa: E402

# The app's names for the write-back columns (src/db/calibre-sync.ts CALIBRE_COLUMNS).
COLUMNS = ("#read", "#date_read", "#ledger_status", "#owned")
READ_COLUMNS = ("#read", "#date_read")
DEFAULT_URL = "http://localhost:3000"
DEFAULT_SERVER = "http://localhost:8080"
WINDOWS_CALIBREDB = r"C:\Program Files\Calibre2\calibredb.exe"
SESSION_COOKIE = "rt_session"
TIMEOUT = 330           # seconds: the backfill route may run 300
MAX_BACKFILL_CALLS = 100


class Refused(Exception):
    """The run stops before writing anything to Calibre."""


# --------------------------------------------------------------------------
# the library
# --------------------------------------------------------------------------

def read_library(source: Path, columns: dict[str, str], lookups: dict[str, str]) -> tuple[list[dict], list[str]]:
    """(the app's records, the write-back columns the library lacks), from one
    temp copy of metadata.db. `lookups` maps the app's column name to the
    library's lookup name."""
    def read(db):
        labels = {r[0] for r in db.execute("SELECT label FROM custom_columns")}
        missing = [c for c in COLUMNS if lookups[c].lstrip("#") not in labels]
        rows = cal.records(db, columns)
        status = (cal.custom_column(db, lookups["#ledger_status"], required=False) or ({}, {}))[0] \
            if "#ledger_status" not in missing else {}
        owned = (cal.custom_column(db, lookups["#owned"], required=False) or ({}, {}))[0] \
            if "#owned" not in missing else {}
        return [record(r, status.get(r["calibre_id"]), owned.get(r["calibre_id"])) for r in rows], missing
    return cal.with_copy(source, read)


def number(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def record(r: dict, status, owned) -> dict:
    """One calibre.py record as the app's CalibreRecord."""
    if isinstance(owned, str):
        owned = [s.strip() for s in owned.split(",")]
    return {
        "calibreId": r["calibre_id"], "title": r["title"] or "", "authors": r["authors"],
        "series": r["series"], "seriesIndex": number(r["index"]) if r["series"] else None,
        "subseries": r["subseries"], "subseriesIndex": number(r["subseries_index"]),
        "superseries": r["superseries"], "superseriesIndex": number(r["superseries_index"]),
        "genres": r["genres"], "tags": r["tags"], "isbn": r["isbn"],
        "words": r["words"], "pages": r["pages"], "type": r["type"] or None,
        "read": {"true": True, "false": False}.get(r["read"]),
        "dateRead": r["date_read"] or None, "precision": r["precision"] if r["date_read"] else None,
        "ledgerStatus": (status or "").strip() or None,
        "owned": sorted(o for o in (owned or []) if o),
    }


# --------------------------------------------------------------------------
# the app
# --------------------------------------------------------------------------

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class App:
    def __init__(self, base: str, passcode: str):
        self.base = base.rstrip("/")
        self.passcode = passcode
        self.cookie = ""
        self.opener = urllib.request.build_opener(_NoRedirect)

    def _open(self, req: urllib.request.Request, timeout: float = TIMEOUT):
        try:
            return self.opener.open(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            return e
        except (urllib.error.URLError, OSError) as e:
            reason = getattr(e, "reason", e)
            raise Refused(f"the app at {self.base} can't be reached ({reason}): is it running, and is "
                          "CALIBRE_SYNC_URL right?") from None

    def sign_in(self) -> None:
        """The passcode form, as a browser posts it; keeps the session cookie."""
        if not self.passcode:
            raise Refused("APP_PASSCODE is not set: the app's passcode signs the sync in")
        body = urllib.parse.urlencode({"passcode": self.passcode, "next": "/"}).encode()
        res = self._open(urllib.request.Request(f"{self.base}/api/login", data=body, method="POST", headers={
            "content-type": "application/x-www-form-urlencoded"}))
        jar = SimpleCookie()
        for line in res.headers.get_all("Set-Cookie") or []:
            jar.load(line)
        if SESSION_COOKIE not in jar or not jar[SESSION_COOKIE].value:
            raise Refused(f"the app at {self.base} refused the passcode: APP_PASSCODE must be the app's passcode")
        self.cookie = f"{SESSION_COOKIE}={jar[SESSION_COOKIE].value}"

    def post(self, path: str, body: dict) -> tuple[int, dict]:
        req = urllib.request.Request(f"{self.base}{path}", data=json.dumps(body).encode(), method="POST",
                                     headers={"content-type": "application/json", "cookie": self.cookie})
        res = self._open(req)
        raw = res.read().decode("utf-8", errors="replace")
        try:
            return res.status, json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return res.status, {"error": raw[:200]}


# --------------------------------------------------------------------------
# writing into Calibre
# --------------------------------------------------------------------------

def server_answers(url: str) -> bool:
    """Calibre's content server is up (the Calibre window is open)."""
    try:
        urllib.request.urlopen(url.split("#")[0], timeout=2).close()
        return True
    except urllib.error.HTTPError:
        return True          # it answered, if only to ask for a login
    except (urllib.error.URLError, OSError, ValueError):
        return False


def library_id(folder: Path) -> str:
    """The content server's id for a library: its folder name, `_` for what
    isn't a letter or digit (`Calibre Library` -> `Calibre_Library`)."""
    return re.sub(r"\W", "_", folder.name)


def library_option(server: str, folder: Path) -> list[str]:
    """Through the content server while it answers, else the folder."""
    if server and server_answers(server):
        url = server if "#" in server else f"{server.rstrip('/')}/#{library_id(folder)}"
        return ["--with-library", url]
    return ["--library-path", str(folder)]


def calibredb_command(setting: str) -> list[str]:
    if setting:
        return [setting] if Path(setting).exists() else shlex.split(setting)
    found = shutil.which("calibredb")
    if found:
        return [found]
    return [WINDOWS_CALIBREDB if Path(WINDOWS_CALIBREDB).exists() else "calibredb"]


def field_value(column: str, value) -> str:
    """A value as `calibredb set_metadata --field` takes it; empty clears."""
    if column == "#read":
        return "true" if value else "false"
    if column == "#date_read":
        if not value:
            return ""
        # The stored day at noon Eastern: Calibre keeps UTC, and calibre.py reads the Eastern day back (D-67).
        return datetime.combine(date.fromisoformat(value), dtime(12), cal.EASTERN).isoformat()
    if column == "#owned":
        return ",".join(value or [])
    return value or ""


def write_back(out: list[dict], lookups: dict[str, str], command: list[str], where: list[str]) -> list[str]:
    """One `calibredb set_metadata` per book; the failures, as lines."""
    by_book: dict[int, list[dict]] = {}
    for w in out:
        by_book.setdefault(w["calibreId"], []).append(w)
    failed = []
    for cid, writes in by_book.items():
        args = [*command, "set_metadata", *where, str(cid)]
        for w in writes:
            args += ["--field", f"{lookups[w['column']]}:{field_value(w['column'], w['to'])}"]
        try:
            r = subprocess.run(args, capture_output=True, text=True)
        except OSError as e:
            failed.append(f"{writes[0]['title']}: calibredb couldn't start ({e}); set CALIBREDB to its path")
            continue
        if r.returncode != 0:
            failed.append(f"{writes[0]['title']}: calibredb exited {r.returncode}: {(r.stderr or r.stdout).strip()[:300]}")
    return failed


# --------------------------------------------------------------------------
# the run
# --------------------------------------------------------------------------

def is_isbn(v) -> bool:
    s = (v or "").strip().replace("-", "").upper()
    return bool(re.fullmatch(r"\d{13}|\d{9}[\dX]", s))


def show(value) -> str:
    if value is None or value == [] or value == "":
        return "(none)"
    return ", ".join(value) if isinstance(value, list) else str(value)


def report_lines(report: dict) -> list[str]:
    lines = []
    for c in report["in"]:
        what = "; ".join(f"{ch['field']} {show(ch['from'])} -> {show(ch['to'])}" for ch in c["changes"])
        lines.append(f"  in   {c['kind']}: {c['title']} ({what})")
    for w in report["out"]:
        lines.append(f"  out  {w['title']}: {w['column']} {show(w['from'])} -> {show(w['to'])}")
    for w in report["waiting"]:
        lines.append(f"  waits ({w['kind']}): {w['title']} / {w['bookTitle']}")
    for g in report["gone"]:
        lines.append(f"  gone from Calibre: {g['title']}")
    for s in report["skipped"]:
        lines.append(f"  skipped ({s['reason']}): {s['title']}")
    lines += [f"  note: {n}" for n in report["notes"]]
    return lines


def backfill(app: App, isbns: dict[str, str], sleep=time.sleep) -> int:
    """Hardcover for books with no id (task 4.2); 0 unless the app failed."""
    body: dict = {"dryRun": False, "isbns": isbns}
    for _ in range(MAX_BACKFILL_CALLS):
        code, res = app.post("/api/books/backfill", body)
        if code == 503:
            print(f"backfill: skipped: {res.get('error', 'Hardcover is not set up where the app runs')}")
            return 0
        if code != 200:
            print(f"backfill: the app answered {code}: {res.get('error', '')}", file=sys.stderr)
            return 1
        print(f"backfill: looked at {res.get('looked', 0)} books")
        nxt = res.get("next")
        if res.get("status") == "stopped":
            wait = int(res.get("retryIn") or 60)
            print(f"backfill: Hardcover asked to slow down; again in {wait}s")
            sleep(wait)
        elif not nxt:
            return 0
        body = {**body, "after": nxt}
    print(f"backfill: stopped after {MAX_BACKFILL_CALLS} calls; the next sync carries on")
    return 0


def run(args) -> int:
    eb.load_env(Path(args.env))
    env = os.environ
    folder = (args.library or env.get("CALIBRE_LIBRARY", "")).strip()
    if not folder:
        print("calibre:sync: no library: pass --library <folder>, or set CALIBRE_LIBRARY", file=sys.stderr)
        return 1
    source = Path(folder) / "metadata.db"
    if not source.exists():
        print(f"calibre:sync: {source} not found", file=sys.stderr)
        return 1
    reads = env.get("CALIBRE_SYNC_READS", "").strip().lower() in ("1", "true", "yes")
    lookups = {"#read": args.read_column, "#date_read": args.date_column,
               "#ledger_status": args.status_column, "#owned": args.owned_column}
    columns = {"words": args.words_column, "date": args.date_column, "read": args.read_column,
               "type": args.type_column, "superseries": args.superseries_column,
               "subseries": args.subseries_column, "pages": args.pages_column, "genre": args.genre_column}

    print(f"calibre:sync <- {Path(folder)} -> {env.get('CALIBRE_SYNC_URL') or DEFAULT_URL}")
    print("reading metadata.db (from a temp copy) …")
    records, missing = read_library(source, columns, lookups)
    print(f"  read {len(records)} books")
    for c in missing:
        print(f"  the library has no column {lookups[c]}: skipped (create it in Calibre to have it written)")
    skipped = list(missing)
    if not reads:
        held = [c for c in READ_COLUMNS if c not in skipped]
        if held:
            print(f"  {', '.join(lookups[c] for c in held)}: not written until the books cutover "
                  "(CALIBRE_SYNC_READS=true at 1.26)")
        skipped += held

    app = App(env.get("CALIBRE_SYNC_URL") or DEFAULT_URL, env.get("APP_PASSCODE", ""))
    try:
        app.sign_in()
        code, result = app.post("/api/calibre/sync", {
            "records": records, "calibreIds": [r["calibreId"] for r in records],
            "missingColumns": [c for c in COLUMNS if c in skipped]})
    except Refused as e:
        print(f"calibre:sync: {e}; nothing was written to Calibre", file=sys.stderr)
        return 1
    if code != 200:
        print(f"calibre:sync: the app answered {code}: {result.get('error', '')}; nothing was written to Calibre",
              file=sys.stderr)
        return 1

    report = result["report"]
    lines = report_lines(report)
    print(f"synced (log entry {result['id']}): {len(report['in'])} in, {len(report['out'])} out, "
          f"{len(report['waiting'])} waiting" + ("" if lines else "; nothing changed"))
    for line in lines:
        print(line)

    status = 0
    if report["out"]:
        where = library_option(env.get("CALIBRE_SERVER_URL", DEFAULT_SERVER).strip(), Path(folder))
        print(f"writing {len(report['out'])} values into Calibre "
              + ("through its content server" if where[0] == "--with-library" else "in the library folder") + " …")
        failed = write_back(report["out"], lookups, calibredb_command(env.get("CALIBREDB", "").strip()), where)
        for f in failed:
            print(f"  not written: {f}", file=sys.stderr)
        if failed:
            status = 1

    by_cid = {r["calibreId"]: r for r in records}
    isbns = {h["bookId"]: by_cid[h["calibreId"]]["isbn"].strip() for h in result["holdings"]
             if h["calibreId"] in by_cid and is_isbn(by_cid[h["calibreId"]]["isbn"])}
    if not args.no_backfill:
        status = backfill(app, isbns) or status
    return status


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--library", default=None, help="the Calibre library folder (else CALIBRE_LIBRARY)")
    ap.add_argument("--env", default=".env", help="the settings file (default .env)")
    ap.add_argument("--words-column", default="#words")
    ap.add_argument("--date-column", default="#date_read", help="the date-read column, read and written")
    ap.add_argument("--read-column", default="#read", help="the read flag, read and written")
    ap.add_argument("--status-column", default="#ledger_status", help="the Ledger's status, written")
    ap.add_argument("--owned-column", default="#owned", help="the owned formats, written")
    ap.add_argument("--type-column", default="#type")
    ap.add_argument("--superseries-column", default="#superseries")
    ap.add_argument("--subseries-column", default="#subseries")
    ap.add_argument("--pages-column", default="#pages")
    ap.add_argument("--genre-column", default="#genre")
    ap.add_argument("--no-backfill", action="store_true", help="skip the Hardcover backfill after the sync")
    args = ap.parse_args(argv)
    if isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout.reconfigure(errors="replace", line_buffering=True)
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
