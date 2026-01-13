# Attendance Request System Documentation

## Overview
The Attendance Request System ensures that attendance updates require approval unless the user has direct editing permissions. This provides better control and auditability for attendance changes.

## Features

### 1. Permission-Based Attendance Editing
- Users with `attendance.update.direct.*` permission can edit attendance directly
- Users without this permission must submit attendance update requests for approval

### 2. Attendance Request System
- All attendance update requests are stored with proposed changes
- Requests require approval from authorized users
- Approved requests automatically apply the proposed changes

### 3. Permission-Based Request Approval
- Only users with `attendance.request.approve.*` permission can approve/reject requests

---

## Database Schema Changes

### AttendanceRequest Model

The `AttendanceRequest` model has been extended to support attendance update requests:

**New Fields:**
- `attendanceId` (String, nullable): ID of the attendance record to be updated
- `proposedStatus` (String, nullable): Proposed attendance status
- `proposedCheckIn` (DateTime, nullable): Proposed check-in time
- `proposedCheckOut` (DateTime, nullable): Proposed check-out time
- `proposedComment` (String, nullable): Proposed comment
- `proposedLocation` (String, nullable): Proposed location
- `proposedDate` (DateTime, nullable): Proposed date
- `requestedBy` (String, nullable): User ID who created the request
- `approvedBy` (String, nullable): User ID who approved/rejected the request

---

## API Endpoints

### Attendance Request Endpoints (All Return Master-Detail Format)

All attendance request read endpoints return data in **master-detail format**, including:
- **Master**: Attendance request fields
- **Detail**: Complete employee information
- **User Names**: Resolved usernames for requestedBy and approvedBy

#### Available Read Endpoints:

1. **GET /attendanceReq/get** - Get all attendance requests
2. **POST /attendanceReq/get** - Get paginated attendance requests
3. **POST /attendanceReq/getById** - Get attendance request by ID
4. **POST /attendanceReq/getEmployee** - Get requests by employee ID
5. **POST /attendanceReq/search** - Search attendance requests
6. **GET /attendanceReq/deleted** - Get deleted attendance requests

---

### 1. Update Attendance (Permission-Protected)

**Endpoint:** `PUT /attendance/update`

**Description:** Updates attendance. If user has permission, updates directly. Otherwise, creates an attendance request.

**Request Body:**
```json
{
  "id": "attendance-id",
  "data": {
    "status": "PRESENT",
    "checkIn": "2024-01-20T09:00:00Z",
    "checkOut": "2024-01-20T17:00:00Z",
    "comment": "Updated attendance",
    "location": "Office"
  }
}
```

**Response - Direct Update (Has Permission):**
```json
{
  "success": true,
  "message": "Attendance updated successfully!",
  "data": { /* updated attendance record */ }
}
```

**Response - Request Created (No Permission):**
```json
{
  "success": true,
  "message": "Your attendance update has been submitted for approval. You don't have permission to edit attendance directly.",
  "requiresApproval": true,
  "requestId": "request-id",
  "data": { /* attendance request record */ }
}
```

**Status Codes:**
- `200` - Direct update successful (has permission)
- `202` - Request created successfully (requires approval)
- `400` - Bad request
- `403` - Forbidden
- `404` - Attendance not found

---

### 2. Get All Attendance Requests (Master-Detail)

**Endpoint:** `GET /attendanceReq/get`

**Description:** Retrieves all attendance requests with employee details in master-detail format.

**Response:**
```json
{
  "success": true,
  "message": "Attendance requests retrieved successfully!",
  "data": [
    {
      // ... (see Response Structure section below)
    }
  ]
}
```

---

### 3. Get Paginated Attendance Requests (Master-Detail)

**Endpoint:** `POST /attendanceReq/get`

**Description:** Retrieves paginated attendance requests with employee details.

**Request Body:**
```json
{
  "page": 1,
  "pageSize": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Attendance requests retrieved successfully!",
  "data": {
    "data": [ /* array of requests with employee details */ ],
    "totalSize": 50
  }
}
```

---

### 4. Get Attendance Request by ID (Master-Detail)

