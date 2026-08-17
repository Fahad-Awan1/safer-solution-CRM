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

    const poolConfig: pg.PoolConfig = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: isCloud ? { rejectUnauthorized: false } : false,
          max: 2,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 10000,
        }
      : {
          host: process.env.SQL_HOST || 'localhost',
          user: process.env.SQL_USER || 'postgres',
          password: process.env.SQL_PASSWORD || 'postgres',
          database: process.env.SQL_DB_NAME || 'safer_solution_crm',
          ssl: isCloud ? { rejectUnauthorized: false } : false,
          max: 2,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 10000,
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
