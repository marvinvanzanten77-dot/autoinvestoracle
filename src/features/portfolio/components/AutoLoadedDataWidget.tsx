/**
 * Auto-loaded Market Data Component
 * Displays real-time aggregated market data
 * 
 * Note: Does NOT auto-refresh (user must click Refresh button)
 * This prevents excessive API calls and OpenAI costs.
 */

import React, { useEffect, useState } from 'react';
import type { AutoLoadedData } from '../lib/dataService';
import { formatAggregatedData } from '../lib/dataService';

interface AutoLoadedDataWidgetProps {
  autoLoadData?: AutoLoadedData;
  isLoading?: boolean;
  error?: string;
}

export function AutoLoadedDataWidget({
  autoLoadData,
  isLoading = false,
  error,
}: AutoLoadedDataWidgetProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-600">Marktdata laden...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <p className="text-sm text-red-700">Fout bij laden: {error}</p>
      </div>
    );
  }

  if (!autoLoadData?.marketData) {
    return null;
  }

  const btc = formatAggregatedData(autoLoadData.marketData.btc);
  const eth = formatAggregatedData(autoLoadData.marketData.eth);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Bitcoin */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Bitcoin</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
            BTC
          </span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Prijs:</span>
            <span className="font-medium text-slate-900">{btc.price}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">24h:</span>
            <span
              className={`font-medium ${
                autoLoadData.marketData.btc.momentum.change24h > 0
                  ? 'text-green-700'
                  : 'text-red-700'
              }`}
            >
              {btc.change24h}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Sentiment:</span>
            <span className="font-medium text-slate-900">{btc.sentiment}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Volume:</span>
            <span className="font-medium text-slate-900">{btc.volume}</span>
          </div>
        </div>
      </div>

      {/* Ethereum */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Ethereum</h3>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
            ETH
          </span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Prijs:</span>
            <span className="font-medium text-slate-900">{eth.price}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">24h:</span>
            <span
              className={`font-medium ${
                autoLoadData.marketData.eth.momentum.change24h > 0
                  ? 'text-green-700'
                  : 'text-red-700'
              }`}
            >
              {eth.change24h}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Sentiment:</span>
            <span className="font-medium text-slate-900">{eth.sentiment}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Volume:</span>
            <span className="font-medium text-slate-900">{eth.volume}</span>
          </div>
        </div>
      </div>

      {/* Data Quality & Sources */}
      <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Databronnen:</span>
            <span className="text-slate-900">{autoLoadData.sources.join(', ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Data kwaliteit:</span>
            <span className={autoLoadData.quality >= 80 ? 'text-green-700' : 'text-amber-700'}>
              {autoLoadData.quality}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Laatst bijgewerkt:</span>
            <span className="text-slate-900">{autoLoadData.lastUpdated}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
