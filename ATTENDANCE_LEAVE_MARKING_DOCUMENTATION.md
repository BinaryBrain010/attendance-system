# Attendance Leave Marking Documentation

## Overview
The system supports marking leave during attendance marking and bulk leave marking for selected employees. This allows administrators to quickly mark multiple employees as on leave and optionally create leave requests automatically.

## Features

### 1. Mark Leave During Attendance
When marking attendance with status `ON_LEAVE`, you can optionally create a leave request automatically.

### 2. Bulk Leave Marking
Mark leave for multiple selected employees at once on a specific date.

---

## API Endpoints

### 1. Mark Attendance with Leave Request

**Endpoint:** `POST /attendance/markAttendance`

**Description:** Mark attendance for an employee. If status is `ON_LEAVE` and `createLeaveRequest` is `true`, a leave request will be automatically created and approved.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employeeId` | string | Yes | Employee ID |
| `date` | string (date) | No | Date for attendance (defaults to today) |
| `status` | string | No | Attendance status (PRESENT, ABSENT, LATE, ON_LEAVE, HALF_DAY, HOLIDAYS) |
| `checkIn` | string (date-time) | No | Check-in time |
| `checkOut` | string (date-time) | No | Check-out time |
| `comment` | string | No | Comment |
| `location` | string | No | Location |
| `createLeaveRequest` | boolean | No | If true and status is ON_LEAVE, creates and approves a leave request |
| `leaveType` | string | No | Type of leave (CASUAL, MATERNITY, SICK, etc.) - only used if createLeaveRequest is true |
| `leaveReason` | string | No | Reason for leave - only used if createLeaveRequest is true |

**Example Request - Mark Leave with Leave Request:**
```json
{
  "employeeId": "emp-id",
  "date": "2024-01-20",
  "status": "ON_LEAVE",
  "comment": "Sick leave",
  "createLeaveRequest": true,
  "leaveType": "SICK",
  "leaveReason": "Fever and cold"
}
```

**Example Request - Mark Leave without Leave Request:**
```json
{
  "employeeId": "emp-id",
  "date": "2024-01-20",
  "status": "ON_LEAVE",
  "comment": "Personal leave"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Attendance marked successfully for John Doe!",
  "data": {
    "id": "attendance-id",
    "employeeId": "emp-id",
    "date": "2024-01-20T00:00:00.000Z",
    "status": "ON_LEAVE",
    "comment": "Sick leave",
    "checkIn": null,
    "checkOut": null,
    "createdAt": "2024-01-20T10:00:00.000Z"
  }
}
```

**Behavior:**
- If `status` is `ON_LEAVE` and `createLeaveRequest` is `true`:
  - Creates a leave request with status `APPROVED`
  - Automatically links to leave allocation if `leaveType` matches a configured leave
  - Deducts days from leave balance if it's a configured leave
- If `createLeaveRequest` is `false` or not provided:
  - Only marks attendance as `ON_LEAVE`
  - No leave request is created

---

### 2. Bulk Mark Leave for Selected Employees

**Endpoint:** `POST /attendance/bulkMarkLeave`

**Description:** Marks attendance as `ON_LEAVE` for multiple selected employees on a specific date. Optionally creates leave requests for each employee.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employeeIds` | array of strings | Yes | Array of employee IDs to mark leave for |
| `date` | string (date) | Yes | Date for which to mark leave |
| `leaveType` | string | No | Type of leave (CASUAL, MATERNITY, SICK, etc.) - only used if createLeaveRequest is true |
| `reason` | string | No | Reason for leave |
| `createLeaveRequest` | boolean | No | If true, automatically creates and approves leave requests for each employee (default: false) |

