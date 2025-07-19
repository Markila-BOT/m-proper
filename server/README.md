# Server

A Hono-based API server with Supabase integration.

## Setup

To install dependencies:

```sh
bun install
```

To run:

```sh
bun run dev
```

Open http://localhost:3000

## API Endpoints

### Properties

#### POST /properties

Create a new property.

**Request Body:**

```json
{
  "name": "Property Name",
  "address": "Property Address",
  "type": "residential" | "commercial",
  "units": 2, // optional
  "isActive": true // optional, defaults to true
}
```

**Response:**

```json
{
  "message": "Property created successfully",
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Property Name",
    "address": "Property Address",
    "type": "residential",
    "units": 2,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /properties

Get all properties.

**Response:**

```json
{
  "message": "Properties fetched successfully",
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Property Name",
      "address": "Property Address",
      "type": "residential",
      "units": 2,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Database Setup

Run the SQL commands in `schema.sql` in your Supabase SQL editor to create the properties table.

## Environment Variables

Set these environment variables for Supabase connection:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Testing

Run the test script to verify the endpoints:

```sh
node test-properties.js
```
