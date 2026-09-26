# Road Trip Planner Frontend - Development Guidelines

## Core Principles

1. **Strict TypeScript everywhere** - No `any` types, enable all strict checks
2. **Every component tested using React Testing Library** - 100% test coverage goal
3. **Build the app in a way that is easy to change** - Everything modular and extensible

## Development Standards

### TypeScript Configuration
- Use strict mode with all checks enabled
- No implicit `any` types
- Enable `noUncheckedIndexedAccess` for safer array/object access
- All functions must have explicit return types
- Use type imports: `import type { ... }`

### Testing Requirements
- Every component must have a corresponding `.test.tsx` file
- Test user interactions, not implementation details
- Use Testing Library queries (getByRole, getByText, etc.)
- Mock API calls and external dependencies
- Aim for meaningful tests that catch real bugs

### Architecture Patterns

#### Component Structure
```
ComponentName/
├── ComponentName.tsx       # Component implementation
├── ComponentName.test.tsx  # Tests
├── ComponentName.types.ts  # TypeScript interfaces
├── ComponentName.styles.ts # Styled components or style utilities
└── index.ts               # Public exports
```

#### Separation of Concerns
- **Components**: UI rendering only, no business logic
- **Hooks**: Encapsulate stateful logic and side effects
- **Services**: API calls and external integrations
- **Utils**: Pure functions and helpers
- **Types**: Shared TypeScript interfaces

### Modularity Guidelines

1. **Single Responsibility**: Each module does one thing well
2. **Dependency Injection**: Pass dependencies as props/params
3. **Composition over Inheritance**: Use hooks and HOCs
4. **Interface Segregation**: Small, focused interfaces
5. **Open/Closed**: Open for extension, closed for modification

### Code Style

- Prefer function components with hooks
- Use named exports for better refactoring
- Destructure props at function signature
- Keep components under 150 lines
- Extract complex logic to custom hooks
- Use early returns to reduce nesting

### State Management

- Local state for component-specific data
- TanStack Query for server state
- Context for cross-cutting concerns (auth, theme)
- No global state management library initially

### API Integration

- All API calls through centralized client
- Type all request/response data
- Handle errors consistently
- Use optimistic updates where appropriate

### Error Handling

- Error boundaries for component trees
- Typed error responses from API
- User-friendly error messages
- Log errors for debugging

### Performance

- Lazy load routes and heavy components
- Memoize expensive computations
- Use React.memo sparingly and purposefully
- Virtualize long lists

### Accessibility

- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Screen reader friendly

## File Organization

```
src/
├── components/     # Reusable UI components
│   ├── common/    # Generic components
│   ├── auth/      # Authentication components
│   └── trip/      # Trip-related components
├── hooks/         # Custom React hooks
├── services/      # API and external services
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
├── pages/         # Route page components
├── styles/        # Global styles and themes
└── test/          # Test utilities and setup
```

## Commands to Run

- `npm test` - Run tests before committing
- `npm run typecheck` - Verify TypeScript types
- `npm run lint` - Check code style
- `npm run build` - Ensure production build works

## Important Notes

- Never store sensitive data in frontend code
- All auth tokens handled by backend (HttpOnly cookies)
- No userId in request bodies (extracted from JWT by backend)
- Use environment variables for configuration
- Follow React best practices and hooks rules

## Tech Stack Reference

- **React 19** with TypeScript
- **Vite** for build tooling
- **TanStack Query** for data fetching
- **React Router** for routing
- **Tailwind CSS** for styling
- **React Testing Library** for tests
- **Vitest** as test runner

## Backend Integration

- Base URL: Same origin (no CORS)
- Auth endpoints: `/auth/*`
- API endpoints: `/api/*`
- Always include credentials in fetch
- Handle 401 errors by redirecting to login