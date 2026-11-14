'use client';

import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/fetch-wrapper';
import { cityLabel } from '@/lib/location';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { citySearchSchema } from '../validation';
import type { CityOption } from '../types';

export function CityPicker({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (id: string) => Promise<void>;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [submitted, setSubmitted] = useState<{ q: string; country?: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['location-cities', submitted],
    enabled: submitted !== null,
    retry: false,
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ q: submitted!.q });
      if (submitted!.country) params.set('country', submitted!.country);
      return api.get<{ items: CityOption[] }>(`/api/location/cities?${params}`, { signal });
    },
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Discovery uses the selected city center as an approximate origin. A selection does not
        establish where you are or live. Saving it deletes your previous device coordinates.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSelected(null);
          const valid = citySearchSchema.safeParse({ q: search, country: country || undefined });
          if (!valid.success) {
            setError(
              'Use 2–80 searchable city characters and an optional two-letter country code.',
            );
            return;
          }
          setError(null);
          if (submitted?.q === valid.data.q && submitted?.country === valid.data.country)
            void query.refetch();
          else setSubmitted(valid.data);
        }}
      >
        <label htmlFor={`${id}-query`} className="block space-y-1 text-sm">
          <span>Search city</span>
          <Input
            id={`${id}-query`}
            value={search}
            minLength={2}
            maxLength={80}
            disabled={busy}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelected(null);
              setSubmitted(null);
            }}
          />
        </label>
        <label htmlFor={`${id}-country`} className="block space-y-1 text-sm">
          <span>Country code (optional)</span>
          <Input
            id={`${id}-country`}
            value={country}
            maxLength={2}
            placeholder="PH"
            disabled={busy}
            onChange={(event) => {
              setCountry(event.target.value.toUpperCase());
              setSelected(null);
              setSubmitted(null);
            }}
          />
        </label>
        <Button type="submit" variant="outline" disabled={busy || query.isFetching}>
          Search cities
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {submitted && query.isFetching && <p role="status">Searching cities...</p>}
      {submitted && query.isError && (
        <div role="alert" className="space-y-2 text-sm text-error">
          <p>City search is temporarily unavailable. Your saved location has not changed.</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void query.refetch();
            }}
          >
            Retry city search
          </Button>
        </div>
      )}
      {submitted &&
        !query.isFetching &&
        !query.isError &&
        query.data &&
        (query.data.items.length ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">Choose a listed city</legend>
            {query.data.items.map((city) => (
              <label
                key={city.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-border-main p-2"
              >
                <input
                  type="radio"
                  name="selected-city"
                  value={city.id}
                  checked={selected === city.id}
                  disabled={busy}
                  onChange={() => setSelected(city.id)}
                />
                <span>{cityLabel(city)}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p role="status" className="text-sm text-text-muted">
            No listed cities found. The catalog has limited coverage; try another listed city or
            choose Device location or Off. No nearby city is selected automatically.
          </p>
        ))}
      <Button
        type="button"
        disabled={!selected || busy || query.isFetching || query.isError}
        onClick={() => {
          if (selected) void onSave(selected);
        }}
      >
        Save city
      </Button>
      <p className="text-xs text-text-muted">
        City reference data:{' '}
        <a href="https://www.geonames.org/" className="underline">
          GeoNames
        </a>
        ,{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" className="underline">
          CC BY 4.0
        </a>
        .
      </p>
    </div>
  );
}
