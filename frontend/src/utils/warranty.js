export function addWarrantyDuration(startDate, years, months, days) {
  if (!startDate) return '';
  const [year, month, day] = startDate.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return '';
  const targetMonth = year * 12 + month - 1 + Number(years || 0) * 12 + Number(months || 0);
  const targetYear = Math.floor(targetMonth / 12);
  const targetMonthOfYear = targetMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthOfYear + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(targetYear, targetMonthOfYear, Math.min(day, lastDay) + Number(days || 0)));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

export function warrantyDurationLabel(warranty) {
  const years = Number(warranty.warrantyYears ?? Math.floor(Number(warranty.warrantyDuration || 0) / 12));
  const months = Number(warranty.warrantyMonths ?? Number(warranty.warrantyDuration || 0) % 12);
  const days = Number(warranty.warrantyDays || 0);
  const parts = [];
  if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (months) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  return parts.join(', ') || 'No warranty';
}
