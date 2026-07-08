# Trick Data Model

## Overview

A **Trick** represents an individual skateboarding trick that a user adds to their TrickList. Tricks are stored in the MongoDB `tricks` collection and are referenced from TrickLists.

## Database Schema

**Collection:** `tricks`

```typescript
interface Trick {
  _id: ObjectId;           // MongoDB auto-generated ID
  list_id: string;         // Parent TrickList ID (references tricklists._id)
  name: string;            // Trick name (e.g., "Kickflip", "bs shuv")
  link: string;            // Video link (YouTube, Instagram, etc.) - optional
  notes: string;           // User notes about the trick - optional
  checked: string;         // Status: "To Do" | "Complete" | "Completed" | "Learning"
  trickipediaId?: string;  // Links to Trickipedia trick._id for "View Tutorial" feature
  createdAt: Date;         // When the trick was added
}
```

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Auto | Unique identifier for the trick |
| `list_id` | string | Yes | The ID of the TrickList this trick belongs to |
| `name` | string | Yes | Display name of the trick |
| `link` | string | No | URL to a tutorial or example video |
| `notes` | string | No | User's personal notes about learning the trick |
| `checked` | string | Yes | Current completion status |
| `trickipediaId` | string | No | Links to Trickipedia entry for "View Tutorial" feature |
| `createdAt` | Date | Yes | Timestamp when trick was added |

## Status Values

The `checked` field accepts the following values:

| Value | Description |
|-------|-------------|
| `"To Do"` | Trick has not been attempted yet |
| `"Learning"` | User is actively practicing the trick |
| `"Complete"` | User has landed the trick |
| `"Completed"` | Alternate spelling for "Complete" (legacy) |

## API Endpoints

### Get Tricks in a List
```
GET /api/listing?list_id={listId}
Headers: x-auth-token: {token}
Response: Trick[]
```

### Add Trick to List
```
PUT /api/listing
Headers: x-auth-token: {token}
Body: {
  list_id: string,
  name: string,
  link?: string,
  notes?: string,
  checked: "To Do",
  trickipediaId?: string   // Optional: link to Trickipedia entry
}
```

### Update Trick Status
```
PUT /api/listing/update
Headers: x-auth-token: {token}
Body: {
  _id: string,      // Trick ID
  checked: string   // New status
}
```

### Edit Trick Details
```
PUT /api/listing/edit
Headers: x-auth-token: {token}
Body: {
  trickId: string,
  name: string,
  link?: string,
  notes?: string
}
```

### Delete Trick
```
DELETE /api/listing/{trickId}
Headers: x-auth-token: {token}
```

## Frontend Type Definition

```typescript
// src/types/trickbook.ts

export type LegacyTrickStatus = 'To Do' | 'Complete' | 'Completed' | 'Learning';
export type TrickStatus = 'Not Started' | 'Learning' | 'Landed' | 'Mastered';

export interface TrickListItem {
  _id: string;
  name: string;
  link?: string;
  notes?: string;
  checked: LegacyTrickStatus;  // Backend status format
  status?: TrickStatus;         // Frontend status format (computed)
  trickipediaId?: string;       // Links to Trickipedia trick._id for "View Tutorial" feature
  difficulty?: TrickDifficulty;
  createdAt?: string;
}
```

## Status Mapping

The frontend maps backend `checked` values to user-friendly status:

| Backend (`checked`) | Frontend Display |
|--------------------|------------------|
| `"To Do"` | "TO DO" (gray button) |
| `"Learning"` | "TO DO" (gray button) |
| `"Complete"` | "COMPLETE" (yellow button) |
| `"Completed"` | "COMPLETE" (yellow button) |

## Relationships

```
User (1) ──────> (N) TrickList (1) ──────> (N) Trick
```

- A User can have many TrickLists
- A TrickList can have many Tricks
- A Trick belongs to exactly one TrickList

## Example Documents

### Manually Added Trick
```json
{
  "_id": "668c6877d3b37f7d802ef4cf",
  "list_id": "668c6800d3b37f7d802ef4ce",
  "name": "bs shuv",
  "link": "https://www.youtube.com/watch?v=example",
  "notes": "Keep shoulders level, pop with back foot",
  "checked": "Complete",
  "createdAt": "2024-07-08T15:30:00.000Z"
}
```

### Trick Added from Trickipedia
```json
{
  "_id": "668c6877d3b37f7d802ef4d0",
  "list_id": "668c6800d3b37f7d802ef4ce",
  "name": "Kickflip",
  "link": "https://www.youtube.com/watch?v=kickflip-tutorial",
  "notes": "From Trickipedia: Flatground - Intermediate",
  "checked": "To Do",
  "trickipediaId": "66a1b2c3d4e5f67890123456",
  "createdAt": "2024-07-10T12:00:00.000Z"
}
```

When `trickipediaId` is present, the mobile app and web app show a "View Tutorial in Trickipedia" button that navigates to the full trick tutorial with steps, videos, and tips.

## Related Models

- [TrickList](./TRICKLIST.md) - Parent container for tricks
- [User](./USER.md) - Owner of trick lists
