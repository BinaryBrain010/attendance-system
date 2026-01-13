# Employee GET API Documentation

## Endpoint
```
GET /employee/get
```

## Description
Retrieves a paginated list of employees with support for sorting, filtering, and searching. The endpoint supports two response modes: full employee details or minimal fields (filter mode).

## Base URL
```
http://localhost:3001/employee/get
```

---

## Query Parameters

### Required Parameters
None - All parameters are optional with default values.

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number for pagination (1-based) |
| `pageSize` | integer | `10` | Number of items per page |
| `sortBy` | string | `createdAt` | Field to sort by (see valid values below) |
| `sortOrder` | string | `desc` | Sort order: `asc` (ascending) or `desc` (descending) |
| `filter` | string | - | Special filter parameter (see filter modes below) |
| `search` | string | - | Search term to filter employees (searches multiple fields) |
| `from` | string (date) | - | Start date for date range filter (format: YYYY-MM-DD) |
| `to` | string (date) | - | End date for date range filter (format: YYYY-MM-DD) |
| `dateField` | string | `joiningDate` | Date field to filter by: `joiningDate`, `createdAt`, or `updatedAt` |

---

## Filter Parameter (`filter`)

The `filter` parameter has two modes:

### Mode 1: Minimal Fields (`filter=true`)
When `filter=true`, the response returns only minimal employee fields:
- `id`
- `name`
- `surname`
- `code`

**Example:**
```
GET /employee/get?page=1&pageSize=10&filter=true
```

### Mode 2: Status Filter
When `filter` is set to a status value (not "true"), it filters employees by their status:
- `ACTIVE` - Active employees
- `RESIGNED` - Resigned employees
- `REJOINED` - Rejoined employees
- Other status values as defined in the system

**Example:**
```
GET /employee/get?page=1&pageSize=10&filter=ACTIVE
GET /employee/get?page=1&pageSize=10&filter=RESIGNED
GET /employee/get?page=1&pageSize=10&filter=REJOINED
```

---

## Sort By (`sortBy`) - Valid Values

The following fields can be used for sorting:

- `name` - Employee first name
- `surname` - Employee last name
- `code` - Employee code (e.g., SOL-1, PWH-2)
- `designation` - Job designation
- `department` - Department name
- `createdAt` - Creation timestamp (default)
- `updatedAt` - Last update timestamp
- `joiningDate` - Employee joining date
- `status` - Employee status

**Note:** If an invalid `sortBy` value is provided, it defaults to `createdAt`.

---

## Date Range Filters (`from`, `to`, `dateField`)

The date range filters allow you to filter employees based on date fields within a specific range.

### Parameters

- **`from`** (optional): Start date in format `YYYY-MM-DD` (e.g., `2024-01-01`)
- **`to`** (optional): End date in format `YYYY-MM-DD` (e.g., `2024-12-31`)
- **`dateField`** (optional): Which date field to filter by. Valid values:
  - `joiningDate` (default) - Filter by employee joining date
  - `createdAt` - Filter by employee creation date
  - `updatedAt` - Filter by employee last update date

### Behavior

- If only `from` is provided: Returns employees where the selected date field is >= `from` (start of day)
- If only `to` is provided: Returns employees where the selected date field is <= `to` (end of day)
- If both `from` and `to` are provided: Returns employees where the selected date field is between `from` and `to` (inclusive)
- Dates are inclusive (includes the full day for both start and end dates)

### Examples

**Filter by joining date range:**
```
GET /employee/get?page=1&pageSize=15&from=2024-01-01&to=2024-12-31
```

**Filter by creation date:**
```
GET /employee/get?page=1&pageSize=15&from=2024-01-01&to=2024-01-31&dateField=createdAt
```

**Filter employees updated in last month:**
```
GET /employee/get?page=1&pageSize=15&from=2024-01-01&dateField=updatedAt
```

**Combine with other filters:**
```
GET /employee/get?page=1&pageSize=15&filter=ACTIVE&from=2024-01-01&to=2024-12-31&sortBy=joiningDate
```

