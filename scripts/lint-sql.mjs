/**
 * Parses every .sql file under supabase/ with Postgres's own grammar.
 *
 * pg-query-emscripten is the real PostgreSQL parser compiled to WebAssembly, so
 * this catches exactly the syntax errors the server would — unbalanced quotes,
 * malformed literals, bad DDL — without needing a database or Docker.
 *
 * It validates syntax only. Missing tables, wrong column names, and broken
 * references still need a real database to catch.
 *
 *   npm run db:lint
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import PgQueryModule from 'pg-query-emscripten';

// fileURLToPath, not URL#pathname: the project lives under a directory with
// spaces in it, and pathname leaves them percent-encoded.
const root = fileURLToPath(new URL('..', import.meta.url));

function sqlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sqlFiles(full));
    else if (entry.endsWith('.sql')) out.push(full);
  }
  return out.sort();
}

/**
 * Split on statement-terminating semicolons, ignoring those inside single
 * quotes, double quotes, dollar-quoted bodies, and comments. Needed because the
 * WASM parser runs out of memory on a whole-file parse of the generated seed,
 * whose venue INSERT is a single multi-hundred-kilobyte statement.
 */
function splitStatements(sql) {
  const statements = [];
  let start = 0;
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];

    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i += 1;
      while (i < n) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) i += 2; // escaped by doubling
          else { i += 1; break; }
        } else i += 1;
      }
      continue;
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i));
      if (tag) {
        const close = sql.indexOf(tag[0], i + tag[0].length);
        i = close === -1 ? n : close + tag[0].length;
        continue;
      }
    }
    if (ch === ';') {
      const piece = sql.slice(start, i + 1).trim();
      if (piece) statements.push({ sql: piece, line: sql.slice(0, start).split('\n').length });
      start = i + 1;
      i += 1;
      continue;
    }
    i += 1;
  }

  const tail = sql.slice(start).trim();
  if (tail) statements.push({ sql: tail, line: sql.slice(0, start).split('\n').length });
  return statements;
}

let pg = await new PgQueryModule();

/**
 * Parse one chunk, turning a parser crash into a reportable failure.
 *
 * A crash leaves the WASM heap corrupted, so every later call fails too —
 * including trivial ones. Rebuild the module after any crash so the next
 * statement gets a clean parser and the failure report stays truthful.
 */
async function tryParse(text) {
  try {
    const result = pg.parse(text);
    if (result.error) return { ok: false, message: result.error.message, cursor: result.error.cursorpos };
    return { ok: true, count: result.parse_tree?.stmts?.length ?? 0 };
  } catch (err) {
    pg = await new PgQueryModule();
    return { ok: false, message: `parser crashed: ${err.message}`, crash: true };
  }
}

const files = sqlFiles(join(root, 'supabase'));
let failed = 0;

for (const file of files) {
  const sql = readFileSync(file, 'utf8');
  const rel = file.slice(root.length).replace(/\\/g, '/');

  // Whole-file parse first; fall back to per-statement when the parser chokes
  // on size, which keeps the reporting precise either way.
  const whole = await tryParse(sql);
  if (whole.ok) {
    console.log(`ok   ${rel}  (${whole.count} statements)`);
    continue;
  }

  const statements = splitStatements(sql);
  let bad = 0;
  for (const stmt of statements) {
    // Fresh module per statement. The WASM heap does not shrink between parses,
    // so reusing one instance across a file of large INSERTs lowers the
    // effective size ceiling until an otherwise-fine statement fails.
    pg = await new PgQueryModule();
    const one = await tryParse(stmt.sql);
    if (!one.ok) {
      bad += 1;
      failed += 1;
      console.error(`FAIL ${rel}:${stmt.line}  ${one.message}`);
      console.error(`     ${stmt.sql.slice(0, 140).replace(/\s+/g, ' ')}…`);
    }
  }
  if (bad === 0) {
    console.log(
      `ok   ${rel}  (${statements.length} statements, parsed individually — ` +
        `whole-file parse exceeded the WASM parser's limits)`,
    );
  }
}

if (failed) {
  console.error(`\n${failed} statement(s) failed to parse.`);
  process.exit(1);
}
console.log(`\nAll ${files.length} file(s) parsed cleanly.`);
