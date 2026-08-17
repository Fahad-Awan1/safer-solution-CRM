import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

declare global {
  var _postgresPool: pg.Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const isCloud = !!process.env.DATABASE_URL || (process.env.SQL_HOST && !['localhost', '127.0.0.1'].includes(process.env.SQL_HOST));

    const DEFAULT_NEON_URL = 'postgresql://neondb_owner:npg_m7kGWiOZUAw4@ep-dry-forest-ay3ln0tr.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';
    let connStr = process.env.DATABASE_URL || DEFAULT_NEON_URL;
    if (connStr.includes('neon.tech') && !connStr.includes('-pooler')) {
      connStr = connStr.replace('.c-5.us-east-2.aws.neon.tech', '-pooler.c-5.us-east-2.aws.neon.tech');
    }

    const poolConfig: pg.PoolConfig = connStr
      ? {
          connectionString: connStr,
          ssl: { rejectUnauthorized: false },
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 30000,
        }
      : {
          host: process.env.SQL_HOST || 'localhost',
          user: process.env.SQL_USER || 'postgres',
          password: process.env.SQL_PASSWORD || 'postgres',
          database: process.env.SQL_DB_NAME || 'safer_solution_crm',
          ssl: isCloud ? { rejectUnauthorized: false } : false,
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 30000,
        };

    global._postgresPool = new Pool(poolConfig);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { pool };
