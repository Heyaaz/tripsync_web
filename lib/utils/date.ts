export function formatTripDateRange(startDate?: string, endDate?: string, fallbackTripDate?: string) {
  if (startDate && endDate) {
    if (startDate === endDate) return startDate;
    return `${startDate} ~ ${endDate}`;
  }

  if (startDate) return startDate;
  if (fallbackTripDate) return fallbackTripDate;
  return '날짜 미정';
}

export function parseTripDateRange(tripDate?: string) {
  if (!tripDate) return { tripStartDate: undefined, tripEndDate: undefined };

  if (tripDate.includes(' ~ ')) {
    const [tripStartDate, tripEndDate] = tripDate.split(' ~ ');
    return { tripStartDate, tripEndDate };
  }

  return { tripStartDate: tripDate, tripEndDate: tripDate };
}

export function isValidDateRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return false;
  return startDate <= endDate;
}
