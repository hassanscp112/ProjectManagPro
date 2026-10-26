// Words and links for the order rules shown on record screens: why an
// order may not be approved, and the issued certificates that lock it.

/** approvalBlock() code → dictionary key ('…Body' adds the explanation). */
export const BLOCK_REASON = {
  own: 'record.cannotApproveOwn',
  role: 'record.cannotApproveRole',
  certified: 'record.cannotApproveCertified',
};

export const certificateHref = (ref) => `#/finance/certificates/${encodeURIComponent(ref.id)}`;

/** "Certificate No. 2 · <contractor>" / "Main-contract certificate No. 1". */
export const certificateLabel = (t, ref, registries) =>
  ref.kind === 'employer'
    ? t('record.certificateMain', { number: ref.number })
    : t('record.certificateSub', {
        number: ref.number,
        party: registries?.contractors?.find((c) => c.id === ref.contractorId)?.name || t('certificates.unknownContractor'),
      });
