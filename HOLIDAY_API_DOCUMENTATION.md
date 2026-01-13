# Holiday Management API Documentation

## Overview
The Holiday Management API allows you to create, update, delete, and manage holidays. When a holiday is created, all employees' attendance for that date is automatically marked as HOLIDAYS. The system also supports automatically marking all Sundays of a year as holidays.

## Base URL
```
http://localhost:3001/holiday
```

---

## Endpoints

### 1. Get All Holidays

**Endpoint:** `GET /holiday/getAll`

**Description:** Retrieves all active holidays.

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "message": "Holidays retrieved successfully!",
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "date": "2024-12-25T00:00:00.000Z",
      "reason": "Christmas",
      "description": "Christmas Day holiday",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "isDeleted": null,
      "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
      "updatedBy": null,
      "previousUpdates": null
    }
  ]
}
```

---

### 2. Get Holidays with Pagination

**Endpoint:** `GET /holiday/get`

**Description:** Retrieves holidays with pagination support.

**Authentication:** Required (Bearer Token)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 10 | Number of items per page |

**Example Request:**
```
GET /holiday/get?page=1&pageSize=20
```

**Response:**
```json
{
  "success": true,
  "message": "Holidays retrieved successfully!",
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "date": "2024-12-25T00:00:00.000Z",
        "reason": "Christmas",
        "description": "Christmas Day holiday",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "isDeleted": null,
        "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
        "updatedBy": null,
        "previousUpdates": null
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

---

### 3. Get Holiday by ID

**Endpoint:** `GET /holiday/getById`

**Description:** Retrieves a specific holiday by its ID.

**Authentication:** Required (Bearer Token)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Holiday ID (UUID) |

**Example Request:**
```
GET /holiday/getById?id=123e4567-e89b-12d3-a456-426614174000
```

**Response:**
```json
{
  "success": true,
  "message": "Holiday retrieved successfully!",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2024-12-25T00:00:00.000Z",
    "reason": "Christmas",
    "description": "Christmas Day holiday",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "isDeleted": null,
    "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
    "updatedBy": null,
    "previousUpdates": null,
    "updatedByName": "Admin"
  }
}
```

---

### 4. Create Holiday

**Endpoint:** `POST /holiday/create`

**Description:** Creates a new holiday. Automatically marks all employees' attendance as HOLIDAYS for the specified date.

**Authentication:** Required (Bearer Token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string (date) | Yes | Holiday date (format: YYYY-MM-DD) |
| `reason` | string | No | Reason for the holiday (e.g., "Christmas", "Eid") |
| `description` | string | No | Detailed description of the holiday |
| `isActive` | boolean | No | Whether the holiday is active (default: true) |
| `createdByUserId` | string | No | User ID who created the holiday |

**Example Request:**
```json
{
  "date": "2024-12-25",
  "reason": "Christmas",
  "description": "Christmas Day holiday",
  "isActive": true,
  "createdByUserId": "58c55d6a-910c-46f8-a422-4604bea6cd15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Holiday created successfully!",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2024-12-25T00:00:00.000Z",
    "reason": "Christmas",
    "description": "Christmas Day holiday",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "isDeleted": null,
    "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
    "updatedBy": null,
    "previousUpdates": null
  }
}
```

**Notes:**
- When a holiday is created, all active employees' attendance for that date is automatically marked as `HOLIDAYS`
- If attendance already exists for that date, it will be updated to `HOLIDAYS` status
- The date is normalized to the start of the day (00:00:00)

---

### 5. Update Holiday

**Endpoint:** `PUT /holiday/update`

**Description:** Updates an existing holiday. If the date changes, attendance records are updated accordingly.

**Authentication:** Required (Bearer Token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Holiday ID (UUID) |
| `date` | string (date) | No | New holiday date (format: YYYY-MM-DD) |
| `reason` | string | No | Updated reason for the holiday |
| `description` | string | No | Updated description |
| `isActive` | boolean | No | Whether the holiday is active |
| `updatedByUserId` | string | No | User ID who updated the holiday |

**Example Request:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "date": "2024-12-26",
  "reason": "Boxing Day",
  "description": "Boxing Day holiday",
  "isActive": true,
  "updatedByUserId": "58c55d6a-910c-46f8-a422-4604bea6cd15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Holiday updated successfully!",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2024-12-26T00:00:00.000Z",
    "reason": "Boxing Day",
    "description": "Boxing Day holiday",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z",
    "isDeleted": null,
    "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
    "updatedBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
    "previousUpdates": [
      {
        "data": {
          "date": "2024-12-25T00:00:00.000Z",
          "reason": "Christmas",
          "description": "Christmas Day holiday",
          "isActive": true
        },
        "updatedBy": null,
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Notes:**
- If the date is changed, attendance records for the old date are removed and new records are created for the new date
- If `isActive` is set to `false`, holiday attendance records are removed
- Update history is maintained in `previousUpdates` (last 3 updates)

---

### 6. Delete Holiday

**Endpoint:** `POST /holiday/delete`

**Description:** Soft deletes a holiday and removes holiday attendance records for all employees.

**Authentication:** Required (Bearer Token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Holiday ID (UUID) |

**Example Request:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Holiday deleted successfully!",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2024-12-25T00:00:00.000Z",
    "reason": "Christmas",
    "description": "Christmas Day holiday",
    "isActive": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z",
    "isDeleted": "2024-01-15T10:30:00.000Z",
    "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
    "updatedBy": null,
    "previousUpdates": null
  }
}
```

**Notes:**
- This is a soft delete (the record is not permanently removed)
- All holiday attendance records for that date are soft deleted
- The holiday can be restored using the restore endpoint

---

### 7. Restore Holiday

**Endpoint:** `POST /holiday/restore`

**Description:** Restores a soft-deleted holiday and marks attendance as HOLIDAYS for all employees.

**Authentication:** Required (Bearer Token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Holiday ID (UUID) |

**Example Request:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Holiday restored successfully!",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2024-12-25T00:00:00.000Z",
    "reason": "Christmas",
    "description": "Christmas Day holiday",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z",
    "isDeleted": null,
    "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
    "updatedBy": null,
    "previousUpdates": null
  }
}
```

**Notes:**
- Restores the holiday and sets `isActive` to `true`
- Automatically marks all employees' attendance as HOLIDAYS for the holiday date

---

### 8. Get Deleted Holidays

**Endpoint:** `GET /holiday/deleted`

**Description:** Retrieves soft-deleted holidays with pagination.

**Authentication:** Required (Bearer Token)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 10 | Number of items per page |

**Example Request:**
```
GET /holiday/deleted?page=1&pageSize=10
```

**Response:**
```json
{
  "success": true,
  "message": "Deleted holidays retrieved successfully!",
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "date": "2024-12-25T00:00:00.000Z",
        "reason": "Christmas",
        "description": "Christmas Day holiday",
        "isActive": false,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-15T00:00:00.000Z",
        "isDeleted": "2024-01-15T10:30:00.000Z",
        "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
        "updatedBy": null,
        "previousUpdates": null
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

---

### 9. Search Holidays

**Endpoint:** `POST /holiday/search`

**Description:** Searches holidays by reason or description.

**Authentication:** Required (Bearer Token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `searchTerm` | string | Yes | Search term to match against reason or description |
| `page` | integer | No | Page number (default: 1) |
| `pageSize` | integer | No | Number of items per page (default: 10) |

**Example Request:**
```json
{
  "searchTerm": "Christmas",
  "page": 1,
  "pageSize": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Holidays search completed successfully!",
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "date": "2024-12-25T00:00:00.000Z",
        "reason": "Christmas",
        "description": "Christmas Day holiday",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "isDeleted": null,
        "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
        "updatedBy": null,
        "previousUpdates": null
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

---

### 10. Get Total Holidays Count

**Endpoint:** `GET /holiday/total`

**Description:** Returns the total count of active holidays.

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "message": "Total holidays count retrieved successfully!",
  "data": 50
}
```

---

### 11. Mark Sundays for Year

**Endpoint:** `POST /holiday/markSundays`

**Description:** Automatically creates holidays for all Sundays in the specified year and marks attendance as HOLIDAYS for all employees.

**Authentication:** Required (Bearer Token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `year` | integer | Yes | Year for which to mark Sundays as holidays (e.g., 2024) |
| `createdByUserId` | string | No | User ID who created the holidays |

**Example Request:**
```json
{
  "year": 2024,
  "createdByUserId": "58c55d6a-910c-46f8-a422-4604bea6cd15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sundays marked as holidays successfully!",
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "date": "2024-01-07T00:00:00.000Z",
      "reason": "Sunday",
      "description": "Weekly holiday - Sunday",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "isDeleted": null,
      "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
      "updatedBy": null,
      "previousUpdates": null
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174002",
      "date": "2024-01-14T00:00:00.000Z",
      "reason": "Sunday",
      "description": "Weekly holiday - Sunday",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "isDeleted": null,
      "createdBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
      "updatedBy": null,
      "previousUpdates": null
    }
    // ... more Sundays
  ]
}
```

**Notes:**
- Only creates holidays for Sundays that don't already exist
- Automatically marks all employees' attendance as HOLIDAYS for each Sunday
- Typically creates 52-53 holidays (depending on the year)

---

### 12. Get Holiday History

**Endpoint:** `POST /holiday/getHistoryById`

**Description:** Retrieves the update history for a holiday with audit trail information.

**Authentication:** Required (Bearer Token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Holiday ID (UUID) |
| `filter` | boolean | No | If true, returns array of dates. If false, returns complete previousUpdates array. |
| `date` | string (date) | No | If filter is true and date is provided, returns record for that specific date. |

**Example Request 1: Get Complete History**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "filter": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Holiday history retrieved successfully!",
  "data": [
    {
      "data": {
        "date": "2024-12-25T00:00:00.000Z",
        "reason": "Christmas",
        "description": "Christmas Day holiday",
        "isActive": true
      },
      "updatedBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
      "updatedAt": "2024-01-15T00:00:00.000Z",
      "updatedByName": "Admin"
    },
    {
      "data": {
        "date": "2024-12-24T00:00:00.000Z",
        "reason": "Christmas Eve",
        "description": "Christmas Eve holiday",
        "isActive": true
      },
      "updatedBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
      "updatedAt": "2024-01-10T00:00:00.000Z",
      "updatedByName": "Admin"
    }
  ]
}
```

**Example Request 2: Get Dates Only**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "filter": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Holiday history retrieved successfully!",
  "data": [
    "2024-01-15T00:00:00.000Z",
    "2024-01-10T00:00:00.000Z"
  ]
}
```

**Example Request 3: Get History for Specific Date**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "filter": true,
  "date": "2024-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Holiday history retrieved successfully!",
  "data": {
    "data": {
      "date": "2024-12-25T00:00:00.000Z",
      "reason": "Christmas",
      "description": "Christmas Day holiday",
      "isActive": true
    },
    "updatedBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
    "updatedAt": "2024-01-15T00:00:00.000Z",
    "updatedByName": "Admin"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Holiday ID is required",
  "statusCode": 400
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Authentication token required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Holiday with ID {id} not found.",
  "statusCode": 404
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal Server Error",
  "error": "Error details"
}
```

---

## Feature Permissions

The following feature permissions are available for holiday management:

- `holiday.*` - Holiday (Nav)
- `holiday.create.*` - Create
- `holiday.read.*` - Read
- `holiday.update.*` - Update
- `holiday.delete.*` - Delete
- `holiday.restore.*` - Restore
- `holiday.markSundays.*` - Mark Sundays
- `holiday.viewPreviousUpdate.*` - View Previous Update

---

## Important Notes

1. **Automatic Attendance Marking**: When a holiday is created, all active employees' attendance for that date is automatically marked as `HOLIDAYS`. If attendance already exists, it is updated to `HOLIDAYS` status.

2. **Date Normalization**: All dates are normalized to the start of the day (00:00:00) to ensure consistent comparisons.

3. **Soft Delete**: Holidays are soft deleted, meaning they are not permanently removed from the database. They can be restored using the restore endpoint.

4. **Audit Trail**: All updates are tracked in the `previousUpdates` field, maintaining the last 3 update records with user information.

5. **Sunday Marking**: The `markSundays` endpoint automatically creates holidays for all Sundays in a year. It skips Sundays that already have holidays defined.

6. **Update Behavior**: 
   - If a holiday date is changed, attendance records for the old date are removed and new records are created for the new date
   - If `isActive` is set to `false`, holiday attendance records are removed
   - When a holiday is restored, attendance records are automatically recreated

7. **Employee Status**: Only employees with status `ACTIVE` or `REJOINED` (not `RESIGNED`) are considered when marking holiday attendance.

---

## Authentication

All endpoints require authentication. Include a valid Bearer token in the Authorization header:

```
Authorization: Bearer <your-token>
```

---

## Rate Limiting

Standard rate limiting applies as configured in the application.

---

## Version

API Version: 1.0  
Last Updated: 2024-01-20