**Endpoint:** `POST /attendanceReq/getById`

**Description:** Retrieves a single attendance request by ID with employee details.

**Request Body:**
```json
{
  "id": "request-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Attendance request retrieved successfully!",
  "data": {
    // ... (see Response Structure section below)
  }
}
```

---

### 5. Get Attendance Requests by Employee ID (Master-Detail)

**Endpoint:** `POST /attendanceReq/getEmployee`

**Description:** Retrieves all attendance requests for a specific employee with employee details.

**Request Body:**
```json
{
  "employeeId": "employee-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Attendance requests for the employee retrieved successfully!",
  "data": [
    // ... array of requests with employee details
  ]
}
```

---

### 6. Approve/Reject Attendance Request

**Endpoint:** `POST /attendanceReq/updateStatus`

**Description:** Approves or rejects an attendance request. Requires `attendance.request.approve.*` permission.

**Request Body:**
```json
{
  "id": "request-id",
  "status": "APPROVED"  // or "REJECTED" or "PENDING"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Attendance request status updated successfully!",
  "data": { /* updated request record */ }
}
```

**Behavior:**
- If `APPROVED` and request has `attendanceId`: Updates the attendance with proposed changes
- If `APPROVED` and request has no `attendanceId`: Creates new attendance with proposed data
- If `REJECTED`: Request status is updated, no attendance changes are made
- Sets `approvedBy` field to the user who approved/rejected

**Status Codes:**
- `200` - Request status updated successfully
- `403` - User doesn't have permission to approve requests
- `404` - Request not found

---

## Feature Permissions

### 1. Attendance Update Direct Permission
**Feature ID:** `attendance.update.direct.*`

**Description:** Allows users to edit attendance directly without requiring approval.

**Location in staticData.ts:**
```typescript
{ name: "attendance.update.direct.*", parentFeatureId: "attendance.update.*", label: "Update Attendance Directly (No Approval Required)" }
```

### 2. Attendance Request Approval Permission
**Feature ID:** `attendance.request.approve.*`

**Description:** Allows users to approve or reject attendance requests.

**Location in staticData.ts:**
```typescript
{ name: "attendance.request.approve.*", parentFeatureId: "attendanceReq.*", label: "Approve/Reject Attendance Requests" }
```

---

## Usage Examples

### Example 1: User Without Direct Edit Permission Tries to Update Attendance

**Request:**
```bash
PUT /attendance/update
{
  "id": "attendance-id",
  "data": {
    "status": "PRESENT",
    "checkIn": "2024-01-20T09:00:00Z",
    "comment": "Fixed check-in time"
  }
}
```

**What happens:**
1. System checks if user has `attendance.update.direct.*` permission
2. User doesn't have permission
3. System creates an attendance request with:
   - `attendanceId`: The attendance to be updated
   - `proposedStatus`: "PRESENT"
   - `proposedCheckIn`: "2024-01-20T09:00:00Z"
   - `proposedComment`: "Fixed check-in time"
   - `status`: "PENDING"
   - `requestedBy`: Current user ID
4. Returns response with `requiresApproval: true` and `requestId`

**Response:**
```json
{
  "success": true,
  "message": "Your attendance update has been submitted for approval. You don't have permission to edit attendance directly.",
  "requiresApproval": true,
  "requestId": "req-123",
  "data": { /* request details */ }
}
```

---

### Example 2: User With Direct Edit Permission Updates Attendance

**Request:**
```bash
PUT /attendance/update
{
  "id": "attendance-id",
  "data": {
    "status": "LATE",
    "checkIn": "2024-01-20T09:30:00Z",
    "comment": "Updated to late"
  }
}
```

**What happens:**
1. System checks if user has `attendance.update.direct.*` permission
2. User has permission
3. System directly updates the attendance record
4. Returns success response

**Response:**
```json
{
  "success": true,
  "message": "Attendance updated successfully!",
  "data": { /* updated attendance record */ }
}
```

---

### Example 3: Approve Attendance Request

**Request:**
```bash
POST /attendance-request/updateStatus
{
  "id": "req-123",
  "status": "APPROVED"
}
```