---

## Search Parameter (`search`)

The `search` parameter performs a case-insensitive search across the following fields:
- `name` - Employee first name
- `surname` - Employee last name
- `code` - Employee code
- `designation` - Job designation
- `department` - Department name

The search uses "contains" matching, so partial matches are supported.

**Example:**
```
GET /employee/get?page=1&pageSize=10&search=john
```
This will find employees with "john" in their name, surname, code, designation, or department.

---

## Request Examples

### Example 1: Basic Pagination
```
GET /employee/get?page=1&pageSize=15
```

### Example 2: Sort by Name (Ascending)
```
GET /employee/get?page=1&pageSize=15&sortBy=name&sortOrder=asc
```

### Example 3: Filter Active Employees
```
GET /employee/get?page=1&pageSize=15&filter=ACTIVE&sortBy=joiningDate&sortOrder=desc
```

### Example 4: Search with Minimal Fields
```
GET /employee/get?page=1&pageSize=15&filter=true&search=manager
```

### Example 5: Complex Query
```
GET /employee/get?page=2&pageSize=20&sortBy=code&sortOrder=asc&filter=ACTIVE&search=solar
```

### Example 6: Date Range Filter (Joining Date)
```
GET /employee/get?page=1&pageSize=15&from=2024-01-01&to=2024-12-31
```

### Example 7: Date Range Filter (Creation Date)
```
GET /employee/get?page=1&pageSize=15&from=2024-01-01&to=2024-01-31&dateField=createdAt
```

### Example 8: Combined Filters with Date Range
```
GET /employee/get?page=1&pageSize=15&filter=ACTIVE&from=2024-01-01&to=2024-12-31&sortBy=joiningDate&sortOrder=asc&search=engineer
```

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Employees retrieved successfully!",
  "data": {
    "data": [
      {
        "id": "string",
        "name": "string",
        "surname": "string",
        "code": "string",
        "address": "string",
        "joiningDate": "2024-01-15T00:00:00.000Z",
        "bloodGroup": "string",
        "dob": "2024-01-15T00:00:00.000Z",
        "cnic": "string",
        "contactNo": "string",
        "emergencyContactNo": "string",
        "designation": "string",
        "department": "string",
        "martialStatus": "string",
        "noOfChildrens": 0,
        "filePaths": ["string"],
        "notes": "string",
        "company": "SOLARMAX" | "POWERHIGHWAY" | "OKASHASMART",
        "image": "string",
        "status": "ACTIVE" | "RESIGNED" | "REJOINED",
        "resignationDate": "2024-01-15T00:00:00.000Z",
        "createdAt": "2024-01-15T00:00:00.000Z",
        "updatedAt": "2024-01-15T00:00:00.000Z",
        "updatedBy": "string",
        "updatedByName": "string"
      }
    ],
    "totalSize": 100
  }
}
```

### Response Fields (Full Mode - when `filter` is not "true")

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique employee identifier (UUID) |
| `name` | string | Employee first name |
| `surname` | string | Employee last name |
| `code` | string | Employee code (e.g., SOL-154, PWH-155) |
| `address` | string | Employee address |
| `joiningDate` | string (ISO 8601) | Employee joining date |
| `bloodGroup` | string | Blood group |
| `dob` | string (ISO 8601) | Date of birth |
| `cnic` | string | CNIC number |
| `contactNo` | string | Contact number |
| `emergencyContactNo` | string | Emergency contact number (optional) |
| `designation` | string | Job designation |
| `department` | string | Department name |
| `martialStatus` | string | Marital status |
| `noOfChildrens` | number | Number of children (optional) |
| `filePaths` | string[] | Array of file paths |
| `notes` | string | Additional notes (optional) |
| `company` | string | Company name: `SOLARMAX`, `POWERHIGHWAY`, or `OKASHASMART` |
| `image` | string | Employee image path (optional) |
| `status` | string | Employee status: `ACTIVE`, `RESIGNED`, or `REJOINED` |
| `resignationDate` | string (ISO 8601) | Resignation date (optional) |
| `createdAt` | string (ISO 8601) | Creation timestamp |
| `updatedAt` | string (ISO 8601) | Last update timestamp |
| `updatedBy` | string | ID of user who last updated (optional) |
| `updatedByName` | string | Username of user who last updated (shows "Admin" for admin user, optional) |

### Response Fields (Minimal Mode - when `filter=true`)

When `filter=true`, only these fields are returned:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique employee identifier (UUID) |
| `name` | string | Employee first name |
| `surname` | string | Employee last name |
| `code` | string | Employee code |

### Response Metadata

| Field | Type | Description |
|-------|------|-------------|
| `data.data` | array | Array of employee objects |
| `data.totalSize` | number | Total number of employees matching the query (for pagination) |
| `success` | boolean | Always `true` for successful requests |
| `message` | string | Success message |

---

## Response Examples

### Example 1: Full Response (Default)
```json
{
  "success": true,
  "message": "Employees retrieved successfully!",
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "John",
        "surname": "Doe",
        "code": "SOL-154",
        "address": "123 Main St",
        "joiningDate": "2024-01-15T00:00:00.000Z",
        "bloodGroup": "O+",
        "dob": "1990-05-20T00:00:00.000Z",
        "cnic": "12345-1234567-1",
        "contactNo": "03001234567",
        "emergencyContactNo": "03009876543",
        "designation": "Software Engineer",
        "department": "IT",
        "martialStatus": "Married",
        "noOfChildrens": 2,
        "filePaths": ["/uploads/file1.pdf"],
        "notes": "Excellent performance",
        "company": "SOLARMAX",
        "image": "/uploads/photo.jpg",
        "status": "ACTIVE",
        "resignationDate": null,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-20T14:45:00.000Z",
        "updatedBy": "58c55d6a-910c-46f8-a422-4604bea6cd15",
        "updatedByName": "Admin"
      }
    ],
    "totalSize": 154
  }
}
```

### Example 2: Minimal Response (`filter=true`)
```json
{
  "success": true,
  "message": "Employees retrieved successfully!",
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "John",
        "surname": "Doe",
        "code": "SOL-154"
      }
    ],
    "totalSize": 154
  }
}
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Authentication token required"
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