**Example Request:**
```json
{
  "employeeIds": [
    "emp-id-1",
    "emp-id-2",
    "emp-id-3"
  ],
  "date": "2024-01-20",
  "reason": "Team event",
  "createLeaveRequest": true,
  "leaveType": "CASUAL"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk leave marking completed successfully!",
  "data": {
    "success": true,
    "message": "Bulk leave marking completed",
    "total": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "employeeId": "emp-id-1",
        "employeeName": "John Doe",
        "success": true,
        "message": "Leave marked successfully",
        "data": {
          "id": "attendance-id-1",
          "employeeId": "emp-id-1",
          "date": "2024-01-20T00:00:00.000Z",
          "status": "ON_LEAVE",
          "comment": "Team event"
        }
      },
      {
        "employeeId": "emp-id-2",
        "employeeName": "Jane Smith",
        "success": true,
        "message": "Leave marked successfully",
        "data": {
          "id": "attendance-id-2",
          "employeeId": "emp-id-2",
          "date": "2024-01-20T00:00:00.000Z",
          "status": "ON_LEAVE",
          "comment": "Team event"
        }
      },
      {
        "employeeId": "emp-id-3",
        "employeeName": "Bob Johnson",
        "success": true,
        "message": "Leave marked successfully",
        "data": {
          "id": "attendance-id-3",
          "employeeId": "emp-id-3",
          "date": "2024-01-20T00:00:00.000Z",
          "status": "ON_LEAVE",
          "comment": "Team event"
        }
      }
    ]
  }
}
```

**Behavior:**
- Marks attendance as `ON_LEAVE` for all specified employees
- If attendance already exists for a date, updates it to `ON_LEAVE`
- If `createLeaveRequest` is `true`:
  - Creates and approves leave requests for each employee
  - Automatically links to leave allocation if `leaveType` matches a configured leave
  - Deducts days from leave balance if it's a configured leave
- Returns detailed results for each employee (success/failure)

---

## Usage Examples

### Example 1: Mark Single Employee Leave with Leave Request

```bash
POST /attendance/markAttendance
{
  "employeeId": "emp-id",
  "date": "2024-01-20",
  "status": "ON_LEAVE",
  "createLeaveRequest": true,
  "leaveType": "SICK",
  "leaveReason": "Fever"
}
```

**What happens:**
1. Marks attendance as `ON_LEAVE`
2. Creates a leave request with status `APPROVED`
3. Links to sick leave allocation if employee has one
4. Deducts 1 day from leave balance

### Example 2: Mark Single Employee Leave without Leave Request

```bash
POST /attendance/markAttendance
{
  "employeeId": "emp-id",
  "date": "2024-01-20",
  "status": "ON_LEAVE",
  "comment": "Personal leave"
}
```

**What happens:**
1. Marks attendance as `ON_LEAVE`
2. No leave request is created
3. No leave balance is affected

### Example 3: Bulk Mark Leave for Selected Employees

```bash
POST /attendance/bulkMarkLeave
{
  "employeeIds": ["emp-1", "emp-2", "emp-3"],
  "date": "2024-01-20",
  "reason": "Company holiday",
  "createLeaveRequest": false
}
```

**What happens:**
1. Marks attendance as `ON_LEAVE` for all 3 employees
2. No leave requests are created
3. No leave balance is affected

### Example 4: Bulk Mark Leave with Leave Requests

```bash
POST /attendance/bulkMarkLeave
{
  "employeeIds": ["emp-1", "emp-2", "emp-3"],
  "date": "2024-01-20",
  "reason": "Team building event",
  "createLeaveRequest": true,
  "leaveType": "CASUAL"
}
```

