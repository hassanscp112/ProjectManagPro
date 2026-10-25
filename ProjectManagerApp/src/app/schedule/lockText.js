// Why a grid cell is locked (scheduleModel.fieldLock reasons), as tooltip
// text — shared by the Gantt and the full task details page.

export const lockText = (t, lock, field) => {
  if (lock === 'boq') return t('gantt.lockedFromDetails');
  if (lock === 'orders') return t('gantt.autoFromWorkOrders');
  if (lock === 'dependency') return t('schedule.lockDependency');
  if (lock === 'signed') {
    if (field === 'unitPrice') return t('gantt.lockedContractPrice');
    if (field === 'unit') return t('gantt.lockedContractUnit');
    return t('gantt.lockedContractQty');
  }
  return '';
};
