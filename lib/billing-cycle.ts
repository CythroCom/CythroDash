/**
 * Billing cycle parsing and duration utilities
 * Supports formats: {number}{unit} where unit in [m,h,d,month,y]
 * Example: 1m (minute), 24h, 30d, 1month, 6month, 1y
 */

export type ParsedCycle = {
  input: string;
  quantity: number;
  unit: 'm' | 'h' | 'd' | 'month' | 'y';
  // Duration in milliseconds
  ms: number;
};

const MS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

export function parseBillingCycle(input: string): ParsedCycle {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid billing cycle: expected non-empty string');
  }

  const trimmed = input.trim().toLowerCase();
  // Allow legacy words
  const legacyMap: Record<string, string> = {
    monthly: '1month',
    weekly: '7d',
    daily: '1d',
    hourly: '1h',
    hour: '1h',
    day: '1d',
    week: '7d',
    month: '1month',
    year: '1y',
    yearly: '1y',
  };
  const normalized = legacyMap[trimmed] || trimmed;

  const match = normalized.match(/^([1-9][0-9]*)\s*(m|h|d|month|y)$/);
  if (!match) {
    throw new Error(`Invalid billing cycle format: ${input}`);
  }
  const quantity = parseInt(match[1], 10);
  const unit = match[2] as ParsedCycle['unit'];

  let ms: number;
  switch (unit) {
    case 'm':
      ms = quantity * MS.minute;
      break;
    case 'h':
      ms = quantity * MS.hour;
      break;
    case 'd':
      ms = quantity * MS.day;
      break;
    case 'month':
      // Business rule: 1 month = 30 calendar days
      ms = quantity * 30 * MS.day;
      break;
    case 'y':
      // Business rule: 1 year = 365 calendar days
      ms = quantity * 365 * MS.day;
      break;
    default:
      throw new Error(`Unsupported billing cycle unit: ${unit}`);
  }

  return { input, quantity, unit, ms };
}

export function addCycle(date: Date, cycle: string): Date {
  const { ms } = parseBillingCycle(cycle);
  return new Date(date.getTime() + ms);
}

