# Leave Management System Documentation

## Overview
The Leave Management System supports two types of leaves:
1. **Configured Leaves**: Pre-defined leave types (e.g., Maternity Leave - 15 days) that can be assigned to employees
2. **Casual Leaves**: Ad-hoc leave requests that don't require a leave configuration

## Key Features

### 1. Leave Configurations
- Create leave types (e.g., "Maternity Leave", "Sick Leave", "Annual Leave")
- Each configuration has a name, description, and maximum days
- Configurations can be assigned to all employees at once

### 2. Leave Allocations
- Assign configured leaves to employees
- Track `assignedDays`, `usedDays`, and `remainingDays`
- Bulk assignment: Assign a leave configuration to all active employees at once
- Automatic balance calculation when leaves are approved/rejected

### 3. Leave Requests
- Employees can request leaves
- Two types:
  - **Configured Leave**: Linked to a leave allocation (e.g., Maternity Leave)
  - **Casual Leave**: No allocation required (default type)
- Automatic linking to leave allocation based on `leaveType`
- Balance validation before approval

## API Endpoints

### Bulk Assignment

**Endpoint:** `POST /leave/leave-allocations/assignToAll`

**Description:** Assigns a leave configuration to all active employees at once.

**Request Body:**
```json
{
  "leaveConfigId": "123e4567-e89b-12d3-a456-426614174000",
  "assignedDays": 15,
  "allocationStartDate": "2024-01-01",
  "allocationEndDate": "2024-12-31",
  "note": "Annual maternity leave allocation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Leave configuration assigned to all employees successfully!",
  "data": [
    {
      "id": "alloc-id-1",
      "employeeId": "emp-id-1",
      "leaveConfigId": "123e4567-e89b-12d3-a456-426614174000",
      "assignedDays": 15,
      "usedDays": 0,
      "remainingDays": 15,
      "allocationStartDate": "2024-01-01T00:00:00.000Z",
      "allocationEndDate": "2024-12-31T23:59:59.999Z",
      "note": "Annual maternity leave allocation"
    }
    // ... more allocations
  ]
}
```

### Create Leave Request

**Endpoint:** `POST /leave/leave-requests/create`

**Request Body for Configured Leave:**
```json
{
  "employeeId": "emp-id",
  "leaveType": "MATERNITY",
  "startDate": "2024-03-01",
  "endDate": "2024-03-15",
  "reason": "Maternity leave"
}
```

**Request Body for Casual Leave:**
```json
{
  "employeeId": "emp-id",
  "leaveType": "CASUAL",
  "startDate": "2024-03-01",
  "endDate": "2024-03-03",
  "reason": "Personal work"
}
```

**Note:** If `leaveType` is not "CASUAL", the system automatically finds and links the appropriate leave allocation. If no allocation is found, it defaults to casual leave.

### Update Leave Request Status

**Endpoint:** `POST /leave/leave-requests/updateStatus`

**Request Body:**
```json
{
  "id": "request-id",
  "status": "APPROVED"
}
```

**Behavior:**
- **APPROVED**: Deducts days from leave allocation balance (if configured leave)
- **REJECTED**: Restores days to leave allocation balance (if previously approved)
- Validates sufficient balance before approval

## Usage Examples

### Example 1: Assign Maternity Leave to All Employees

```bash
POST /leave/leave-allocations/assignToAll
{
  "leaveConfigId": "maternity-leave-config-id",
  "assignedDays": 15,
  "allocationStartDate": "2024-01-01",
  "allocationEndDate": "2024-12-31",
  "note": "Maternity leave - 15 days per year"
}
```

This will:
- Create leave allocations for all active employees
- Set `assignedDays = 15`
- Set `usedDays = 0`
- Set `remainingDays = 15`

### Example 2: Employee Requests Maternity Leave

```bash
POST /leave/leave-requests/create
{
  "employeeId": "employee-id",
  "leaveType": "MATERNITY",
  "startDate": "2024-06-01",
  "endDate": "2024-06-15",
  "reason": "Maternity leave"
}
```

The system will:
- Automatically find the "MATERNITY" leave configuration
- Link to the employee's maternity leave allocation
- Create the request with `leaveAllocationId` set

### Example 3: Employee Requests Casual Leave

```bash
POST /leave/leave-requests/create
{
  "employeeId": "employee-id",
  "leaveType": "CASUAL",
  "startDate": "2024-06-20",
  "endDate": "2024-06-22",
  "reason": "Personal work"
}
```

The system will:
- Create the request without `leaveAllocationId`
- Mark as casual leave (no balance tracking)

### Example 4: Approve Leave Request

```bash
POST /leave/leave-requests/updateStatus
{
  "id": "request-id",
  "status": "APPROVED"
}
```

The system will:
- Check if it's a configured leave (has `leaveAllocationId`)
- Validate sufficient balance
- Deduct days from `remainingDays`
- Update `usedDays`

## Database Schema Changes

### LeaveRequest Table
- Added `leaveAllocationId` (nullable): Links to LeaveAllocation if configured leave
- Added `leaveType` (default: "CASUAL"): Type of leave (CASUAL, MATERNITY, SICK, etc.)

### LeaveAllocation Table
- Added `usedDays` (default: 0): Days used from approved requests
- Added `remainingDays` (default: 0): Days remaining (assignedDays - usedDays)
- Added relation to `LeaveRequest[]`

## Migration

**Migration File:** `prisma/migrations/20260114023000_update_leave_system/migration.sql`

**What it does:**
1. Adds `leaveAllocationId` and `leaveType` to `LeaveRequest`
2. Adds `usedDays` and `remainingDays` to `LeaveAllocation`
3. Calculates initial values for existing records
4. Creates foreign key relationship

**To apply:**
```bash
npx prisma migrate deploy
npx prisma generate
```

## Important Notes

1. **Bulk Assignment**: Only creates allocations for employees who don't already have that leave configuration assigned.

2. **Automatic Linking**: When creating a leave request with a `leaveType` (not CASUAL), the system automatically finds the matching leave configuration and links it.

3. **Balance Validation**: Before approving a configured leave, the system checks if sufficient days are available.

4. **Casual Leave**: No balance tracking - employees can request casual leave anytime.

5. **Leave Types**: Common types include:
   - `CASUAL` - Casual leave (no allocation needed)
   - `MATERNITY` - Maternity leave
   - `SICK` - Sick leave
   - `ANNUAL` - Annual leave
   - `EMERGENCY` - Emergency leave

6. **Balance Calculation**: The system automatically calculates `usedDays` and `remainingDays` based on approved leave requests.

## Error Handling

### Insufficient Balance
```json
{
  "success": false,
  "message": "Insufficient leave balance. Available: 5 days, Requested: 10 days"
}
```

### Leave Configuration Not Found
If a leave type is specified but no matching configuration exists, the request defaults to casual leave.

---

**Version:** 1.0  
**Last Updated:** 2026-01-14
