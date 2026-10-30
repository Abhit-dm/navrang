export function addWarrantyDuration(startDate, years) {
  if (!startDate) return '';
  const [year, month, day] = startDate.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return '';
  const targetMonth = year * 12 + month - 1 + Number(years || 0) * 12;
  const targetYear = Math.floor(targetMonth / 12);
  const targetMonthOfYear = targetMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthOfYear + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(targetYear, targetMonthOfYear, Math.min(day, lastDay)));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

export function warrantyYearsValue(warranty) {
  const legacyDuration = Number(warranty.warrantyDuration || 0);
  return legacyDuration > 0
    ? Math.ceil(legacyDuration / 12)
    : Number(warranty.warrantyYears || 0);
}

export function warrantyDurationLabel(warranty) {
  const years = warrantyYearsValue(warranty);
  return years ? `${years} ${years === 1 ? 'year' : 'years'}` : 'No warranty';
}
