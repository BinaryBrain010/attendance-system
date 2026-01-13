# Employee Statistics API Documentation

## Endpoint
```
POST /employee/stats
```

## Description
Retrieves comprehensive statistics for a specific employee including attendance data, leave requests, and leave allocations. The statistics are formatted for easy visualization in different formats (graphs, charts, tables, etc.) across different tabs.

## Base URL
```
http://localhost:3001/employee/stats
```

---

## Request Body

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `employeeId` | string | Unique employee identifier (UUID) |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | string (date) | Start of current month | Start date for statistics period (format: YYYY-MM-DD) |
| `to` | string (date) | End of current month | End date for statistics period (format: YYYY-MM-DD) |

### Request Example

```json
{
  "employeeId": "123e4567-e89b-12d3-a456-426614174000",
  "from": "2024-01-01",
  "to": "2024-12-31"
}
```

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Employee statistics retrieved successfully!",
  "data": {
    "employee": {
      "id": "string",
      "name": "string",
      "surname": "string",
      "code": "string"
    },
    "dateRange": {
      "from": "2024-01-01T00:00:00.000Z",
      "to": "2024-12-31T23:59:59.999Z"
    },
    "attendance": {
      "total": 250,
      "byStatus": {
        "PRESENT": 180,
        "ABSENT": 30,
        "LATE": 20,
        "ON_LEAVE": 15,
        "HALF_DAY": 3,
        "HOLIDAYS": 2
      },
      "today": {
        "status": "PRESENT",
        "checkIn": "2024-01-20T09:00:00.000Z",
        "checkOut": "2024-01-20T17:00:00.000Z"
      },
      "periods": {
        "today": 1,
        "week": 5,
        "month": 22
      },
      "trends": {
        "daily": [
          {
            "date": "2024-01-01",
            "status": "PRESENT",
            "checkIn": "2024-01-01T09:00:00.000Z",
            "checkOut": "2024-01-01T17:00:00.000Z"
          }
        ]
      }
    },
    "leaveRequests": {
      "total": 12,
      "byStatus": {
        "PENDING": 2,
        "APPROVED": 8,
        "REJECTED": 2
      },
      "pending": 2,
      "approved": 8,
      "rejected": 2
    },
    "leaveAllocations": {
      "totalAllocated": 30,
      "used": 15,
      "remaining": 15,
      "allocations": [
        {
          "assignedDays": 30,
          "allocationStartDate": "2024-01-01T00:00:00.000Z",
          "allocationEndDate": "2024-12-31T23:59:59.999Z"
        }
      ]
    },
    "leaveTrends": {
      "monthly": [
        {
          "month": "2024-Jan",
          "approved": 2,
          "pending": 1,
          "rejected": 0,
          "total": 3
        }
      ]
    }
  }
}
```

---

## Response Fields

### Employee Information

| Field | Type | Description |
|-------|------|-------------|
| `employee.id` | string | Employee unique identifier |
| `employee.name` | string | Employee first name |
| `employee.surname` | string | Employee last name |
| `employee.code` | string | Employee code (e.g., SOL-154) |

### Date Range

| Field | Type | Description |
|-------|------|-------------|
| `dateRange.from` | string (ISO 8601) | Start date of statistics period |
| `dateRange.to` | string (ISO 8601) | End date of statistics period |

---

## Attendance Statistics

### Overview

| Field | Type | Description |
|-------|------|-------------|
| `attendance.total` | number | Total attendance records in the period |
| `attendance.byStatus` | object | Count of attendance by status (see below) |
| `attendance.today` | object \| null | Today's attendance record (if exists) |
| `attendance.periods` | object | Attendance counts for different periods |
| `attendance.trends` | object | Trend data for visualization |

### Attendance by Status

| Status | Description |
|--------|-------------|
| `PRESENT` | Employee was present |
| `ABSENT` | Employee was absent |
| `LATE` | Employee was late |
| `ON_LEAVE` | Employee was on leave |
| `HALF_DAY` | Employee worked half day |
| `HOLIDAYS` | Public holiday |

### Today's Attendance

| Field | Type | Description |
|-------|------|-------------|
| `attendance.today.status` | string | Today's attendance status |
| `attendance.today.checkIn` | string (ISO 8601) \| null | Check-in time |
| `attendance.today.checkOut` | string (ISO 8601) \| null | Check-out time |

**Note:** If no attendance record exists for today, `attendance.today` will be `null`.

### Attendance Periods

| Field | Type | Description |
|-------|------|-------------|
| `attendance.periods.today` | number | Attendance count for today (0 or 1) |
| `attendance.periods.week` | number | Attendance count for current week |
| `attendance.periods.month` | number | Attendance count for current month |

### Attendance Trends

#### Daily Trend (Last 30 Days)

The `attendance.trends.daily` array contains 30 days of attendance data, suitable for line charts or bar graphs.

Each item contains:
- `date` (string): Date in YYYY-MM-DD format
- `status` (string): Attendance status for that day
- `checkIn` (string \| null): Check-in time if present
- `checkOut` (string \| null): Check-out time if present

**Visualization Suggestions:**
- **Line Chart**: Plot status over time
- **Bar Chart**: Show count of each status type
- **Heatmap**: Calendar view showing status for each day
- **Pie Chart**: Distribution of status types

---

## Leave Request Statistics

### Overview

| Field | Type | Description |
|-------|------|-------------|
| `leaveRequests.total` | number | Total leave requests in the period |
| `leaveRequests.byStatus` | object | Count of leave requests by status |
| `leaveRequests.pending` | number | Number of pending requests |
| `leaveRequests.approved` | number | Number of approved requests |
| `leaveRequests.rejected` | number | Number of rejected requests |

### Leave Request Status

| Status | Description |
|--------|-------------|
| `PENDING` | Leave request is pending approval |
| `APPROVED` | Leave request has been approved |
| `REJECTED` | Leave request has been rejected |

**Visualization Suggestions:**
- **Pie Chart**: Distribution of request statuses
- **Bar Chart**: Compare pending, approved, and rejected counts
- **Donut Chart**: Status breakdown with total in center

---

## Leave Allocation Statistics

### Overview

| Field | Type | Description |
|-------|------|-------------|
| `leaveAllocations.totalAllocated` | number | Total leave days allocated to employee |
| `leaveAllocations.used` | number | Total leave days used (from approved requests) |
| `leaveAllocations.remaining` | number | Remaining leave days available |
| `leaveAllocations.allocations` | array | List of all leave allocations |

### Leave Allocation Details

Each allocation in `leaveAllocations.allocations` contains:

| Field | Type | Description |
|-------|------|-------------|
| `assignedDays` | number | Number of days allocated |
| `allocationStartDate` | string (ISO 8601) | Start date of allocation period |
| `allocationEndDate` | string (ISO 8601) \| null | End date of allocation period (if applicable) |

**Visualization Suggestions:**
- **Progress Bar**: Show used vs remaining (used/totalAllocated)
- **Gauge Chart**: Percentage of leave used
- **Stacked Bar**: Show allocation periods over time

---

## Leave Trends

### Monthly Leave Trend (Last 12 Months)

The `leaveTrends.monthly` array contains 12 months of leave request data.

Each item contains:
- `month` (string): Month in format "YYYY-MMM" (e.g., "2024-Jan")
- `approved` (number): Number of approved requests in that month
- `pending` (number): Number of pending requests in that month
- `rejected` (number): Number of rejected requests in that month
- `total` (number): Total requests in that month

**Visualization Suggestions:**
- **Line Chart**: Show trend of approved/pending/rejected over time
- **Stacked Area Chart**: Show cumulative leave requests by status
- **Grouped Bar Chart**: Compare approved, pending, rejected by month
- **Multi-line Chart**: Separate lines for each status type

---

## Request Examples

### Example 1: Get Stats for Current Month (Default)
```json
POST /employee/stats
{
  "employeeId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Example 2: Get Stats for Specific Date Range
```json
POST /employee/stats
{
  "employeeId": "123e4567-e89b-12d3-a456-426614174000",
  "from": "2024-01-01",
  "to": "2024-12-31"
}
```

### Example 3: Get Stats for Last Quarter
```json
POST /employee/stats
{
  "employeeId": "123e4567-e89b-12d3-a456-426614174000",
  "from": "2024-10-01",
  "to": "2024-12-31"
}
```

---

## Response Examples

### Example 1: Full Response
```json
{
  "success": true,
  "message": "Employee statistics retrieved successfully!",
  "data": {
    "employee": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "John",
      "surname": "Doe",
      "code": "SOL-154"
    },
    "dateRange": {
      "from": "2024-01-01T00:00:00.000Z",
      "to": "2024-12-31T23:59:59.999Z"
    },
    "attendance": {
      "total": 250,
      "byStatus": {
        "PRESENT": 180,
        "ABSENT": 30,
        "LATE": 20,
        "ON_LEAVE": 15,
        "HALF_DAY": 3,
        "HOLIDAYS": 2
      },
      "today": {
        "status": "PRESENT",
        "checkIn": "2024-01-20T09:00:00.000Z",
        "checkOut": "2024-01-20T17:00:00.000Z"
      },
      "periods": {
        "today": 1,
        "week": 5,
        "month": 22
      },
      "trends": {
        "daily": [
          {
            "date": "2024-01-01",
            "status": "PRESENT",
            "checkIn": "2024-01-01T09:00:00.000Z",
            "checkOut": "2024-01-01T17:00:00.000Z"
          },
          {
            "date": "2024-01-02",
            "status": "LATE",
            "checkIn": "2024-01-02T09:30:00.000Z",
            "checkOut": "2024-01-02T17:00:00.000Z"
          }
        ]
      }
    },
    "leaveRequests": {
      "total": 12,
      "byStatus": {
        "PENDING": 2,
        "APPROVED": 8,
        "REJECTED": 2
      },
      "pending": 2,
      "approved": 8,
      "rejected": 2
    },
    "leaveAllocations": {
      "totalAllocated": 30,
      "used": 15,
      "remaining": 15,
      "allocations": [
        {
          "assignedDays": 30,
          "allocationStartDate": "2024-01-01T00:00:00.000Z",
          "allocationEndDate": "2024-12-31T23:59:59.999Z"
        }
      ]
    },
    "leaveTrends": {
      "monthly": [
        {
          "month": "2024-Jan",
          "approved": 2,
          "pending": 1,
          "rejected": 0,
          "total": 3
        },
        {
          "month": "2024-Feb",
          "approved": 1,
          "pending": 0,
          "rejected": 1,
          "total": 2
        }
      ]
    }
  }
}
```

---

## Error Responses

### 400 Bad Request - Missing Employee ID
```json
{
  "success": false,
  "message": "Employee ID is required",
  "statusCode": 400
}
```

### 404 Not Found - Employee Not Found
```json
{
  "success": false,
  "message": "Employee with ID {employeeId} not found.",
  "statusCode": 404
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

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal Server Error",
  "error": "Error details"
}
```

---

## Visualization Guide

### Tab 1: Attendance Statistics

#### Cards/Summary Widgets
- **Total Attendance**: `attendance.total`
- **Present Days**: `attendance.byStatus.PRESENT`
- **Absent Days**: `attendance.byStatus.ABSENT`
- **Late Days**: `attendance.byStatus.LATE`
- **On Leave Days**: `attendance.byStatus.ON_LEAVE`

#### Charts

1. **Status Distribution Pie Chart**
   - Data: `attendance.byStatus`
   - Shows: Distribution of PRESENT, ABSENT, LATE, ON_LEAVE, HALF_DAY, HOLIDAYS

2. **Daily Attendance Trend Line Chart**
   - Data: `attendance.trends.daily`
   - X-axis: `date`
   - Y-axis: `status` (can be converted to numeric: PRESENT=1, ABSENT=0, etc.)
   - Shows: Attendance pattern over last 30 days

3. **Period Comparison Bar Chart**
   - Data: `attendance.periods`
   - Shows: Today vs Week vs Month attendance counts

4. **Status Timeline Heatmap**
   - Data: `attendance.trends.daily`
   - Shows: Calendar view with color-coded status for each day

### Tab 2: Leave Requests Statistics

#### Cards/Summary Widgets
- **Total Requests**: `leaveRequests.total`
- **Pending**: `leaveRequests.pending`
- **Approved**: `leaveRequests.approved`
- **Rejected**: `leaveRequests.rejected`

#### Charts

1. **Request Status Pie Chart**
   - Data: `leaveRequests.byStatus`
   - Shows: Distribution of PENDING, APPROVED, REJECTED

2. **Monthly Leave Trend Multi-line Chart**
   - Data: `leaveTrends.monthly`
   - X-axis: `month`
   - Y-axis: Count
   - Multiple lines: `approved`, `pending`, `rejected`
   - Shows: Trend of leave requests over last 12 months

3. **Status Comparison Bar Chart**
   - Data: `leaveRequests.byStatus`
   - Shows: Side-by-side comparison of status counts

### Tab 3: Leave Allocations Statistics

#### Cards/Summary Widgets
- **Total Allocated**: `leaveAllocations.totalAllocated`
- **Used**: `leaveAllocations.used`
- **Remaining**: `leaveAllocations.remaining`
- **Usage Percentage**: `(used / totalAllocated) * 100`

#### Charts

1. **Leave Balance Progress Bar**
   - Data: `leaveAllocations.used` vs `leaveAllocations.remaining`
   - Shows: Visual representation of used vs remaining days

2. **Leave Usage Gauge Chart**
   - Data: `leaveAllocations.used / leaveAllocations.totalAllocated`
   - Shows: Percentage of leave used (0-100%)

3. **Allocation Timeline**
   - Data: `leaveAllocations.allocations`
   - Shows: Timeline of allocation periods with assigned days

---

## Notes

1. **Date Range Defaults**: If `from` and `to` are not provided, statistics are calculated for the current month.

2. **Attendance Trends**: The daily trend includes the last 30 days from today, regardless of the `from`/`to` date range.

3. **Leave Calculations**: 
   - Used leave days are calculated from approved leave requests
   - Days are calculated inclusively (start date and end date both count)
   - Remaining days cannot be negative (minimum is 0)

4. **Period Calculations**:
   - **Today**: Current day (00:00:00 to 23:59:59)
   - **Week**: Current week starting from Sunday
   - **Month**: Current calendar month

5. **Performance**: The endpoint performs multiple database queries in parallel for optimal performance. For large date ranges, response time may increase.

6. **Data Freshness**: All statistics are calculated in real-time from the database.

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
