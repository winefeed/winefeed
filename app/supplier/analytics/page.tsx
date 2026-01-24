'use client';

/**
 * SUPPLIER ANALYTICS & COMPETITION ANALYSIS
 *
 * /supplier/analytics
 *
 * Shows supplier performance metrics and market comparison
 *
 * Features:
 * - Price comparison vs market average
 * - Win rate on offers
 * - Response time metrics
 * - Popular wine categories
 */

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Award, Clock, Target, Wine, BarChart3, Percent } from 'lucide-react';

interface SupplierStats {
  totalOffers: number;
  acceptedOffers: number;
  winRate: number;
  avgResponseTime: number;
  avgPriceVsMarket: number;
  totalRevenue: number;
  popularCategories: { name: string; count: number }[];
  recentOffers: {
    id: string;
    wine_name: string;
    price_sek: number;
    market_price: number;
    status: string;
    created_at: string;
  }[];
}

export default function SupplierAnalyticsPage() {
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  async function fetchAnalytics() {
    try {
      setLoading(true);

      // Get supplier context
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        window.location.href = '/supplier/login';
        return;
      }
      const supplierData = await supplierRes.json();
      setSupplierId(supplierData.supplierId);

      // Try to fetch real analytics, fall back to mock data
      try {
        const analyticsRes = await fetch(`/api/suppliers/${supplierData.supplierId}/analytics?range=${timeRange}`);
        if (analyticsRes.ok) {
          const data = await analyticsRes.json();
          setStats(data);
          return;
        }
      } catch (e) {
        console.log('Using mock analytics data');
      }

      // Mock data for MVP
      setStats({
        totalOffers: 47,
        acceptedOffers: 23,
        winRate: 48.9,
        avgResponseTime: 4.2,
        avgPriceVsMarket: -3.5,
        totalRevenue: 156000,
        popularCategories: [
          { name: 'Rött vin', count: 28 },
          { name: 'Vitt vin', count: 12 },
          { name: 'Mousserande', count: 5 },
          { name: 'Rosé', count: 2 },
        ],
        recentOffers: [
          { id: '1', wine_name: 'Château Margaux 2018', price_sek: 890, market_price: 950, status: 'ACCEPTED', created_at: new Date().toISOString() },
          { id: '2', wine_name: 'Cloudy Bay Sauvignon Blanc', price_sek: 189, market_price: 195, status: 'ACCEPTED', created_at: new Date(Date.now() - 86400000).toISOString() },
          { id: '3', wine_name: 'Dom Pérignon 2012', price_sek: 1650, market_price: 1750, status: 'PENDING', created_at: new Date(Date.now() - 172800000).toISOString() },
          { id: '4', wine_name: 'Penfolds Bin 389', price_sek: 420, market_price: 399, status: 'REJECTED', created_at: new Date(Date.now() - 259200000).toISOString() },
          { id: '5', wine_name: 'Tignanello 2019', price_sek: 780, market_price: 820, status: 'ACCEPTED', created_at: new Date(Date.now() - 345600000).toISOString() },
        ],
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'Accepterad';
      case 'REJECTED': return 'Avvisad';
      case 'PENDING': return 'Väntar';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Kunde inte ladda analysdata</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analys & Insikter</h1>
          <p className="text-gray-500 mt-1">
            Se hur dina offerter presterar jämfört med marknaden
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
        >
          <option value="week">Senaste veckan</option>
          <option value="month">Senaste månaden</option>
          <option value="quarter">Senaste kvartalet</option>
          <option value="year">Senaste året</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Win Rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <span className={`text-sm font-medium ${stats.winRate >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
              {stats.winRate >= 50 ? '↑' : '↓'} {Math.abs(stats.winRate - 50).toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.winRate.toFixed(1)}%</p>
          <p className="text-sm text-gray-500">Win rate</p>
        </div>

        {/* Response Time */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <span className={`text-sm font-medium ${stats.avgResponseTime <= 4 ? 'text-green-600' : 'text-amber-600'}`}>
              {stats.avgResponseTime <= 4 ? 'Snabbt' : 'Normalt'}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.avgResponseTime}h</p>
          <p className="text-sm text-gray-500">Svarstid (snitt)</p>
        </div>

        {/* Price vs Market */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${stats.avgPriceVsMarket <= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {stats.avgPriceVsMarket <= 0 ? (
                <TrendingDown className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingUp className="h-5 w-5 text-red-600" />
              )}
            </div>
            <span className={`text-sm font-medium ${stats.avgPriceVsMarket <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.avgPriceVsMarket <= 0 ? 'Under' : 'Över'} marknad
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.avgPriceVsMarket.toFixed(1)}%</p>
          <p className="text-sm text-gray-500">Pris vs marknad</p>
        </div>

        {/* Total Offers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Award className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-green-600">
              {stats.acceptedOffers} accepterade
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalOffers}</p>
          <p className="text-sm text-gray-500">Totalt offerter</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Price Comparison Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            Prisjämförelse - Senaste offerter
          </h2>
          <div className="space-y-4">
            {stats.recentOffers.map((offer) => {
              const priceDiff = ((offer.price_sek - offer.market_price) / offer.market_price) * 100;
              const isLower = priceDiff <= 0;

              return (
                <div key={offer.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{offer.wine_name}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(offer.status)}`}>
                        {getStatusLabel(offer.status)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{offer.price_sek} kr</p>
                      <p className="text-xs text-gray-500">Marknad: {offer.market_price} kr</p>
                    </div>
                  </div>

                  {/* Price bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isLower ? 'bg-green-500' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(100, Math.abs(priceDiff) * 5 + 50)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${isLower ? 'text-green-600' : 'text-red-600'}`}>
                      {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Categories */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Wine className="h-5 w-5 text-gray-400" />
            Förfrågningar per kategori
          </h2>
          <div className="space-y-4">
            {stats.popularCategories.map((category, index) => {
              const maxCount = stats.popularCategories[0].count;
              const percentage = (category.count / maxCount) * 100;

              return (
                <div key={category.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{category.name}</span>
                    <span className="text-sm text-gray-500">{category.count} förfrågningar</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Tips:</strong> Fokusera på kategorier med hög efterfrågan för att öka dina chanser att vinna offerter.
            </p>
          </div>
        </div>
      </div>

      {/* Insights Card */}
      <div className="mt-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Insikter & Rekommendationer
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <p className="text-sm opacity-90 mb-1">Din win rate</p>
            <p className="text-2xl font-bold">{stats.winRate.toFixed(0)}%</p>
            <p className="text-xs opacity-75 mt-2">
              {stats.winRate >= 50
                ? 'Bra jobbat! Du ligger över snittet.'
                : 'Prova att sänka priset eller snabba upp svarstiden.'}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <p className="text-sm opacity-90 mb-1">Prisstrategi</p>
            <p className="text-2xl font-bold">{Math.abs(stats.avgPriceVsMarket).toFixed(1)}% {stats.avgPriceVsMarket <= 0 ? 'under' : 'över'}</p>
            <p className="text-xs opacity-75 mt-2">
              {stats.avgPriceVsMarket <= 0
                ? 'Ditt pris är konkurrenskraftigt!'
                : 'Överväg att sänka priset för högre win rate.'}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <p className="text-sm opacity-90 mb-1">Svarstid</p>
            <p className="text-2xl font-bold">{stats.avgResponseTime}h snitt</p>
            <p className="text-xs opacity-75 mt-2">
              {stats.avgResponseTime <= 4
                ? 'Utmärkt! Snabba svar ökar dina chanser.'
                : 'Snabbare svar kan förbättra din win rate.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
