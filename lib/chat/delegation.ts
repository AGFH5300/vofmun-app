import { User } from './types';

const ABBREVIATION_STOP_WORDS = new Set(['of', 'the', 'and', '&']);

const DELEGATION_SHORT_LABEL_OVERRIDES: Record<string, string> = {
  'kingdom of saudi arabia': 'KSA',
  "people's republic of china": 'China',
  'democratic people\'s republic of korea': 'North Korea',
  'republic of korea': 'South Korea',
  'united states of america': 'United States',
  'russian federation': 'Russia',
  'french republic': 'France',
  'federal republic of germany': 'Germany',
  'federative republic of brazil': 'Brazil',
  'arab republic of egypt': 'Egypt',
  'united mexican states': 'Mexico',
  'republic of türkiye': 'Türkiye',
  'republic of turkey': 'Türkiye',
  'socialist republic of viet nam': 'Vietnam',
  'socialist republic of vietnam': 'Vietnam',
  'people\'s republic of bangladesh': 'Bangladesh',
  'bolivarian republic of venezuela': 'Venezuela',
  'state of israel': 'Israel',
  'state of palestine': 'Palestine',
  'state of qatar': 'Qatar',
  'swiss confederation': 'Switzerland',
  'kingdom of the netherlands': 'Netherlands',
  'hellenic republic (greece)': 'Greece',
  'argentine republic': 'Argentina',
  'federal democratic republic of ethiopia': 'Ethiopia',
  'islamic republic of pakistan': 'Pakistan',
  'islamic republic of iran': 'Iran',
  'islamic republic of afghanistan': 'Afghanistan',
  'syrian arab republic': 'Syria',
  'democratic republic of congo': 'Congo',
  'republic of the philippines': 'Philippines',
  'republic of the union of myanmar': 'Myanmar',
  'commonwealth of australia': 'Australia',
  'kingdom of norway': 'Norway',
  'kingdom of sweden': 'Sweden',
  'kingdom of spain': 'Spain',
  'kingdom of thailand': 'Thailand',
  'kingdom of cambodia': 'Cambodia',
  'kingdom of morocco': 'Morocco',
  'kingdom of belgium': 'Belgium',
  'republic of south africa': 'South Africa',
  'federal republic of nigeria': 'Nigeria',
  'republic of nigeria': 'Nigeria'
};

export const getUserDelegationLabel = (user?: User | null) =>
  user?.country?.trim() || user?.committee?.trim() || '';

export const abbreviateDelegationLabel = (label?: string | null) => {
  if (!label) return '';

  const normalizedLabel = label.trim();
  if (!normalizedLabel) return '';

  const loweredLabel = normalizedLabel.toLowerCase();
  if (DELEGATION_SHORT_LABEL_OVERRIDES[loweredLabel]) {
    return DELEGATION_SHORT_LABEL_OVERRIDES[loweredLabel];
  }

  const compactLabel = normalizedLabel
    .replace(/^republic of\s+/i, '')
    .replace(/^federal republic of\s+/i, '')
    .replace(/^federative republic of\s+/i, '')
    .replace(/^federal democratic republic of\s+/i, '')
    .replace(/^democratic socialist republic of\s+/i, '')
    .replace(/^socialist republic of\s+/i, '')
    .replace(/^islamic republic of\s+/i, '')
    .replace(/^bolivarian republic of\s+/i, '')
    .replace(/^arab republic of\s+/i, '')
    .replace(/^commonwealth of\s+/i, '')
    .replace(/^kingdom of\s+/i, '')
    .replace(/^state of\s+/i, '')
    .replace(/^federation of\s+/i, '')
    .replace(/^federal\s+/i, '')
    .replace(/^democratic\s+/i, '')
    .replace(/^people's\s+/i, '')
    .replace(/^the\s+/i, '')
    .trim();

  if (compactLabel && compactLabel.length >= 4) {
    return compactLabel;
  }

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
