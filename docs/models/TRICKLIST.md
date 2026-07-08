# TrickList Data Model

## Overview

A **TrickList** is a collection of tricks that a user wants to learn or track. Users can create multiple lists to organize their skating goals (e.g., "Park Tricks", "Street Session", "Competition Prep").

## Database Schema

**Collection:** `tricklists`

```typescript
interface TrickList {
  _id: ObjectId;           // MongoDB auto-generated ID
  name: string;            // List name (e.g., "skate winston spot!")
  user: DBRef;             // Reference to user document
  tricks: TrickRef[];      // Array of trick references
  completed: number;       // Count of completed tricks (legacy, may be stale)
  isPublic: boolean;       // Whether list is visible to other users
  createdAt: Date;         // When the list was created
}

interface TrickRef {
  _id: ObjectId;           // Reference to trick in 'tricks' collection
}

interface DBRef {
  $ref: string;            // Collection name ("users")
  $id: string;             // User's ObjectId
}
```

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Auto | Unique identifier for the list |
| `name` | string | Yes | Display name of the list |
| `user` | DBRef | Yes | Reference to the owner user |
| `tricks` | TrickRef[] | Yes | Array of trick references |
| `completed` | number | No | Cached count of completed tricks |
| `isPublic` | boolean | No | If true, appears in "Homie TrickLists" |
| `createdAt` | Date | Yes | Timestamp when list was created |

## API Endpoints

### Get User's TrickLists
```
GET /api/listings?userId={userId}
Headers: x-auth-token: {token}
Response: TrickList[] (with enriched trick data)
```

The response includes full trick details:
```typescript
{
  _id: string,
  name: string,
  user: { $ref: "users", $id: string },
  tricks: [{
    _id: string,
    name: string,      // From tricks collection
    checked: string,   // From tricks collection
    // ...other trick fields
  }],
  isPublic: boolean,
  createdAt: string
}
```

### Get Public TrickLists
```
GET /api/listings/public
Headers: x-auth-token: {token} (optional)
Response: TrickList[] (with user info)
```

### Create TrickList
```
POST /api/listings
Headers: x-auth-token: {token}
Body: {
  title: string,      // Note: 'title' maps to 'name' in DB
  userId: string,
  isPublic?: boolean
}
Response: TrickList
```

### Delete TrickList
```
DELETE /api/listings/{listId}
Headers: x-auth-token: {token}
```
Note: This also deletes all tricks in the list.

### Update TrickList Name
```
PUT /api/listings/edit
Headers: x-auth-token: {token}
Body: {
  trickListId: string,
  name: string
}
```

### Toggle Public/Private
```
PUT /api/listings/{listId}/visibility
Headers: x-auth-token: {token}
Body: {
  isPublic: boolean
}
```

### Get TrickList Count
```
GET /api/listings/countTrickLists?userId={userId}
Headers: x-auth-token: {token}
Response: { totalTrickLists: number }
```

## Frontend Type Definition

```typescript
// src/types/trickbook.ts

export interface TrickList {
  _id: string;
  name: string;
  tricks: TrickListItem[];
  isPublic?: boolean;
  user?: {
    $id: string;
    name?: string;
    imageUri?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}
```

## Progress Calculation

The frontend calculates progress based on trick statuses:

```typescript
function calculateProgress(tricks: TrickListItem[]): ListProgress {
  const total = tricks.length;
  let completed = 0;

  tricks.forEach(trick => {
    if (trick.checked === 'Complete' || trick.checked === 'Completed') {
      completed++;
    }
  });

  return {
    total,
    completed,
    percentage: Math.round((completed / total) * 100)
  };
}
```

## Relationships

```
User (1) ──────> (N) TrickList (1) ──────> (N) Trick
                       │
                       └── isPublic ──> Visible in "Homie TrickLists"
```

## Example Document

```json
{
  "_id": "668c6800d3b37f7d802ef4ce",
  "name": "skate winston spot!",
  "user": {
    "$ref": "users",
    "$id": "63c5fd35a86c84e34777f14a"
  },
  "tricks": [
    { "_id": "668c6877d3b37f7d802ef4cf" },
    { "_id": "668c6890d3b37f7d802ef4d0" },
    { "_id": "668c68a5d3b37f7d802ef4d1" },
    { "_id": "668c68b2d3b37f7d802ef4d2" }
  ],
  "completed": 2,
  "isPublic": false,
  "createdAt": "2024-07-08T15:00:00.000Z"
}
```

## UI Display

### My TrickLists View
Each list card shows:
- List name (bold)
- Progress: "X/Y Landed"
- Yellow progress bar

### TrickList Detail View
- Header: "< My Trick Lists {list name}"
- List of tricks with swipe actions
- Yellow "+ ADD TRICK" button at bottom

## Related Models

- [Trick](./TRICK.md) - Individual tricks in a list
- [User](./USER.md) - Owner of trick lists
