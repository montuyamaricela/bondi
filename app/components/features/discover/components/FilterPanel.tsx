'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Slider } from '@/app/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import type { DiscoverFilters } from '../types';
import type { GenderPreference } from '@prisma/client';

interface FilterPanelProps {
  filters: DiscoverFilters;
  onApplyFilters: (filters: DiscoverFilters) => void;
}

export function FilterPanel({ filters, onApplyFilters }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<DiscoverFilters>(filters);

  const handleApply = () => {
    onApplyFilters(localFilters);
    setIsOpen(false);
  };

  const handleReset = () => {
    const defaultFilters: DiscoverFilters = {
      minAge: 18,
      maxAge: 100,
      distance: undefined,
      genderPreference: 'EVERYONE',
    };
    setLocalFilters(defaultFilters);
    onApplyFilters(defaultFilters);
  };

  const hasActiveFilters =
    filters.minAge !== 18 ||
    filters.maxAge !== 100 ||
    filters.distance !== undefined ||
    filters.genderPreference !== 'EVERYONE';

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant='outline' className='relative'>
          <Filter className='h-4 w-4 mr-2' />
          Filters
          {hasActiveFilters && (
            <span className='absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary-main' />
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className=''>
        <SheetHeader className=''>
          <SheetTitle className='text-2xl font-semibold'>Filters</SheetTitle>
        </SheetHeader>

        <div className='space-y-4 px-4'>
          {/* Age Range */}
          <div className='space-y-4'>
            <Label className='text-base font-semibold'>Age Range</Label>
            <div className='space-y-3'>
              <div className='flex justify-between text-sm text-text-muted'>
                <span>{localFilters.minAge ?? 18}</span>
                <span>{localFilters.maxAge ?? 100}</span>
              </div>
              <Slider
                min={18}
                max={100}
                step={1}
                value={[localFilters.minAge ?? 18, localFilters.maxAge ?? 100]}
                onValueChange={(value) => {
                  setLocalFilters({
                    ...localFilters,
                    minAge: value[0],
                    maxAge: value[1],
                  });
                }}
                className='w-full'
              />
            </div>
          </div>

          {/* Distance */}
          <div className='space-y-4'>
            <Label className='text-base font-semibold'>
              Maximum Distance (km)
            </Label>
            <div className='space-y-3'>
              <div className='flex justify-between text-sm text-text-muted'>
                <span>Any distance</span>
                {localFilters.distance && (
                  <span>{localFilters.distance} km</span>
                )}
              </div>
              <Slider
                min={1}
                max={500}
                step={10}
                value={[localFilters.distance ?? 500]}
                onValueChange={(value) => {
                  setLocalFilters({
                    ...localFilters,
                    distance: value[0] === 500 ? undefined : value[0],
                  });
                }}
                className='w-full'
              />
            </div>
          </div>

          {/* Gender Preference */}
          <div className='space-y-3'>
            <Label className='text-base font-semibold'>Show me</Label>
            <Select
              value={localFilters.genderPreference ?? 'EVERYONE'}
              onValueChange={(value: GenderPreference) => {
                setLocalFilters({
                  ...localFilters,
                  genderPreference: value,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select gender preference' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='EVERYONE'>Everyone</SelectItem>
                <SelectItem value='MALE'>Men</SelectItem>
                <SelectItem value='FEMALE'>Women</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className='flex gap-3'>
            <Button variant='outline' onClick={handleReset} className='flex-1'>
              <X className='mr-2 h-4 w-4' />
              Reset
            </Button>
            <Button
              onClick={handleApply}
              className='flex-1 bg-primary-main text-primary-text hover:bg-primary-hover'
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