## Notes

1. **Pagination**: The `totalSize` field represents the total number of employees matching the query criteria (including filters and search), not just the current page.

2. **Default Sorting**: If no `sortBy` is specified, results are sorted by `createdAt` in descending order (newest first).

3. **Filter Behavior**: 
   - `filter=true` returns minimal fields (id, name, surname, code only)
   - `filter=ACTIVE`, `filter=RESIGNED`, or `filter=REJOINED` filters by status and returns full fields
   - If `filter` is not provided, all non-deleted employees (regardless of status) are returned with full fields

4. **Search**: The search is case-insensitive and matches partial strings across multiple fields.

5. **Updated By Name**: The `updatedByName` field shows:
   - `"Admin"` if the `updatedBy` ID is `58c55d6a-910c-46f8-a422-4604bea6cd15`
   - The actual username for other users
   - `null` if no user updated the record

6. **Company Codes**: Employee codes follow the pattern:
   - `SOL-{number}` for SOLARMAX
   - `PWH-{number}` for POWERHIGHWAY
   - `OK-{number}` for OKASHASMART
   - Numbers are sequential and global (not per company)

7. **Date Range Filters**:
   - Date format: `YYYY-MM-DD` (e.g., `2024-01-15`)
   - `from` date includes the entire day (00:00:00)
   - `to` date includes the entire day (23:59:59.999)
   - Both dates are inclusive
   - Default `dateField` is `joiningDate` if not specified
   - Can be combined with other filters (status, search, etc.)

---

## Authentication

This endpoint requires authentication. Include a valid Bearer token in the Authorization header:

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
