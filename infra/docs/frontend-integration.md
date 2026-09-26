# Frontend integration

Essential integration guide for building a frontend application with the Trip Planner backend infrastructure.

## Architecture Overview

The backend is deployed as a **Lambda Function with CloudFront distribution** serving both frontend assets and API routes:

- **Frontend**: Served from S3 via CloudFront
- **API**: Lambda Function URL (response streaming) behind CloudFront
- **Authentication**: AWS Cognito with session-based auth

## URLs

### Production (CloudFront)
- **Frontend**: `https://{cloudfront-domain}/` (check CDK output: CloudFrontDomainName)
- **API**: `https://{cloudfront-domain}/api/`
- **Auth**: `https://{cloudfront-domain}/auth/`

### Development 
The Vite dev server in `frontend/` proxies `/api` and `/auth` to a deployed backend and attaches the CloudFront shared secret (`DEV_PROXY_BFF_AUTH`), so the HttpOnly cookie works on `localhost`. See `frontend/.env.example`.

## Authentication

### Session-Based Flow

The backend uses **HttpOnly session cookies** with AWS Cognito integration.

### Auth Endpoints

```javascript
// 1. Sign Up
POST /auth/signup
Body: { email, password, name? }
Response: { success: true, userSub, message }

// 2. Confirm Email
POST /auth/confirm  
Body: { email, confirmationCode }
Response: { success: true, message }

// 3. Sign In
POST /auth/signin
Body: { email, password }
Options: { credentials: 'include' }
Response: { success: true, message } + sets session cookie

// 4. Get Current User
GET /auth/user
Options: { credentials: 'include' }
Response: { userId, authenticated: true, message }

// 5. Logout
POST /auth/logout
Options: { credentials: 'include' }
Response: { success: true, message } + clears cookies
```

### Important Notes
- Always include `credentials: 'include'` in fetch requests
- Session cookies are HttpOnly and automatically managed
- User ID is extracted server-side from session token
- CSRF tokens required for mutating operations (POST/DELETE)

## API Integration

### Base API Configuration

```javascript
const apiRequest = async (endpoint, options = {}) => {
  const config = {
    credentials: 'include', // Essential for session cookies
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  };

  // Add CSRF token for mutations
  if (['POST', 'DELETE'].includes(options.method)) {
    // Get CSRF from cookie or /auth/user response
    const csrfToken = getCsrfToken(); 
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  }
  
  const response = await fetch(`/api${endpoint}`, config);
  if (response.status === 401) window.location.href = '/login';
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response.json();
};
```

## API Endpoints

### Core Endpoints
```javascript
// Health check (no auth required)
GET /api/health → "ok"

// Trip management (auth required)
GET /api/trips?limit=20&cursor=abc → { items, nextCursor, total }
GET /api/trip/{tripId} → TripPlan object  
POST /api/trip → { ok: true, trip: TripPlan }
DELETE /api/trip/{tripId} → 204 No Content
```

### Trip Operations

```javascript
// List trips with pagination
const getTrips = async (limit = 20, cursor = null) => {
  const params = new URLSearchParams({ limit });
  if (cursor) params.set('cursor', cursor);
  return apiRequest(`/trips?${params}`);
};

// Get single trip
const getTrip = (tripId) => apiRequest(`/trip/${tripId}`);

// Create trip
const createTrip = (tripData) => apiRequest('/trip', {
  method: 'POST',
  body: JSON.stringify({
    intent: 'create',
    tripInput: 'Description of desired trip',
    preferences: {
      dateRange: { start: '2024-06-01', end: '2024-06-05' },
      include: { hotels: true, restaurants: true, camping: false },
      tripPace: 'moderate', // 'relaxed' | 'moderate' | 'packed'
      budgetLevel: 3, // 1-5 scale
      units: 'imperial',
      currency: 'USD',
      timeZone: 'America/Los_Angeles'
    }
  })
});

// Update trip 
const updateTrip = (tripId, updates) => apiRequest('/trip', {
  method: 'POST', 
  body: JSON.stringify({ tripId, intent: 'update', ...updates })
});

// Delete trip
const deleteTrip = (tripId) => apiRequest(`/trip/${tripId}`, { method: 'DELETE' });
```

