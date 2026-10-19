/**
 * Calculates start and end timestamps based on plan duration.
 * @param {Date|string} fromDate 
 * @param {number} value 
 * @param {'day'|'month'|'year'} unit 
 * @returns {{ startDate: Date, endDate: Date }}
 */
function calculateMembershipDates(fromDate, value, unit) {
  const start = new Date(fromDate);
  const end = new Date(start);

  if (unit === 'day') {
    end.setDate(end.getDate() + value);
  } else if (unit === 'month') {
    const currentMonth = end.getMonth();
    end.setMonth(currentMonth + value);
    // Fix overflow: if 31st pushed into next month, snap to last day of intended month
    if (end.getMonth() !== (currentMonth + value) % 12) {
      end.setDate(0);
    }
  } else if (unit === 'year') {
    end.setFullYear(end.getFullYear() + value);
  }

  // End of day: 23:59:59.999
  end.setHours(23, 59, 59, 999);

  return { startDate: start, endDate: end };
}

module.exports = { calculateMembershipDates };