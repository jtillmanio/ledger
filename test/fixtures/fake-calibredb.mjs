// A stand-in for Calibre's calibredb, for test/calibre-sync-command.test.ts
// (task 4.4, TASK-082): the real one is never run in a test. It takes what the
// sync sends,
//   set_metadata (--library-path <folder> | --with-library <url>) <id> --field "#col:value" ...
// appends the call to FAKE_CALIBREDB_LOG (one JSON line), and writes each field
// into the fixture's metadata.db as Calibre stores it: a bool or datetime row
// per book (datetime as UTC text), text through the value and link tables. A
// --with-library URL (the content server) writes the folder in
// FAKE_CALIBRE_LIBRARY. FAKE_CALIBREDB_FAIL=1 exits 1 having written nothing.
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const args = process.argv.slice(2);
if (process.env.FAKE_CALIBREDB_LOG) appendFileSync(process.env.FAKE_CALIBREDB_LOG, JSON.stringify(args) + "\n");
if (process.env.FAKE_CALIBREDB_FAIL === "1") {
  console.error("fake calibredb: told to fail");
  process.exit(1);
}

const [command, ...rest] = args;
if (command !== "set_metadata") {
  console.error(`fake calibredb: no command ${command}`);
  process.exit(2);
}
let folder = null;
let id = null;
const fields = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === "--library-path") folder = rest[++i];
  else if (a === "--with-library") {
    const lib = rest[++i];
    folder = /^https?:/.test(lib) ? process.env.FAKE_CALIBRE_LIBRARY : lib;
  } else if (a === "--field") fields.push(rest[++i]);
  else id = Number(a);
}
if (!folder || !Number.isInteger(id)) {
  console.error("fake calibredb: set_metadata needs a library and a book id");
  process.exit(2);
}

const db = new DatabaseSync(join(folder, "metadata.db"));
for (const f of fields) {
  const at = f.indexOf(":");
  const label = f.slice(0, at).replace(/^#/, "");
  const value = f.slice(at + 1);
  const col = db.prepare("SELECT id, datatype, normalized, is_multiple FROM custom_columns WHERE label = ?").get(label);
  if (!col) {
    console.error(`fake calibredb: no column #${label}`);
    process.exit(1);
  }
  const n = col.id;
  if (col.normalized) {
    db.prepare(`DELETE FROM books_custom_column_${n}_link WHERE book = ?`).run(id);
    const values = col.is_multiple ? value.split(",").map((s) => s.trim()).filter(Boolean) : value ? [value] : [];
    for (const v of values) {
      db.prepare(`INSERT OR IGNORE INTO custom_column_${n} (value) VALUES (?)`).run(v);
      const { id: vid } = db.prepare(`SELECT id FROM custom_column_${n} WHERE value = ?`).get(v);
      db.prepare(`INSERT INTO books_custom_column_${n}_link (book, value) VALUES (?, ?)`).run(id, vid);
    }
  } else {
    db.prepare(`DELETE FROM custom_column_${n} WHERE book = ?`).run(id);
    if (value === "") continue;
    let stored = value;
    if (col.datatype === "bool") stored = /^(true|yes|1)$/i.test(value) ? 1 : 0;
    if (col.datatype === "datetime") stored = new Date(value).toISOString().replace("T", " ").replace(/\.\d+Z$/, "+00:00");
    db.prepare(`INSERT INTO custom_column_${n} (book, value) VALUES (?, ?)`).run(id, stored);
  }
}
db.close();
