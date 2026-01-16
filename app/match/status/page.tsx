/**
 * MATCHING MVP HEALTH DASHBOARD
 *
 * Visual dashboard for matching service health
 * Shows: overall state, KPI metrics, coverage, breakdowns, recommendations
 *
 * URL: /match/status
 */

'use client';

import { useState, useEffect } from 'react';

type OverallState = 'PASS' | 'WARN' | 'FAIL' | 'INSUFFICIENT_DATA';

interface MatchStatusResponse {
  timestamp: string;
  tenant_id: string;
  config: {
    matching_auto_create_enabled: boolean;
    wine_searcher_enabled: boolean;
    wine_searcher_mode: string;
    cache_ttl_days: number;
  };
  dbHealth: {
    canRead: boolean;
    canWrite: boolean | 'SKIPPED_PROD_READONLY';
  };
  summary: {
    window: string;
    totalMatches: number;
    autoMatchRate: number;
    suggestedRate: number;
    avgConfidence: number;
    avgConfidenceAuto: number;
    createdEntitiesCount: number;
    autoCreateRate: number;
    identifierCoverage: {
      gtin: { count: number; pct: number };
      lwin: { count: number; pct: number };
      sku: { count: number; pct: number };
      text: { count: number; pct: number };
    };
    thresholds: any;
    overall_state: OverallState;
  };
  breakdown: {
    byStatus: Array<{ status: string; count: number; pct: number }>;
    byMethod: Array<{ method: string; count: number; pct: number }>;
  };
  warnings: string[];
  recommendations: string[];
  recent: Array<{
    id: string;
    source_type: string;
    source_id: string;
    status: string;
    confidence: number;
    match_method: string;
    explanation: string;
    matched_entity_type: string | null;
    matched_entity_id: string | null;
    created_at: string;
  }>;
}

