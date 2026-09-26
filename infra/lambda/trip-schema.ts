export const TripPlanSchema = {
  name: "TripPlan",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      userId: { type: "string" },
      tripId: { type: "string" },
      serverVersion: { type: "number" },
      id: { type: "string" },
      title: { type: "string" },
      timeZone: { type: "string" },
      dateRange: {
        type: "object",
        properties: {
          start: { type: "string" },
          end: { type: "string" },
        },
        required: ["start", "end"],
        additionalProperties: false,
      },
      places: {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            coordinates: {
              type: "object",
              properties: {
                lat: { type: "number" },
                lng: { type: "number" },
              },
              required: ["lat", "lng"],
              additionalProperties: false,
            },
          },
          required: ["id", "name", "coordinates"],
          additionalProperties: false,
        },
      },
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  kind: {
                    type: "string",
                    enum: ["activity", "lodging", "hold", "note"],
                  },
                  placeId: { type: "string" },
                  start: { type: "string" },
                  end: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["id", "title", "kind"],
                additionalProperties: false,
              },
            },
          },
          required: ["date", "items"],
          additionalProperties: false,
        },
      },
      legs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            fromPlaceId: { type: "string" },
            toPlaceId: { type: "string" },
            mode: {
              type: "string",
              enum: ["drive", "walk", "bike", "fly", "train", "boat", "other"],
            },
          },
          required: ["id", "fromPlaceId", "toPlaceId", "mode"],
          additionalProperties: false,
        },
      },
      aiMeta: {
        type: "object",
        additionalProperties: true,
      },
    },
    required: [
      "userId",
      "tripId",
      "serverVersion",
      "id",
      "title",
      "timeZone",
      "dateRange",
      "places",
      "days",
      "legs",
    ],
  },
} as const;