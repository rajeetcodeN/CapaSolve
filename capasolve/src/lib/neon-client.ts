import { sql } from "./neon";
import { neonAuth } from "./neon-auth";
import { uploadAsset, getAsset, deleteAsset, listAssets, BUCKET_NAME } from "./storage";

/**
 * CapaSolve Neon Client & Compatibility Layer
 * Native query interface for Neon Lakebase Postgres, Neon Auth, and Neon S3 Object Storage.
 */

export class NeonQueryBuilder {
  private table: string;
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private selectCols: string = "*";
  private payload: any = null;
  private conditions: Array<{ col: string; val: any }> = [];
  private orderCol?: string;
  private orderAsc: boolean = true;
  private limitNum?: number;

  constructor(table: string) {
    this.table = table;
  }

  select(cols: string = "*") {
    this.action = "select";
    this.selectCols = cols;
    return this;
  }

  insert(data: any) {
    this.action = "insert";
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.action = "update";
    this.payload = data;
    return this;
  }

  upsert(data: any, _options?: any) {
    this.action = "upsert";
    this.payload = data;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(col: string, val: any) {
    this.conditions.push({ col, val });
    return this;
  }

  order(col: string, options: { ascending?: boolean } = {}) {
    this.orderCol = col;
    this.orderAsc = options.ascending ?? true;
    return this;
  }

  limit(num: number) {
    this.limitNum = num;
    return this;
  }

  private buildWhereClause(): { whereStr: string; values: any[] } {
    if (this.conditions.length === 0) return { whereStr: "", values: [] };
    const clauses = this.conditions.map((c, i) => `"${c.col}" = $${i + 1}`);
    return {
      whereStr: `WHERE ${clauses.join(" AND ")}`,
      values: this.conditions.map((c) => c.val),
    };
  }

  async execute(): Promise<{ data: any; error: any }> {
    try {
      const sqlDriver = sql as any;

      if (this.action === "select") {
        const { whereStr, values } = this.buildWhereClause();
        let queryStr = `SELECT * FROM public."${this.table}" ${whereStr}`;
        if (this.orderCol) {
          queryStr += ` ORDER BY "${this.orderCol}" ${this.orderAsc ? "ASC" : "DESC"}`;
        }
        if (this.limitNum) {
          queryStr += ` LIMIT ${this.limitNum}`;
        }
        const rows = await sqlDriver.query(queryStr, values);
        return { data: rows, error: null };
      }

      if (this.action === "insert") {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        if (items.length === 0) return { data: [], error: null };

        const insertedRows: any[] = [];
        for (const item of items) {
          const keys = Object.keys(item);
          const cols = keys.map((k) => `"${k}"`).join(", ");
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
          const vals = keys.map((k) => (typeof item[k] === "object" && item[k] !== null ? JSON.stringify(item[k]) : item[k]));

          const q = `INSERT INTO public."${this.table}" (${cols}) VALUES (${placeholders}) RETURNING *;`;
          const res = await sqlDriver.query(q, vals);
          if (res.length) insertedRows.push(res[0]);
        }
        return { data: Array.isArray(this.payload) ? insertedRows : insertedRows[0] || null, error: null };
      }

      if (this.action === "upsert") {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        if (items.length === 0) return { data: [], error: null };

        const insertedRows: any[] = [];
        for (const item of items) {
          const keys = Object.keys(item);
          const cols = keys.map((k) => `"${k}"`).join(", ");
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
          const updates = keys.map((k) => `"${k}" = EXCLUDED."${k}"`).join(", ");
          const vals = keys.map((k) => (typeof item[k] === "object" && item[k] !== null ? JSON.stringify(item[k]) : item[k]));

          const q = `INSERT INTO public."${this.table}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO UPDATE SET ${updates} RETURNING *;`;
          try {
            const res = await sqlDriver.query(q, vals);
            if (res.length) insertedRows.push(res[0]);
          } catch {
            const res = await sqlDriver.query(`INSERT INTO public."${this.table}" (${cols}) VALUES (${placeholders}) RETURNING *;`, vals);
            if (res.length) insertedRows.push(res[0]);
          }
        }
        return { data: Array.isArray(this.payload) ? insertedRows : insertedRows[0] || null, error: null };
      }

      if (this.action === "update") {
        const keys = Object.keys(this.payload);
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
        const vals = keys.map((k) => (typeof this.payload[k] === "object" && this.payload[k] !== null ? JSON.stringify(this.payload[k]) : this.payload[k]));

        const condOffset = keys.length;
        const condClauses = this.conditions.map((c, i) => `"${c.col}" = $${condOffset + i + 1}`).join(" AND ");
        const whereStr = condClauses ? `WHERE ${condClauses}` : "";
        const allVals = [...vals, ...this.conditions.map((c) => c.val)];

        const q = `UPDATE public."${this.table}" SET ${setClauses} ${whereStr} RETURNING *;`;
        const rows = await sqlDriver.query(q, allVals);
        return { data: rows, error: null };
      }

      if (this.action === "delete") {
        const { whereStr, values } = this.buildWhereClause();
        const q = `DELETE FROM public."${this.table}" ${whereStr} RETURNING *;`;
        const rows = await sqlDriver.query(q, values);
        return { data: rows, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.warn(`[NeonClient] Query failed on ${this.table}:`, err.message);
      return { data: null, error: err };
    }
  }

  async single() {
    const res = await this.execute();
    return {
      data: Array.isArray(res.data) ? res.data[0] || null : res.data,
      error: res.error,
    };
  }

  async maybeSingle() {
    return this.single();
  }

  // Promise-like interface
  then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    return this.execute().then(resolve, reject);
  }
}

/**
 * Neon S3 Storage Client
 */
export const storageClient = {
  from(_bucket: string = BUCKET_NAME) {
    return {
      async upload(path: string, fileBody: any, options: { contentType?: string } = {}) {
        try {
          await uploadAsset(path, fileBody, options.contentType);
          return { data: { path }, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
      async download(path: string) {
        try {
          const content = await getAsset(path);
          return { data: content, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
      async remove(paths: string[]) {
        try {
          for (const p of paths) {
            await deleteAsset(p);
          }
          return { data: paths, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
      async list(prefix?: string) {
        try {
          const items = await listAssets(prefix);
          return { data: items, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
    };
  },
};

/**
 * Main Neon Client Facade
 */
export const neonClient = {
  from(table: string) {
    return new NeonQueryBuilder(table);
  },

  storage: storageClient,

  auth: {
    async getSession() {
      return await neonAuth.getSession();
    },

    async getUser(_token?: string) {
      const res = await neonAuth.getSession();
      return {
        data: { user: res.data.session?.user || null },
        error: res.error,
      };
    },

    async signInWithPassword({ email, password }: { email: string; password?: string }) {
      return await neonAuth.signIn(email, password);
    },

    async signUp({ email, password, options }: { email: string; password?: string; options?: any }) {
      return await neonAuth.signUp(email, password || "", options?.data || {});
    },

    async signOut() {
      return await neonAuth.signOut();
    },

    async resend({ email }: { type?: string; email: string }) {
      console.log("[Neon Auth] Verification email requested for:", email);
      return { error: null };
    },

    async updateUser(updates: any) {
      const session = await neonAuth.getSession();
      if (session.data.session?.user) {
        await sql`
          UPDATE auth.users
          SET raw_user_meta_data = ${JSON.stringify(updates.data || {})}, updated_at = timezone('utc'::text, now())
          WHERE id = ${session.data.session.user.id};
        `;
      }
      return { data: { user: session.data.session?.user }, error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      if (typeof window !== "undefined") {
        const handler = (e: StorageEvent) => {
          if (e.key === "capasolve_neon_session") {
            neonAuth.getSession().then(({ data }) => {
              callback(data.session ? "SIGNED_IN" : "SIGNED_OUT", data.session);
            });
          }
        };
        window.addEventListener("storage", handler);
        return {
          data: {
            subscription: {
              unsubscribe: () => window.removeEventListener("storage", handler),
            },
          },
        };
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },
  },

  channel(_name: string) {
    return {
      on(_type: string, _filter: any, _callback: (payload: any) => void) {
        return this;
      },
      subscribe(callback?: (status: string) => void) {
        if (callback) {
          callback("SUBSCRIBED");
        }
        return this;
      },
    };
  },

  removeChannel(_channel: any) {},
};

// Compatibility alias
export const supabase = neonClient;