export default function MatchStatusPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatchStatusResponse | null>(null);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/match/status', {
        headers: {
          'x-tenant-id': '00000000-0000-0000-0000-000000000001' // Test tenant
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch status');
      }

      const statusData = await response.json();
      setData(statusData);
    } catch (err: any) {
      console.error('Failed to fetch match status:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStateStyles = (state: OverallState) => {
    switch (state) {
      case 'PASS':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'WARN':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'FAIL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'INSUFFICIENT_DATA':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStateIcon = (state: OverallState) => {
    switch (state) {
      case 'PASS':
        return '✓';
      case 'WARN':
        return '⚠';
      case 'FAIL':
        return '✕';
      case 'INSUFFICIENT_DATA':
        return '📊';
      default:
        return '?';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
        <header className="bg-primary text-primary-foreground shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📊</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Matching Health</h1>
                <p className="text-sm text-primary-foreground/80">MVP Status Dashboard</p>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-lg font-medium text-foreground">Hämtar matchningsstatus...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
        <header className="bg-primary text-primary-foreground shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📊</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Matching Health</h1>
                <p className="text-sm text-primary-foreground/80">MVP Status Dashboard</p>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-card border border-destructive rounded-lg shadow-sm p-6">
            <div className="flex items-start gap-3 text-destructive">
              <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-semibold">Kunde inte hämta status</p>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={fetchStatus}
                  className="mt-3 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Försök igen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📊</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Matching Health</h1>
                <p className="text-sm text-primary-foreground/80">MVP Status Dashboard</p>
              </div>
            </div>
            <button
              onClick={fetchStatus}
              className="px-4 py-2 text-sm font-medium bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-lg transition-colors"
            >
              🔄 Uppdatera
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Overall State Banner */}
        <div
          className={`border-2 rounded-lg p-6 ${getStateStyles(data.summary.overall_state)}`}
        >
          <div className="flex items-center gap-4">
            <div className="text-5xl">{getStateIcon(data.summary.overall_state)}</div>
            <div>
              <h2 className="text-2xl font-bold">{data.summary.overall_state}</h2>
              <p className="text-sm mt-1">
                Overall matching health status (based on {data.summary.window} window)
              </p>
            </div>
          </div>
        </div>

        {/* Config Badges */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Configuration</h3>
          <div className="flex flex-wrap gap-2">
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                data.dbHealth.canRead
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              DB Read: {data.dbHealth.canRead ? 'OK' : 'FAIL'}
            </span>
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                data.dbHealth.canWrite === 'SKIPPED_PROD_READONLY'
                  ? 'bg-blue-100 text-blue-800'
                  : data.dbHealth.canWrite
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              DB Write:{' '}
              {data.dbHealth.canWrite === 'SKIPPED_PROD_READONLY'
                ? 'SKIPPED (Prod)'
                : data.dbHealth.canWrite
                ? 'OK'
                : 'FAIL'}
            </span>
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                data.config.wine_searcher_enabled
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              Wine-Searcher: {data.config.wine_searcher_mode.toUpperCase()}
            </span>
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                data.config.matching_auto_create_enabled
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              Auto-Create: {data.config.matching_auto_create_enabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Total Matches</p>
            <p className="text-3xl font-bold text-foreground">{data.summary.totalMatches}</p>
            <p className="text-xs text-muted-foreground mt-1">Last {data.summary.window}</p>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Auto Match Rate</p>
            <p className="text-3xl font-bold text-foreground">
              {Math.round(data.summary.autoMatchRate * 100)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Target: {Math.round(data.summary.thresholds.targetAutoMatchRate * 100)}%
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Rate</p>
            <p className="text-3xl font-bold text-foreground">
              {Math.round(data.summary.suggestedRate * 100)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max: {Math.round(data.summary.thresholds.maxSuggestedRate * 100)}%
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Avg Confidence (Auto)
            </p>
            <p className="text-3xl font-bold text-foreground">
              {Math.round(data.summary.avgConfidenceAuto * 100)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Min: {Math.round(data.summary.thresholds.minAvgConfidenceAuto * 100)}%
            </p>
          </div>
        </div>

        {/* Identifier Coverage */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Identifier Coverage</h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">GTIN</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-foreground">
                  {data.summary.identifierCoverage.gtin.pct}%
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  ({data.summary.identifierCoverage.gtin.count})
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">LWIN</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-foreground">
                  {data.summary.identifierCoverage.lwin.pct}%
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  ({data.summary.identifierCoverage.lwin.count})
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">SKU</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-foreground">
                  {data.summary.identifierCoverage.sku.pct}%
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  ({data.summary.identifierCoverage.sku.count})
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">TEXT</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-foreground">
                  {data.summary.identifierCoverage.text.pct}%
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  ({data.summary.identifierCoverage.text.count})
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {data.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">⚠ Warnings</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
              {data.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">💡 Recommendations</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
              {data.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Breakdowns */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Status Breakdown */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Breakdown by Status</h3>
            <div className="space-y-2">
              {data.breakdown.byStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.status}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{item.count}</span>
                    <span className="text-muted-foreground">({item.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Method Breakdown */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Breakdown by Method</h3>
            <div className="space-y-2">
              {data.breakdown.byMethod.map((item) => (
                <div key={item.method} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.method}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{item.count}</span>
                    <span className="text-muted-foreground">({item.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Matches (toggle) */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Recent Matches (Debug)</h3>
            <button
              onClick={() => setShowRecent(!showRecent)}
              className="px-3 py-1 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
            >
              {showRecent ? 'Dölj' : 'Visa'}
            </button>
          </div>

          {showRecent && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                      Status
                    </th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                      Method
                    </th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                      Confidence
                    </th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                      Entity
                    </th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                      Explanation
                    </th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((match) => (
                    <tr key={match.id} className="border-b border-border/50">
                      <td className="py-2 px-2">
                        <span className="text-xs font-medium">{match.status}</span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{match.match_method}</td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {Math.round(match.confidence * 100)}%
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {match.matched_entity_type || 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground max-w-xs truncate">
                        {match.explanation}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {new Date(match.created_at).toLocaleDateString('sv-SE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-center text-xs text-muted-foreground">
          Last updated: {new Date(data.timestamp).toLocaleString('sv-SE')}
        </div>
      </div>
    </div>
  );
}
