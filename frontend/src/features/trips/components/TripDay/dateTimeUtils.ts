export function formatDate(dateString: string): string {
  // Append T00:00:00 to parse as local time instead of UTC
  // This prevents timezone shift where "2024-01-12" (midnight UTC) becomes Jan 11 in US timezones
  const date = new Date(dateString + "T00:00:00");
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
  });
  return `${weekday} ${monthDay}`;
}

export function formatTime(timeString?: string): string {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  if (!hours || !minutes) return timeString;
  const date = new Date();
  date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function shortenLocationName(location: string): string {
  if (location.length <= 30) {
    return location;
  }

  if (location.includes(",")) {
    const parts = location.split(",");
    if (parts.length > 1) {
      const shortenedLocation = parts.slice(0, -1).join(",").trim();
      if (shortenedLocation.length > 0) {
        return shortenedLocation;
      }
    }
  }

  return location.substring(0, 27) + "...";
}
