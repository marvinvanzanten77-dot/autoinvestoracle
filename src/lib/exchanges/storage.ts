import fs from 'fs/promises';
import path from 'path';
import { kv } from '@vercel/kv';
import type {
  Account,
  Balance,
  ExchangeConnection,
  MarketCandle,
  Order,
  Position,
  Transaction
} from './types';
import { decryptString, encryptString } from '../security/crypto';
import { StorageError } from './types';

export type StorageDriver = 'kv' | 'file';

export type StorageAdapter = {
  listConnections(userId: string): Promise<ExchangeConnection[]>;
  getConnection(userId: string, exchange: string): Promise<ExchangeConnection | null>;
  saveConnection(userId: string, connection: ExchangeConnection): Promise<void>;
  deleteConnection(userId: string, exchange: string): Promise<void>;
  saveAccounts(userId: string, accounts: Account[]): Promise<void>;
  saveBalances(userId: string, balances: Balance[]): Promise<void>;
  savePositions(userId: string, positions: Position[]): Promise<void>;
  saveTransactions(userId: string, transactions: Transaction[]): Promise<void>;
  saveOrders(userId: string, orders: Order[]): Promise<void>;
  saveMarketCandles(userId: string, candles: MarketCandle[]): Promise<void>;
  listBalances(userId: string): Promise<Balance[]>;
  listTransactions(userId: string, since?: string, until?: string): Promise<Transaction[]>;
  listPositions(userId: string): Promise<Position[]>;
};

type StoreData = {
  connections: ExchangeConnection[];
  accounts: Account[];
  balances: Balance[];
  positions: Position[];
  transactions: Transaction[];
  orders: Order[];
  marketCandles: MarketCandle[];
};

const EMPTY_STORE: StoreData = {
  connections: [],
  accounts: [],
  balances: [],
  positions: [],
  transactions: [],
  orders: [],
  marketCandles: []
};

const dataFile = path.join(process.cwd(), '.data', 'exchange-store.json');

async function ensureFileStore() {
  const dir = path.dirname(dataFile);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readFileStore(userId: string): Promise<StoreData> {
  await ensureFileStore();
  const raw = await fs.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw || '{}') as Record<string, StoreData>;
  return parsed[userId] || { ...EMPTY_STORE };
}

async function writeFileStore(userId: string, data: StoreData) {
  await ensureFileStore();
  const raw = await fs.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw || '{}') as Record<string, StoreData>;
  parsed[userId] = data;
  await fs.writeFile(dataFile, JSON.stringify(parsed, null, 2), 'utf8');
}

async function readKvStore(userId: string): Promise<StoreData> {
  const data = (await kv.get(`exchange:${userId}:store`)) as StoreData | null;
  return data || { ...EMPTY_STORE };
}

async function writeKvStore(userId: string, data: StoreData) {
  await kv.set(`exchange:${userId}:store`, data);
}

function buildAdapter(driver: StorageDriver): StorageAdapter {
  const read = driver === 'kv' ? readKvStore : readFileStore;
  const write = driver === 'kv' ? writeKvStore : writeFileStore;

  return {
    async listConnections(userId) {
      const store = await read(userId);
      return store.connections;
    },
    async getConnection(userId, exchange) {
      const store = await read(userId);
      return store.connections.find((c) => c.exchange === exchange) || null;
    },
    async saveConnection(userId, connection) {
      const store = await read(userId);
      const next = store.connections.filter((c) => c.exchange !== connection.exchange);
      next.push(connection);
      await write(userId, { ...store, connections: next });
    },
    async deleteConnection(userId, exchange) {
      const store = await read(userId);
      const next = store.connections.filter((c) => c.exchange !== exchange);
      await write(userId, { ...store, connections: next });
    },
    async saveAccounts(userId, accounts) {
      const store = await read(userId);
      await write(userId, { ...store, accounts });
    },
    async saveBalances(userId, balances) {
      const store = await read(userId);
      await write(userId, { ...store, balances });
    },
    async savePositions(userId, positions) {
      const store = await read(userId);
      await write(userId, { ...store, positions });
    },
    async saveTransactions(userId, transactions) {
      const store = await read(userId);
      await write(userId, { ...store, transactions });
    },
    async saveOrders(userId, orders) {
      const store = await read(userId);
      await write(userId, { ...store, orders });
    },
    async saveMarketCandles(userId, candles) {
      const store = await read(userId);
      await write(userId, { ...store, marketCandles: candles });
    },
    async listBalances(userId) {
      const store = await read(userId);
      return store.balances;
    },
    async listTransactions(userId, since, until) {
      const store = await read(userId);
      return store.transactions.filter((tx) => {
        if (since && tx.timestamp < since) return false;
        if (until && tx.timestamp > until) return false;
        return true;
      });
    },
    async listPositions(userId) {
      const store = await read(userId);
      return store.positions;
    }
  };
}

export function getStorageAdapter(): StorageAdapter {
  const driver = (process.env.STORAGE_DRIVER || 'file') as StorageDriver;
  return buildAdapter(driver === 'kv' ? 'kv' : 'file');
}

export function encryptSecrets(payload: Record<string, string>) {
  return encryptString(JSON.stringify(payload));
}

export function decryptSecrets(blob: string) {
  try {
    return JSON.parse(decryptString(blob)) as Record<string, string>;
  } catch (err) {
    throw new StorageError('Kon secrets niet ontsleutelen.');
  }
}
