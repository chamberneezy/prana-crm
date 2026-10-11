import type { Database, SqlValue } from 'sql.js';

/**
 * The part of the D1 binding the API uses, on top of sql.js (SQLite compiled to WebAssembly).
 * It lets the unchanged Worker code run inside a browser for the public demo.
 * D1 is SQLite too, so the SQL, the constraints and the error messages are the same.
 */

type Param = string | number | boolean | null | undefined | Uint8Array;

const READ_ONLY = /^\s*(select|pragma|explain)\b/i;

class Statement {
  constructor(
    private readonly db: Database,
    private readonly sql: string,
    private readonly onWrite: () => void,
    private readonly params: Param[] = [],
  ) {}

  bind(...params: Param[]): Statement {
    return new Statement(this.db, this.sql, this.onWrite, params);
  }

  /** Runs the statement and returns its rows as arrays, with the column names. */
  execute(): { columns: string[]; rows: SqlValue[][] } {
    const statement = this.db.prepare(this.sql);
    try {
      statement.bind(this.params.map((p) => (typeof p === 'boolean' ? Number(p) : (p ?? null))));
      const rows: SqlValue[][] = [];
      while (statement.step()) rows.push(statement.get());
      return { columns: statement.getColumnNames(), rows };
    } finally {
      statement.free();
      if (!READ_ONLY.test(this.sql)) this.onWrite();
    }
  }

  /** The D1 result shape, built without yielding: see `batch`. */
  result() {
    const { columns, rows } = this.execute();
    return { results: rows.map((row) => Object.fromEntries(columns.map((name, i) => [name, row[i]]))), success: true, meta: { changes: this.db.getRowsModified() } };
  }

  async all() {
    return this.result();
  }

  async run() {
    return this.all();
  }

  async raw() {
    return this.execute().rows;
  }

  async first(column?: string) {
    const [row] = (await this.all()).results;
    if (!row) return null;
    return column ? (row[column] ?? null) : row;
  }
}

/** A D1-shaped database over sql.js. `onWrite` is called after every statement that may have changed data. */
export function createD1(db: Database, onWrite: () => void): D1Database {
  const binding = {
    prepare: (sql: string) => new Statement(db, sql, onWrite),
    // D1 runs a batch as one transaction: all of it or none of it.
    // Nothing is awaited between BEGIN and COMMIT, so no other request (or a save of the
    // database to storage) can run in the middle of the transaction.
    async batch(statements: Statement[]) {
      db.run('BEGIN');
      try {
        const results = statements.map((statement) => statement.result());
        db.run('COMMIT');
        return results;
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      onWrite();
      return { count: 0, duration: 0 };
    },
  };
  return binding as unknown as D1Database;
}
