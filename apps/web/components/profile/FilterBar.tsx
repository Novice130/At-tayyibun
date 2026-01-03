'use client';

import { useState } from 'react';

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void;
}

interface FilterState {
  ethnicity: string;
  gender: string;
  minAge: number;
  maxAge: number;
  sortBy: 'rankBoost' | 'age';
}

const ETHNICITIES = [
  'All',
  'Arab',
  'South Asian',
  'African American',
  'Southeast Asian',
  'European',
  'Latino/Hispanic',
  'Mixed/Other',
];

export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>({
    ethnicity: '',
    gender: '',
    minAge: 18,
    maxAge: 60,
    sortBy: 'rankBoost',
  });

  const handleChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="glass rounded-xl p-4 mb-6 sticky top-20 z-40">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Ethnicity */}
        <div className="flex-1 min-w-[150px]">
          <label className="label text-xs text-gray-500">Ethnicity</label>
          <select
            className="input mt-1"
            value={filters.ethnicity}
            onChange={(e) => handleChange('ethnicity', e.target.value)}
          >
            {ETHNICITIES.map((eth) => (
              <option key={eth} value={eth === 'All' ? '' : eth}>
                {eth}
              </option>
            ))}
          </select>
        </div>

        {/* Gender */}
        <div className="flex-1 min-w-[120px]">
          <label className="label text-xs text-gray-500">Looking for</label>
          <select
            className="input mt-1"
            value={filters.gender}
            onChange={(e) => handleChange('gender', e.target.value)}
          >
            <option value="">All</option>
            <option value="MALE">Brothers</option>
            <option value="FEMALE">Sisters</option>
          </select>
        </div>

        {/* Age Range */}
        <div className="flex-1 min-w-[180px]">
          <label className="label text-xs text-gray-500">Age Range</label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              className="input w-16 text-center"
              min={18}
              max={100}
              value={filters.minAge}
              onChange={(e) => handleChange('minAge', parseInt(e.target.value))}
            />
            <span>to</span>
            <input
              type="number"
              className="input w-16 text-center"
              min={18}
              max={100}
              value={filters.maxAge}
              onChange={(e) => handleChange('maxAge', parseInt(e.target.value))}
            />
          </div>
        </div>

        {/* Sort */}
        <div className="flex-1 min-w-[140px]">
          <label className="label text-xs text-gray-500">Sort by</label>
          <select
            className="input mt-1"
            value={filters.sortBy}
            onChange={(e) => handleChange('sortBy', e.target.value as 'rankBoost' | 'age')}
          >
            <option value="rankBoost">Featured</option>
            <option value="age">Age</option>
          </select>
        </div>
      </div>
    </div>
  );
}
