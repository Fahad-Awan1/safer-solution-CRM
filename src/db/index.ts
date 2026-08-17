import dotenv from 'dotenv';
dotenv.config();

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const DEFAULT_NEON_URL = 'postgresql://neondb_owner:npg_m7kGWiOZUAw4@ep-dry-forest-ay3ln0tr.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';
const connStr = process.env.DATABASE_URL || DEFAULT_NEON_URL;

export const sql = neon(connStr);
export const db = drizzle(sql, { schema });

export const pool = {
  query: async (text: string, params?: any[]) => {
    try {
      const rows = params && params.length > 0 ? await (sql as any).query(text, params) : await (sql as any).query(text);
      return { rows: Array.isArray(rows) ? rows : [], rowCount: Array.isArray(rows) ? rows.length : 0 };
    } catch (e: any) {
      console.error('Database query error:', e);
      throw e;
    }
  },
  connect: async () => {
    return {
      query: async (text: string, params?: any[]) => {
        const rows = params && params.length > 0 ? await (sql as any).query(text, params) : await (sql as any).query(text);
        return { rows: Array.isArray(rows) ? rows : [], rowCount: Array.isArray(rows) ? rows.length : 0 };
      },
      release: () => {},
    };
  }
};
