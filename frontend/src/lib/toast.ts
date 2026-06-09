import baseToast from 'react-hot-toast';
import type { AxiosError } from 'axios';

export const toast = baseToast;

/** Drop-in replacement for the old per-page showToast() helpers. Maps the
 *  three legacy variants onto react-hot-toast styles. Use this anywhere a
 *  page used to keep a local toast state + inline div. */
export function showToast(
  msg: string,
  type: 'success' | 'error' | 'info' = 'success',
) {
  if (type === 'success') return baseToast.success(msg);
  if (type === 'error') return baseToast.error(msg);
  return baseToast(msg, { icon: 'ℹ️' });
}

/** Pull the most human-readable message out of an axios/Nest error response. */
export function extractApiError(err: unknown, fallback = 'เกิดข้อผิดพลาด'): string {
  const e = err as AxiosError<{ message?: string | string[] }>;
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg[0] ?? fallback;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (e?.message) return e.message;
  return fallback;
}

export function toastError(err: unknown, fallback = 'เกิดข้อผิดพลาด') {
  baseToast.error(extractApiError(err, fallback));
}
