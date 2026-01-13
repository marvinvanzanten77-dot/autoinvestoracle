import { getStorageAdapter } from './storage';

export async function getUserPortfolioSnapshot(userId: string) {
  const storage = getStorageAdapter();
  const balances = await storage.listBalances(userId);
  return {
    userId,
    balances,
    updatedAt: new Date().toISOString()
  };
}

export async function getUserTransactionHistory(userId: string, range?: { since?: string; until?: string }) {
  const storage = getStorageAdapter();
  const transactions = await storage.listTransactions(userId, range?.since, range?.until);
  return transactions;
}

export async function getUserExposureByAsset(userId: string) {
  const storage = getStorageAdapter();
  const balances = await storage.listBalances(userId);
  return balances.reduce<Record<string, number>>((acc, bal) => {
    acc[bal.asset] = (acc[bal.asset] || 0) + bal.total;
    return acc;
  }, {});
}
