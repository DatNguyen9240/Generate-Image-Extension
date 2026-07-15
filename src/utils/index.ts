import clsx, { type ClassValue } from 'clsx';
import dayjs from 'dayjs';

export const cn = (...values: ClassValue[]) => clsx(values);
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const formatDate = (value: string) => dayjs(value).format('MMM D, YYYY · HH:mm');
export const sanitizeText = (value: unknown, max = 100_000) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .slice(0, max);