**What happens:**
1. System checks if user has `attendance.request.approve.*` permission
2. User has permission
3. System retrieves the request
4. If `attendanceId` exists: Updates the attendance with proposed changes
5. If no `attendanceId`: Creates new attendance with proposed data
6. Updates request status to `APPROVED` and sets `approvedBy`
7. Returns success response

**Response:**
```json
{
  "success": true,
  "message": "Attendance request status updated successfully!",
  "data": { /* updated request */ }
}
```

---

### Example 4: Reject Attendance Request

**Request:**
```bash
POST /attendance-request/updateStatus
{
  "id": "req-123",
  "status": "REJECTED"
}
```

**What happens:**
1. System checks if user has `attendance.request.approve.*` permission
2. User has permission
3. System updates request status to `REJECTED`
4. No attendance changes are made
5. Returns success response

**Response:**
```json
{
  "success": true,
  "message": "Attendance request status updated successfully!",
  "data": { /* updated request */ }
}
```

---

## Workflow

### Updating Attendance Without Permission

```
User attempts to update attendance
         ↓
Check permission: attendance.update.direct.*
         ↓
    No Permission
         ↓
Create attendance request with:
  - Proposed changes
  - Status: PENDING
  - requestedBy: Current user
         ↓
Return: requiresApproval: true
         ↓
Request appears in approval queue
         ↓
Authorized user reviews and approves/rejects
         ↓
If approved: Apply proposed changes to attendance
If rejected: Request marked as rejected
```

### Updating Attendance With Permission

```
User attempts to update attendance
         ↓
Check permission: attendance.update.direct.*
         ↓
   Has Permission
         ↓
Directly update attendance record
         ↓
Return: Success response
```

---

## Important Notes

1. **Permission Checking:**
   - Permission checks are performed on every update attempt
   - If permission check fails or user has no permission, a request is created automatically
   - Users with `attendance.update.direct.*` can bypass the request system

2. **Request Approval:**
   - Only users with `attendance.request.approve.*` can approve/reject requests
   - Approving a request applies all proposed changes immediately
   - Rejecting a request doesn't affect the attendance record

3. **Proposed Changes:**
   - All proposed changes are stored in the request
   - Only non-null/non-undefined values are applied when approved
   - Original attendance values are preserved until approval

4. **Audit Trail:**
   - `requestedBy` tracks who created the request
   - `approvedBy` tracks who approved/rejected the request
   - All attendance updates maintain their existing audit trail (`previousUpdates`)

5. **Request Status:**
   - `PENDING`: Awaiting approval
   - `APPROVED`: Approved and changes applied
   - `REJECTED`: Rejected, no changes applied

---

## Response Structure - Master-Detail Format

All attendance request endpoints return data in master-detail format with employee information included:

### Response Structure

```json
{
  "success": true,
  "message": "Attendance requests retrieved successfully!",
  "data": [
    {
      // Attendance Request Fields (Master)
      "id": "request-id",
      "employeeId": "emp-id",
      "attendanceId": "attendance-id",
      "reason": "Update check-in time",
      "status": "PENDING",
      "image": null,
      "location": "Office",
      
      // Proposed Changes
      "proposedStatus": "PRESENT",
      "proposedCheckIn": "2024-01-20T09:00:00.000Z",
      "proposedCheckOut": "2024-01-20T17:00:00.000Z",
      "proposedComment": "Fixed check-in time",
      "proposedLocation": "Office",
      "proposedDate": "2024-01-20T00:00:00.000Z",
      
      // User Tracking
      "requestedBy": "user-id",
      "approvedBy": null,
      "requestedByName": "john.doe",
      "approvedByName": null,
      
      // Timestamps
      "createdAt": "2024-01-20T10:00:00.000Z",
      "updatedAt": "2024-01-20T10:00:00.000Z",
      "isDeleted": null,
      
      // Employee Details (Detail)
      "employeeCode": "EMP001",
      "employeeName": "John",
      "employeeSurname": "Doe",
      "employeeDesignation": "Software Engineer",
      "employeeDepartment": "IT",
      "employeeContactNo": "+1234567890",
      "employeeAddress": "123 Main St",
      "employeeImage": "image-url",
      "employeeStatus": "ACTIVE"
    }
  ]
}
```

