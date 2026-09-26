export function formatDate(dateString: string): string {
  // Append T00:00:00 to parse as local time instead of UTC
  // This prevents timezone shift where "2024-01-12" (midnight UTC) becomes Jan 11 in US timezones
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}