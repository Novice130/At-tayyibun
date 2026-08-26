'use client';

import { useState, useEffect } from 'react';
import { SlidersHorizontal, X, Loader, RotateCcw } from 'lucide-react';

export interface FilterState {
  ethnicity: string;
  minAge: number | null;
  maxAge: number | null;
  sortBy: 'age' | 'createdAt' | 'rankBoost';
  order: 'asc' | 'desc';
}

interface FilterBarProps {
  filters?: FilterState;
  onFilter: (filters: FilterState) => void;
  loading?: boolean;
}

const ethnicities = [
  'South Asian',
  'Arab',
  'African',
  'African American',
  'Southeast Asian',
  'Turkish',
  'Persian',
  'Central Asian',
  'White / Caucasian',
  'Hispanic / Latino',
  'Mixed',
  'Other',
];

export function FilterBar({ filters: initialFilters, onFilter, loading = false }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters || {
    ethnicity: '',
    minAge: null,
    maxAge: null,
    sortBy: 'rankBoost',
    order: 'desc',
  });

  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  const handleApply = () => {
    onFilter(filters);
    setShowFilters(false);
  };

  const handleReset = () => {
    const defaultFilters: FilterState = {
      ethnicity: '',
      minAge: null,
      maxAge: null,
      sortBy: 'rankBoost',
      order: 'desc',
    };
    setFilters(defaultFilters);
    onFilter(defaultFilters);
    setShowFilters(false);
  };

  const hasActiveFilters = Boolean(
    filters.ethnicity || filters.minAge !== null || filters.maxAge !== null
  );

  return (
    <div className="mb-6">
      {/* Quick filters bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-controls="filter-panel"
          className={`btn-secondary py-2 px-4 flex items-center gap-2 transition ${
            hasActiveFilters ? 'border-gold-500 text-gold-400 bg-gold-500/10' : ''
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-gold-500 inline-block" />
          )}
        </button>

        {/* Quick sort */}
        <select
          aria-label="Sort profiles"
          value={`${filters.sortBy}-${filters.order}`}
          onChange={(e) => {
            const [sortBy, order] = e.target.value.split('-') as [FilterState['sortBy'], FilterState['order']];
            const newFilters = { ...filters, sortBy, order };
            setFilters(newFilters);
            onFilter(newFilters);
          }}
          className="rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          <option value="rankBoost-desc">Featured</option>
          <option value="age-asc">Age: Young to Old</option>
          <option value="age-desc">Age: Old to Young</option>
          <option value="createdAt-desc">Newest First</option>
        </select>

        {loading && (
          <Loader className="w-4 h-4 animate-spin text-gold-500" aria-label="Loading profiles" />
        )}

        {/* Active filter chips */}
        {filters.ethnicity && (
          <span className="badge-gold flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium">
            <span>{filters.ethnicity}</span>
            <button
              type="button"
              aria-label="Remove ethnicity filter"
              onClick={() => {
                const newFilters = { ...filters, ethnicity: '' };
                setFilters(newFilters);
                onFilter(newFilters);
              }}
              className="hover:opacity-75 focus:outline-none"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {(filters.minAge !== null || filters.maxAge !== null) && (
          <span className="badge-gold flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium">
            <span>
              {filters.minAge !== null && filters.maxAge !== null
                ? `Age: ${filters.minAge} – ${filters.maxAge}`
                : filters.minAge !== null
                  ? `Age: ${filters.minAge}+`
                  : `Age: ≤ ${filters.maxAge}`}
            </span>
            <button
              type="button"
              aria-label="Remove age filter"
              onClick={() => {
                const newFilters = { ...filters, minAge: null, maxAge: null };
                setFilters(newFilters);
                onFilter(newFilters);
              }}
              className="hover:opacity-75 focus:outline-none"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-[var(--color-text-muted)] hover:text-gold-400 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Reset all
          </button>
        )}
      </div>

      {/* Expanded filters panel */}
      {showFilters && (
        <div id="filter-panel" className="mt-4 p-5 card animate-fade-in rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Ethnicity */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Ethnicity</label>
              <select
                value={filters.ethnicity}
                onChange={(e) => setFilters({ ...filters, ethnicity: e.target.value })}
                className="input w-full"
              >
                <option value="">All Ethnicities</option>
                {ethnicities.map((eth) => (
                  <option key={eth} value={eth}>{eth}</option>
                ))}
              </select>
            </div>

            {/* Age Range */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Age Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min (18)"
                  min={18}
                  max={80}
                  value={filters.minAge ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    setFilters({ ...filters, minAge: val && !isNaN(val) ? val : null });
                  }}
                  className="input w-1/2"
                />
                <span className="text-[var(--color-text-muted)] text-sm">to</span>
                <input
                  type="number"
                  placeholder="Max (80)"
                  min={18}
                  max={80}
                  value={filters.maxAge ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    setFilters({ ...filters, maxAge: val && !isNaN(val) ? val : null });
                  }}
                  className="input w-1/2"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={handleApply}
              className="btn-primary py-2 px-6 text-sm font-medium"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn-ghost py-2 px-6 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
