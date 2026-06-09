export function calculateEndDate(startDate: string, durationMonths: number): string {
  const date = new Date(startDate)
  const day = date.getDate()
  date.setMonth(date.getMonth() + durationMonths)
  if (date.getDate() !== day) {
    date.setDate(0)
  }
  return date.toISOString().split('T')[0]
}
