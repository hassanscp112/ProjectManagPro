// Shared helpers for the certificates screens (hooks and labels; components
// live in CertificateParts.jsx).

import { useEffect, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { CERTIFICATES_STORAGE_KEY, loadCertificates } from '../../utils/Certificates.js';
import { projectKey } from '../../utils/Projects.js';
import { onStoreChange } from '../../utils/storeEvents.js';

/**
 * The open project's certificates store, re-read whenever it changes (its
 * owner announces every write; another tab shows up as a storage event).
 */
export function useCertificatesStore() {
  const [doc, setDoc] = useState(loadCertificates);
  useEffect(() => {
    const is = (key) => key === null || key === CERTIFICATES_STORAGE_KEY || key === projectKey(CERTIFICATES_STORAGE_KEY);
    const reload = (key) => is(key) && setDoc(loadCertificates());
    const off = onStoreChange(reload);
    const onStorage = (e) => reload(e.key);
    window.addEventListener('storage', onStorage);
    return () => {
      off();
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return doc;
}

/** Who a certificate is for: the contractor's name, or the main contract. */
export const partyName = (cert, registries, t) =>
  cert.kind === 'employer'
    ? t('certificates.kindEmployer')
    : registries?.contractors?.find((c) => c.id === cert.contractorId)?.name || t('certificates.unknownContractor');

/** Amount cell text: '—' when there is no figure (a missing rate). */
export const money = (n) => (n == null ? '—' : formatNumber(n));

/** The currency label of the certificates (settings), else IQD in the UI language. */
export const useCurrency = (settings) => {
  const { t } = useI18n();
  return settings?.currencyLabel?.trim() || t('orders.currencySuffix');
};
