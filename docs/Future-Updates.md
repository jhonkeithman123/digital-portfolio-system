## Completed Features ✅

- [x] Fix the signup email to only accept email format
- [x] Add student ID field to signup
- [x] Add logic to change the username

## In Progress 🚧

- [ ] Add portfolio page to store all activities

## Pending Features 📋

- [ ] Make a showcase (Excluded for now)
- [ ] Add activity type classification (Quiz, Assignment, Project)
  - Frontend: Add type selector in activity creation/upload
  - Frontend: Filter activities by type in dashboard and portfolio
  - Frontend: Display appropriate icons for each type (📝 Quiz, 📄 Assignment, 🎨 Project)
  - Backend: Add `activity_type` column to activities table
  - Backend: API endpoints to support type filtering
  - Backend: Validation for activity types

## Future Enhancements 💡

- Make the invite improve sorting of students
- Grade analytics dashboard
- Make a showcase (Excluded for now)
  <!-- - Export portfolio as PDF -->
  <!-- - Activity sharing capabilities -->
  <!-- - Achievement badges system -->
  <!-- - Progress tracking with charts -->
  <!-- - Profile customization -->
  <!-- - Activity comments/feedback -->

# Activity Type Classification Implementation Plan

## Overview

Add support for three activity types: Quiz, Assignment, and Project to organize student work.

## Frontend Changes

### 1. Type Definitions (Already Updated)

```typescript
// types/models.ts
type ActivityType = "quiz" | "assignment" | "project";
```

### 2. Activity Creation/Upload

- Add a dropdown/radio selector for activity type
- Default to "assignment" if not specified
- Include type in the activity creation payload

### 3. Dashboard Updates

```tsx
// Dashboard.tsx - Already has foundation, just need to:
- Update icon rendering to handle all three types
- Ensure type filtering works with real data
```

### 4. Portfolio Page

```tsx
// Portfolio.tsx - Already has complete implementation:
- Filter buttons for each type (already exists)
- Type-specific styling (already exists)
- Icons for each type (already exists)
```

### 5. Activity Upload Component

- Add type selector before/during file upload
- Validate type selection
- Pass type to backend

## Backend Changes

### 1. Database Schema

```sql
-- Add activity_type column to activities table
ALTER TABLE activities
ADD COLUMN activity_type VARCHAR(20) DEFAULT 'assignment'
CHECK (activity_type IN ('quiz', 'assignment', 'project'));

-- Add index for faster filtering
CREATE INDEX idx_activities_type ON activities(activity_type);

-- Update existing activities (optional)
UPDATE activities SET activity_type = 'assignment'
WHERE activity_type IS NULL;
```

### 2. API Endpoints

#### POST /api/activities (Create Activity)

```json
{
  "title": "Math Quiz 1",
  "description": "Basic algebra",
  "type": "quiz", // NEW FIELD
  "instructions": "...",
  "files": []
}
```

#### GET /api/portfolio/activities (Get Activities with Filter)

```
Query params: ?type=quiz || ?type=assignment || ?type=project || ?type=all
```

#### PATCH /api/activities/:id (Update Activity)

```json
{
  "type": "project" // Allow type changes
}
```

### 3. Validation

```typescript
// Backend validation
const VALID_ACTIVITY_TYPES = ["quiz", "assignment", "project"];

function validateActivityType(type: string): boolean {
  return VALID_ACTIVITY_TYPES.includes(type);
}
```

### 4. Migration Strategy

```typescript
// For existing activities without type
// Default to 'assignment' or allow teacher to set during edit
```

## Implementation Steps

### Phase 1: Backend Foundation

1. Add database column and migration
2. Update activity creation endpoint
3. Update activity fetch endpoint with type filtering
4. Add type validation

### Phase 2: Frontend Integration

5. Add type selector to activity creation form
6. Update Dashboard to use real type data
7. Test Portfolio filtering with new types
8. Add type icons across all components

### Phase 3: Polish

9. Add type statistics to dashboard
10. Enable bulk type updates
11. Add type-based sorting
12. Update documentation

## Testing Checklist

- [ ] Create activity with each type
- [ ] Filter activities by type in Portfolio
- [ ] Filter activities by type in Dashboard
- [ ] Update activity type
- [ ] Verify icon display for each type
- [ ] Test with activities without type (legacy data)
- [ ] Test type validation (reject invalid types)
- [ ] Test API endpoints with type parameter

## UI/UX Considerations

- Use consistent icons across all pages
- Color-code activity types for visual distinction
- Show type badge on activity cards
- Make type filtering intuitive
- Consider type-based navigation in sidebar

## Data Migration

For existing activities without a type:

1. Default all to "assignment"
2. OR provide bulk edit interface for teachers
3. OR leave as nullable and show as "Unclassified"