**What happens:**
1. Marks attendance as `ON_LEAVE` for all 3 employees
2. Creates and approves casual leave requests for each employee
3. No leave balance is affected (casual leave doesn't use allocations)

### Example 5: Bulk Mark Maternity Leave with Leave Requests

```bash
POST /attendance/bulkMarkLeave
{
  "employeeIds": ["emp-1"],
  "date": "2024-01-20",
  "reason": "Maternity leave",
  "createLeaveRequest": true,
  "leaveType": "MATERNITY"
}
```

**What happens:**
1. Marks attendance as `ON_LEAVE`
2. Creates and approves maternity leave request
3. Links to employee's maternity leave allocation
4. Deducts 1 day from maternity leave balance

---

## Important Notes

1. **Leave Request Creation**: 
   - When `createLeaveRequest` is `true`, leave requests are automatically created with status `APPROVED`
   - The system automatically links to leave allocation if `leaveType` matches a configured leave
   - Balance validation occurs when the leave request is created

2. **Bulk Operations**:
   - Processes employees sequentially
   - Continues processing even if one employee fails
   - Returns detailed results for each employee
   - Validates employee existence before processing

3. **Existing Attendance**:
   - If attendance already exists for a date, it's updated to `ON_LEAVE`
   - Previous status is preserved in audit trail (`previousUpdates`)

4. **Leave Types**:
   - `CASUAL` - No allocation needed, no balance tracking
   - `MATERNITY`, `SICK`, `ANNUAL`, etc. - Requires allocation, tracks balance

5. **Error Handling**:
   - If leave request creation fails, attendance marking still succeeds
   - Errors are logged but don't fail the entire operation
   - Individual employee failures are reported in the results

6. **Date Handling**:
   - All dates are normalized to start of day in Pakistan timezone
   - Timezone-aware date comparisons ensure accurate filtering

---

## Response Structure

### Bulk Mark Leave Response

```json
{
  "success": true,
  "message": "Bulk leave marking completed successfully!",
  "data": {
    "success": true,
    "message": "Bulk leave marking completed",
    "total": 5,
    "successful": 4,
    "failed": 1,
    "results": [
      {
        "employeeId": "emp-id",
        "employeeName": "John Doe",
        "success": true,
        "message": "Leave marked successfully",
        "data": { /* attendance record */ }
      },
      {
        "employeeId": "invalid-id",
        "success": false,
        "message": "Employee not found"
      }
    ]
  }
}
```

---

## Error Responses

### 400 Bad Request - Missing Required Fields
```json
{
  "success": false,
  "message": "employeeIds array is required and must not be empty",
  "statusCode": 400
}
```

### 400 Bad Request - Missing Date
```json
{
  "success": false,
  "message": "date is required",
  "statusCode": 400
}
```

---

## Integration with Leave System

### Automatic Leave Request Creation

When `createLeaveRequest` is `true`:

1. **For Configured Leaves** (e.g., MATERNITY, SICK):
   - System finds matching leave configuration
   - Links to employee's leave allocation
   - Creates approved leave request
   - Deducts days from leave balance
   - Validates sufficient balance

2. **For Casual Leaves**:
   - Creates approved leave request
   - No allocation linking
   - No balance tracking

### Leave Balance Impact

- **Configured Leaves**: Days are deducted from `remainingDays` when leave request is created
- **Casual Leaves**: No balance impact
- **Balance Validation**: System checks available balance before creating leave request

---

## Use Cases

### Use Case 1: Quick Leave Marking
**Scenario**: Employee calls in sick, you want to mark them on leave quickly.

**Solution**: Use `markAttendance` with `status: "ON_LEAVE"` and `createLeaveRequest: true`

### Use Case 2: Team Event
**Scenario**: Entire team is going to an event, mark all of them on leave.

**Solution**: Use `bulkMarkLeave` with all team member IDs

### Use Case 3: Department Holiday
**Scenario**: Specific department has a holiday, mark all department employees.

**Solution**: Use `bulkMarkLeave` with filtered employee IDs

### Use Case 4: Leave Without Request
**Scenario**: Mark someone on leave but don't want to create a leave request (e.g., already processed separately).

**Solution**: Use `markAttendance` or `bulkMarkLeave` with `createLeaveRequest: false`

---

## Best Practices

1. **Use `createLeaveRequest: true`** when you want the leave to be tracked in the leave system
2. **Use `createLeaveRequest: false`** when leave is already processed or for temporary marking
3. **Specify `leaveType`** when using configured leaves to ensure proper balance tracking
4. **Use bulk operations** for efficiency when marking multiple employees
5. **Check results** after bulk operations to identify any failures

---

**Version:** 1.0  
**Last Updated:** 2026-01-14