### Employee Fields Included

All attendance request responses include the following employee details:
- `employeeId` - Employee ID
- `employeeCode` - Employee code
- `employeeName` - Employee first name
- `employeeSurname` - Employee last name
- `employeeDesignation` - Employee designation/job title
- `employeeDepartment` - Employee department
- `employeeContactNo` - Employee contact number
- `employeeAddress` - Employee address
- `employeeImage` - Employee profile image URL
- `employeeStatus` - Employee status (ACTIVE, RESIGNED, etc.)

### User Name Fields

- `requestedByName` - Username of the user who created the request (resolved from `requestedBy`)
- `approvedByName` - Username of the user who approved/rejected the request (resolved from `approvedBy`)

---

## Migration Required

**Migration File:** `prisma/migrations/20260115000000_update_attendance_request/migration.sql`

**Important:** This migration is **safe** and **non-destructive**. It only adds new columns and does not modify or delete any existing data.

After schema changes, you need to run:

```bash
npx prisma migrate deploy
npx prisma generate
```

**Migration SQL will add:**
- `attendanceId` column (nullable) - Links to attendance record being updated
- `proposedStatus` column (nullable) - Proposed attendance status
- `proposedCheckIn` column (nullable) - Proposed check-in time
- `proposedCheckOut` column (nullable) - Proposed check-out time
- `proposedComment` column (nullable) - Proposed comment
- `proposedLocation` column (nullable) - Proposed location
- `proposedDate` column (nullable) - Proposed date
- `requestedBy` column (nullable) - User ID who created the request
- `approvedBy` column (nullable) - User ID who approved/rejected the request

**Safety Features:**
- All new columns are nullable, so existing records remain valid
- No existing columns are modified or deleted
- No existing data is affected
- Migration uses `ADD COLUMN IF NOT EXISTS` for idempotency

---

## Error Handling

### 403 Forbidden - No Permission to Approve

```json
{
  "success": false,
  "message": "You don't have permission to approve attendance requests."
}
```

### 404 Not Found - Attendance Not Found

```json
{
  "success": false,
  "message": "Attendance with ID {id} not found."
}
```

### 404 Not Found - Request Not Found

```json
{
  "success": false,
  "message": "Attendance request with ID {id} not found."
}
```

---

## Best Practices

1. **Grant Direct Edit Permission Sparingly:**
   - Only grant `attendance.update.direct.*` to trusted administrators
   - Most users should go through the request system

2. **Monitor Request Queue:**
   - Regularly check pending attendance requests
   - Set up notifications for new requests

3. **Review Proposed Changes:**
   - Always review proposed changes before approving
   - Check for suspicious or unusual updates

4. **Use Comments:**
   - Encourage users to provide reasons in comments when requesting updates
   - Review comments during approval process

---

---

## Complete API Reference

### Get All Attendance Requests
- **Endpoint:** `GET /attendanceReq/get`
- **Returns:** Array of attendance requests with employee details

### Get Paginated Attendance Requests
- **Endpoint:** `POST /attendanceReq/get`
- **Body:** `{ "page": 1, "pageSize": 10 }`
- **Returns:** Paginated result with employee details

### Get Attendance Request by ID
- **Endpoint:** `POST /attendanceReq/getById`
- **Body:** `{ "id": "request-id" }`
- **Returns:** Single request with employee details

### Get Requests by Employee ID
- **Endpoint:** `POST /attendanceReq/getEmployee`
- **Body:** `{ "employeeId": "employee-id" }`
- **Returns:** Array of requests for that employee with employee details

### Search Attendance Requests
- **Endpoint:** `POST /attendanceReq/search`
- **Body:** `{ "searchTerm": "search term", "page": 1, "pageSize": 10 }`
- **Returns:** Paginated search results with employee details
- **Searchable fields:** reason, status, location

---

**Version:** 1.0  
**Last Updated:** 2026-01-15
