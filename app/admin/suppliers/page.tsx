/**
 * ADMIN SUPPLIERS PAGE
 *
 * /admin/suppliers
 *
 * Shows all suppliers with filtering and sorting
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, RefreshCw, Search, ArrowLeft, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { useActor } from '@/lib/hooks/useActor';

interface SupplierStats {
  totalWines: number;
  activeWines: number;
  userCount: number;
  totalOrders: number;
  pendingOrders: number;
}

interface Supplier {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  email: string | null;
  phone: string | null;
  website: string | null;
  orgNumber: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
  stats: SupplierStats;
}

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  'SWEDISH_IMPORTER': 'Svensk importor',
  'EU_PRODUCER': 'EU-producent',
  'EU_IMPORTER': 'EU-importor',
  'IOR': 'Importor',
};

export default function AdminSuppliersPage() {
  const router = useRouter();
  const { actor, loading: actorLoading } = useActor();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!actorLoading && actor) {
      if (!actor.roles.includes('ADMIN')) {
        setError('Access Denied: Admin privileges required');
        setLoading(false);
        return;
      }
      fetchSuppliers();
    }
  }, [actor, actorLoading]);

  useEffect(() => {
    let filtered = suppliers;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.city?.toLowerCase().includes(query) ||
        s.orgNumber?.includes(query)
      );
    }

    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(s => s.type === typeFilter);
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(s =>
        statusFilter === 'ACTIVE' ? s.isActive : !s.isActive
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortColumn) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'wines':
          aVal = a.stats.totalWines;
          bVal = b.stats.totalWines;
          break;
        case 'users':
          aVal = a.stats.userCount;
          bVal = b.stats.userCount;
          break;
        case 'orders':
          aVal = a.stats.totalOrders;
          bVal = b.stats.totalOrders;
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredSuppliers(filtered);
  }, [suppliers, searchQuery, typeFilter, statusFilter, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ column, label, className = '' }: { column: string; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(column)}
      className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none ${className}`}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {label}
        {sortColumn === column ? (
          sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <div className="w-3" />
        )}
      </div>
    </th>
  );

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/suppliers', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access Denied: Admin privileges required');
        }
        throw new Error('Failed to fetch suppliers');
      }

      const data = await response.json();
      setSuppliers(data.suppliers);
      setFilteredSuppliers(data.suppliers);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda leverantorer'));
    } finally {
      setLoading(false);
    }
  };

  const availableTypes = [...new Set(suppliers.map(s => s.type))].filter(Boolean);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="h-12 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <div className="text-destructive text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Nagot gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Tillbaka till Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leverantorer</h1>
          <p className="text-muted-foreground mt-1">
            {filteredSuppliers.length} av {suppliers.length} leverantorer
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchSuppliers}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Uppdatera
          </button>
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-card rounded-lg p-4 border border-border">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">Sok</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sok namn, email, stad..."
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-foreground mb-1">Typ</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">Alla typer</option>
              {availableTypes.map(type => (
                <option key={type} value={type}>
                  {SUPPLIER_TYPE_LABELS[type] || type}
                </option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-foreground mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">Alla</option>
              <option value="ACTIVE">Aktiva</option>
              <option value="INACTIVE">Inaktiva</option>
            </select>
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <SortableHeader column="name" label="Namn" className="text-left" />
                <SortableHeader column="type" label="Typ" className="text-left" />
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">Kontakt</th>
                <SortableHeader column="wines" label="Viner" className="text-right" />
                <SortableHeader column="users" label="Anvandare" className="text-right" />
                <SortableHeader column="orders" label="Ordrar" className="text-right" />
                <SortableHeader column="createdAt" label="Skapad" className="text-left" />
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">Status</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Inga leverantorer hittades</p>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/suppliers/${supplier.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{supplier.name}</div>
                      {supplier.city && (
                        <div className="text-xs text-muted-foreground">{supplier.city}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {SUPPLIER_TYPE_LABELS[supplier.type] || supplier.type}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">{supplier.email || '-'}</div>
                      {supplier.website && (
                        <a
                          href={supplier.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Hemsida
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-medium text-foreground">{supplier.stats.totalWines}</div>
                      <div className="text-xs text-muted-foreground">{supplier.stats.activeWines} aktiva</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-foreground">
                      {supplier.stats.userCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-medium text-foreground">{supplier.stats.totalOrders}</div>
                      {supplier.stats.pendingOrders > 0 && (
                        <div className="text-xs text-amber-600">{supplier.stats.pendingOrders} vantande</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(supplier.createdAt).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        supplier.isActive
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-gray-100 text-gray-800 border border-gray-300'
                      }`}>
                        {supplier.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
