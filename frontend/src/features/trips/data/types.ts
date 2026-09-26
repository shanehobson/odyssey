export interface TripListItem {
  tripId: string;
  title: string | null;
  dateRange: {
    start: string;
    end: string;
  } | null;
  preferences?: {
    tripPace?: 'relaxed' | 'moderate' | 'fast';
    budgetLevel?: number;
    include?: {
      hotels: boolean;
      restaurants: boolean;
      camping: boolean;
    };
  };
}

export interface TripListPage {
  items: TripListItem[];
  nextCursor?: string | null;
}