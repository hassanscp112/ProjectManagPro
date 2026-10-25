// Display helpers for orders shared by the Record pages.

import { Banknote, ClipboardCheck, FlaskConical, Fuel, Layers, Package, Receipt, Truck, Zap } from 'lucide-react';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { ORDER_TYPES } from '../../utils/OrderEngine.js';

/** One icon per order type (replaces the emoji in the old type picker). */
export const TYPE_ICONS = {
  quick_work: Zap,
  completion: ClipboardCheck,
  concrete_test: FlaskConical,
  soil_test: Layers,
  material: Package,
  payroll: Banknote,
  machinery: Truck,
  fuel: Fuel,
  other_expense: Receipt,
};

export const typeLabel = (type) => ORDER_TYPES[type]?.label || type;

/** '2026-10-25' → '25/10/2026' (day first, as on site paperwork). */
export const formatDay = (iso) => (typeof iso === 'string' && iso ? iso.split('-').reverse().join('/') : '—');

/** recordedAt ISO → local 'HH:MM'. */
export const formatTime = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Quantity with unit for value orders, amount for expenses, else the test result. */
export const orderFigure = (o, lang) => {
  if (o.family === 'value') {
    if (o.quantity != null) return `${formatNumber(o.quantity)}${o.unit ? ` ${o.unit}` : ''}`;
    return o.details?.result || '—';
  }
  return o.amount != null ? compactCurrency(o.amount, lang) : '—';
};

/** Toast text for a just-saved order (pass the i18n `t`). */
export const savedMessage = (t, order) =>
  t(order.status === 'approved' ? 'record.savedApproved' : 'record.savedRecorded', { type: typeLabel(order.type) });

/** What the order is about: its task, else its location. */
export const orderSubject = (o) => (o.taskId ? `${o.taskWbs || ''} ${o.taskName || ''}`.trim() : o.details?.location || '');