## Data Structures

### Key Types

```typescript
// Trip request for create/update operations
interface TripRequest {
  intent: 'create' | 'update' | 'append' | 'regenerate-partial';
  tripInput: string; // User's trip description  
  tripId?: string; // Required for updates
  preferences: TripPreferences;
}

// Trip preferences
interface TripPreferences {
  dateRange: { start: string; end: string }; // ISO dates
  include: { hotels: boolean; restaurants: boolean; camping: boolean };
  tripPace: 'relaxed' | 'moderate' | 'packed';
  budgetLevel: 1 | 2 | 3 | 4 | 5; // 1=budget, 5=luxury
  units?: 'imperial' | 'metric';
  currency?: string;
  timeZone?: string; // IANA timezone
}

// Complete trip plan response
interface TripPlan {
  userId: string;
  tripId: string;
  serverVersion: number;
  title: string;
  dateRange: { start: string; end: string };
  preferences: TripPreferences; // Stored for form prepopulation
  
  // Trip content
  places: Record<string, Place>;    // Referenced locations
  days: Day[];                      // Daily itinerary  
  legs: Leg[];                      // Travel between places
  actionItems: ActionItem[];        // Todo items
}

// Basic structures
interface Place {
  id: string; name: string;
  coords: { lat: number; lng: number };
  address?: string; rating?: number; priceLevel?: number;
}

interface Day {
  date: string; // ISO date
  items: DayItem[];
}

interface DayItem {
  id: string; title: string;
  kind: 'activity' | 'lodging' | 'hold' | 'note';
  placeId?: string; start?: string; end?: string;
}
```

## React Integration

### Essential Hooks

```typescript
// Auth hook with session management
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/auth/user', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email, password) => {
    const response = await fetch('/auth/signin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (response.ok) {
      const userData = await fetch('/auth/user', { credentials: 'include' }).then(r => r.json());
      setUser(userData);
    }
    return response.ok;
  };

  return { user, loading, signIn, isAuthenticated: !!user };
};

// Trips hook with pagination
const useTrips = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    
    try {
      const { items, nextCursor } = await getTrips(20, cursor);
      setTrips(prev => [...prev, ...items]);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading]);

  return { trips, loading, hasMore, loadMore };
};
```

## Deployment & Configuration

### Deployment Process

```bash
# 1. Get CloudFront domain from CDK outputs
npm run cdk deploy

# 2. Build React app
npm run build

# 3. Get S3 bucket name from CDK output: WebBucketName
aws s3 sync build/ s3://${WEB_BUCKET_NAME} --delete

# 4. Invalidate CloudFront cache (get distribution ID from CDK output)
aws cloudfront create-invalidation --distribution-id ${DISTRIBUTION_ID} --paths "/*"
```

### Error Handling

```typescript
// Handle common API errors
const handleApiError = (response: Response) => {
  switch (response.status) {
    case 401: window.location.href = '/login'; break;
    case 403: throw new Error('Permission denied');
    case 404: throw new Error('Resource not found');
    case 502: throw new Error('AI generation failed. Please retry.');
    default: throw new Error(`API Error: ${response.status}`);
  }
};
```

### Security Notes

- **Session Management**: HttpOnly cookies, no JWT exposure to frontend
- **CORS**: Same-origin requests via CloudFront distribution
- **CSRF**: Required for POST/DELETE operations
- **Headers**: Include `credentials: 'include'` for all authenticated requests

### Getting Started

1. **Deploy Infrastructure**: `npm run cdk deploy`
2. **Note URLs**: Save CloudFront domain and Lambda URL from CDK outputs
3. **Test Backend**: Use CloudFront URL for all development and testing
4. **Build Frontend**: Implement auth flows and API integration
5. **Deploy**: Upload to S3 and invalidate CloudFront cache

For detailed API reference, see [API_README.md](./API_README.md)