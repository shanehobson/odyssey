const CREATE_MESSAGE_MAP: Record<string, string> = {
  "Initializing trip planning": "🚀 Starting your adventure planning",
  "Planning trip itinerary": "🗺️ Crafting your perfect itinerary",
  "Generating places": "📍 Finding amazing destinations",
  "Creating travel routes": "🛣️ Mapping your journey",
  "Saving trip": "💾 Saving your new trip",
  "Trip generation complete": "✅ Your trip is ready!",
};

const UPDATE_MESSAGE_MAP: Record<string, string> = {
  "Initializing trip planning": "🔄 Preparing to update your trip",
  "Planning trip itinerary": "✏️ Refining your itinerary",
  "Generating places": "📍 Adding new destinations",
  "Creating travel routes": "🗺️ Updating your route",
  "Saving trip": "💾 Saving your changes",
  "Trip generation complete": "✅ Your trip has been updated!",
};

export function getCreateStatusMessage(originalMessage: string): string {
  const dayMatch = originalMessage.match(/Planning day (\d+)/);
  if (dayMatch) {
    return `📅 Planning day ${dayMatch[1]} of your adventure`;
  }
  return CREATE_MESSAGE_MAP[originalMessage] || `🎯 ${originalMessage}`;
}

export function getUpdateStatusMessage(originalMessage: string): string {
  const dayMatch = originalMessage.match(/Planning day (\d+)/);
  if (dayMatch) {
    return `📝 Updating day ${dayMatch[1]}`;
  }
  return UPDATE_MESSAGE_MAP[originalMessage] || `⚙️ ${originalMessage}`;
}
