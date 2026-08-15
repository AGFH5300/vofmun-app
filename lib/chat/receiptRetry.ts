// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).

export const isRetryableReceiptStatus = (status: number) =>
  status === 429 || (status >= 500 && status <= 599);

export const getReceiptRetryDelay = (
  status: number,
  retryAfterHeader: string | null,
  fallbackMs: number,
): number | null => {
  if (!isRetryableReceiptStatus(status)) return null;

  const retryAfterSeconds = Number.parseInt(retryAfterHeader || '', 10);
  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds * 1000
    : fallbackMs;
};
