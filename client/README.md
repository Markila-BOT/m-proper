# Client

A React application with React Query (TanStack Query) integration for efficient data fetching and state management.

## Features

- **React Query Integration**: Efficient data fetching with caching, background updates, and optimistic updates
- **Supabase Integration**: Real-time database operations through the server API
- **TypeScript**: Full type safety with shared types
- **Modern UI**: Built with Tailwind CSS and Radix UI components
- **Real-time Updates**: Automatic cache invalidation and refetching

## React Query Setup

### Query Client Configuration

The application uses TanStack Query v5 with the following configuration:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### API Service Layer

Located in `src/lib/api.ts`:

- **Properties API**: Functions for fetching and creating properties
- **Query Keys**: Centralized query key management
- **Error Handling**: Consistent error handling across all API calls

### Custom Hooks

Located in `src/hooks/useProperties.ts`:

- `useProperties()`: Basic query hook for fetching properties
- `useCreateProperty()`: Mutation hook for creating properties
- `usePropertiesWithStates()`: Enhanced hook with loading/error states

### Components

- **PropertiesList**: Demonstrates React Query integration with:
  - Loading states
  - Error handling
  - Optimistic updates
  - Cache invalidation
  - Real-time data synchronization

## Usage

### Fetching Data

```typescript
import { useProperties } from "../hooks/useProperties";

function MyComponent() {
  const { data: properties, isLoading, error } = useProperties();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {properties?.map((property) => (
        <div key={property.id}>{property.name}</div>
      ))}
    </div>
  );
}
```

### Creating Data

```typescript
import { useCreateProperty } from "../hooks/useProperties";

function CreatePropertyForm() {
  const createProperty = useCreateProperty();

  const handleSubmit = async (data) => {
    try {
      await createProperty.mutateAsync(data);
      // Cache is automatically invalidated and refetched
    } catch (error) {
      console.error("Failed to create property:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={createProperty.isPending}>
        {createProperty.isPending ? "Creating..." : "Create Property"}
      </button>
    </form>
  );
}
```

## Development

To start the development server:

```bash
bun run dev
```

The application will be available at `http://localhost:5173`.

## React Query DevTools

React Query DevTools are included in development mode. You can:

- Inspect queries and mutations
- View cache state
- Manually trigger refetches
- Monitor performance

## API Endpoints

The client connects to the server API at `http://localhost:3000`:

- `GET /properties` - Fetch all properties
- `POST /properties` - Create a new property

## Environment Variables

Make sure the server is running with proper Supabase configuration for the React Query features to work correctly.
