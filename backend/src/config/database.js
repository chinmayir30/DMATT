import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import net from 'net';

dotenv.config();

function canConnectTcp(host, port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

const host = process.env.DB_HOST || 'localhost';
const envPortRaw = process.env.DB_PORT;
const envPort =
  envPortRaw === undefined || envPortRaw === null || envPortRaw === ''
    ? null
    : Number(envPortRaw);

const selectedPort = envPort || 5432;

const poolConfig = {
  host,
  port: selectedPort,
  database: process.env.DB_NAME || 'dmat_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',

  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
};
console.log("DB CONFIG USED:", { ...poolConfig, password: '***' });
const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('✓ Database connected successfully');
  console.log(`✓ Database host:port ${host}:${selectedPort}`);
});

pool.on('error', (err) => {
  console.error('✗ Unexpected database error:', err);
  process.exit(-1);
});

export default pool;
