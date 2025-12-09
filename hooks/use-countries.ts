import { useState, useCallback, useEffect } from 'react';

type Country = { name: string };

export const useCountries = (committeeID: string | null) => {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCountries = useCallback(async () => {
    if (!committeeID) {
      setCountries([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/countries?committeeID=${committeeID}`);
      if (response.ok) {
        const data: Array<{ country: string | null }> = await response.json();
        const formatted = data
          .map((entry) => entry.country)
          .filter((country): country is string => Boolean(country))
          .map((country) => ({ name: country }));
        setCountries(formatted);
      } else {
        setCountries([]);
      }
    } catch {
      setCountries([]);
    } finally {
      setLoading(false);
    }
  }, [committeeID]);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const searchCountries = useCallback((query: string) => {
    if (!countries || !query) return new Set<string>();

    const lowerCaseQuery = query.toLowerCase().trim();
    return new Set(
      countries
        .filter((country) =>
          country.name.toLowerCase().includes(lowerCaseQuery)
        )
        .map((country) => country.name)
    );
  }, [countries]);

  return {
    countries,
    loading,
    fetchCountries,
    searchCountries,
  };
};
