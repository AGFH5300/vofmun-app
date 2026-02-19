import { User } from './types';

const ABBREVIATION_STOP_WORDS = new Set(['of', 'the', 'and', '&']);

export const getUserDelegationLabel = (user?: User | null) =>
  user?.country?.trim() || user?.committee?.trim() || '';

export const abbreviateDelegationLabel = (label?: string | null) => {
  if (!label) return '';

  const normalizedLabel = label.trim();
  if (!normalizedLabel) return '';

  const tokens = normalizedLabel
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .filter((token) => !ABBREVIATION_STOP_WORDS.has(token.toLowerCase()));

  if (tokens.length >= 2) {
    return tokens
      .slice(0, 4)
      .map((token) => token[0]?.toUpperCase() || '')
      .join('');
  }

  const [singleToken = ''] = tokens;
  if (singleToken.length <= 4) return singleToken.toUpperCase();
  return singleToken.slice(0, 3).toUpperCase();
};
