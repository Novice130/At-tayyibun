'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

interface FilterBarProps {
  onFilter: (filters: FilterState) => void;
}

interface FilterState {
  ethnicity: string;
  minAge: number | null;
  maxAge: number | null;
  sortBy: 'age' | 'createdAt' | 'rankBoost';
  order: 'asc' | 'desc';
}

const ethnicities = [
  'South Asian',
  'Arab',
  'African',
  'African American',
  'Southeast Asian',
  'Turkish',
  'Persian',
  'European',
  'Latino',
  'Other',
];

export function FilterBar({ onFilter }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    ethnicity: '',
    minAge: null,
    maxAge: null,
    sortBy: 'rankBoost',
    order: 'desc',
  });

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
  };

  return (
    <div className="mb-6">
      {/* Quick filters bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn-secondary py-2 px-4 flex items-center gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>

        {/* Quick sort */}
        <select
          value={`${filters.sortBy}-${filters.order}`}
          onChange={(e) => {
            const [sortBy, order] = e.target.value.split('-') as [FilterState['sortBy'], FilterState['order']];
            const newFilters = { ...filters, sortBy, order };
            setFilters(newFilters);
            onFilter(newFilters);
          }}
          className="bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
        >
          <option value="rankBoost-desc">Featured</option>
          <option value="age-asc">Age: Young to Old</option>
          <option value="age-desc">Age: Old to Young</option>
          <option value="createdAt-desc">Newest First</option>
        </select>

        {/* Active filter chips */}
        {filters.ethnicity && (
          <span className="badge-gold flex items-center gap-1">
            {filters.ethnicity}
            <button
              onClick={() => {
                const newFilters = { ...filters, ethnicity: '' };
                setFilters(newFilters);
                onFilter(newFilters);
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>

      {/* Expanded filters panel */}
      {showFilters && (
        <div className="mt-4 p-4 card animate-fade-in">
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Ethnicity */}
            <div>
              <label className="block text-sm font-medium mb-2">Ethnicity</label>
              <select
                value={filters.ethnicity}
                onChange={(e) => setFilters({ ...filters, ethnicity: e.target.value })}
                className="input"
              >
                <option value="">All Ethnicities</option>
                {ethnicities.map((eth) => (
                  <option key={eth} value={eth}>{eth}</option>
                ))}
              </select>
            </div>

            {/* Age Range */}
            <div>
              <label className="block text-sm font-medium mb-2">Age Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={18}
                  max={80}
                  value={filters.minAge || ''}
                  onChange={(e) => setFilters({ ...filters, minAge: e.target.value ? parseInt(e.target.value) : null })}
                  className="input w-1/2"
                />
                <input
                  type="number"
                  placeholder="Max"
                  min={18}
                  max={80}
                  value={filters.maxAge || ''}
                  onChange={(e) => setFilters({ ...filters, maxAge: e.target.value ? parseInt(e.target.value) : null })}
                  className="input w-1/2"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={handleApply} className="btn-primary py-2 px-6">
              Apply Filters
            </button>
            <button onClick={handleReset} className="btn-ghost py-2 px-6">
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
