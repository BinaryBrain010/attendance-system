# Activity Log System Documentation

## Overview
The Activity Log System provides comprehensive tracking of all user actions across the application. It records who did what, when, and provides detailed metadata about each action.

## Features

### 1. Automatic Activity Logging
- Integrated into `BaseController` for automatic logging
- Non-blocking async logging (won't break main flow if logging fails)
- Extracts user information, IP address, and user agent from requests

### 2. Comprehensive Tracking
- **User Actions**: CREATE, UPDATE, DELETE, READ, APPROVE, REJECT, LOGIN, LOGOUT, etc.
- **Entity Types**: Employee, Attendance, AttendanceRequest, Unit, etc.
- **Metadata**: Stores before/after states, changes, and custom data
- **Context**: IP address, user agent, timestamps

### 3. Flexible Querying
- Filter by user, action, entity type, entity ID
- Date range filtering
- Pagination support
- Count queries

---

## Database Schema

### ActivityLog Model

```prisma
model ActivityLog {
  id          String    @id @default(uuid())
  userId      String?   // User who performed the action
  action      String    // CREATE, UPDATE, DELETE, READ, etc.
  entityType  String    // Employee, Attendance, etc.
  entityId    String?   // ID of the affected entity
  description String?   // Human-readable description
  metadata    Json?     // Additional data (before/after, changes, etc.)
  ipAddress   String?   // IP address of the request
  userAgent   String?   // User agent/browser info
  createdAt   DateTime? @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([entityType, entityId])
  @@index([action])
  @@index([createdAt])
}
```

---

## Usage

### 1. Automatic Logging in Controllers

The `BaseController` now supports automatic activity logging:

```typescript
async createEmployee(req: Request, res: Response) {
  const employeeData = req.body;
  const userId = (req as Request & { userId?: string }).userId;

  const operation = () => this.service.createEmployee(employeeData);
  await this.handleRequest(operation, res, {
    successMessage: "Employee created successfully!",
    statusCode: 201,
    logActivity: {
      action: "CREATE",
      entityType: "Employee",
      entityId: (result) => result.id, // Extract ID from result
      description: `Employee ${employeeData.name} created`,
      metadata: { employeeData }
    },
    req // Pass request for logging
  });
}
```

### 2. Manual Logging

You can also log activities manually:

```typescript
import { logActivityFromRequest } from '../ActivityLog/helper/activityLog.helper';

// Simple logging
await logActivityFromRequest(
  req,
  "UPDATE",
  "Attendance",
  attendanceId,
  "Attendance updated",
  { changes: { status: "PRESENT" } }
);

// With before/after states
import { createMetadataFromChanges } from '../ActivityLog/helper/activityLog.helper';

const metadata = createMetadataFromChanges(
  oldAttendance,
  newAttendance,
  { status: "ABSENT", checkIn: null }
);

await logActivityFromRequest(
  req,
  "UPDATE",
  "Attendance",
  attendanceId,
  "Attendance status changed",
  metadata
);
```

### 3. Logging Different Actions

```typescript
// CREATE
logActivity: {
  action: "CREATE",
  entityType: "Employee",
  description: "New employee created"
}

// UPDATE
logActivity: {
  action: "UPDATE",
  entityType: "Attendance",
  entityId: attendanceId,
  description: "Attendance updated"
}

// DELETE
logActivity: {
  action: "DELETE",
  entityType: "Unit",
  entityId: unitId,
  description: "Unit deleted"
}

// APPROVE/REJECT
logActivity: {
  action: "APPROVE",
  entityType: "AttendanceRequest",
  entityId: requestId,
  description: "Attendance request approved"
}

// LOGIN/LOGOUT
logActivity: {
  action: "LOGIN",
  entityType: "User",
  entityId: userId,
  description: "User logged in"
}
```

---

## API Endpoints

### Get All Activity Logs
**GET** `/activityLog/get`

**Query Parameters:**
- `userId` (optional): Filter by user ID
- `action` (optional): Filter by action
- `entityType` (optional): Filter by entity type
- `entityId` (optional): Filter by entity ID
- `from` (optional): Filter from date
- `to` (optional): Filter to date

**Response:**
```json
{
  "success": true,
  "message": "Activity logs retrieved successfully!",
  "data": [
    {
      "id": "uuid",
      "userId": "user-uuid",
      "userName": "username",
      "action": "CREATE",
      "entityType": "Employee",
      "entityId": "employee-uuid",
      "description": "Employee created",
      "metadata": {},
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-01-17T10:00:00Z"
    }
  ]
}
```

### Get Paginated Activity Logs
**POST** `/activityLog/get`

**Request Body:**
```json
{
  "page": 1,
  "pageSize": 10,
  "userId": "optional-user-id",
  "action": "optional-action",
  "entityType": "optional-entity-type",
  "entityId": "optional-entity-id",
  "from": "2026-01-01",
  "to": "2026-01-31"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Activity logs retrieved successfully!",
  "data": {
    "data": [...],
    "totalSize": 100
  }
}
```

### Get Activity Log by ID
**POST** `/activityLog/getById`

**Request Body:**
```json
{
  "id": "activity-log-uuid"
}
```

### Get Activity Log Count
**GET** `/activityLog/count`

**Query Parameters:** Same as GET `/activityLog/get`

**Response:**
```json
{
  "success": true,
  "message": "Activity log count retrieved successfully!",
  "data": 150
}
```

### Get Activity Logs by User
**POST** `/activityLog/getByUser`

**Request Body:**
```json
{
  "userId": "user-uuid",
  "page": 1,
  "pageSize": 10,
  "action": "optional",
  "entityType": "optional",
  "from": "optional",
  "to": "optional"
}
```

### Get Activity Logs by Entity
**POST** `/activityLog/getByEntity`

**Request Body:**
```json
{
  "entityType": "Employee",
  "entityId": "employee-uuid",
  "page": 1,
  "pageSize": 10,
  "userId": "optional",
  "action": "optional",
  "from": "optional",
  "to": "optional"
}
```

---

## Permissions

The following permissions are available:

- `activityLog.*` - Activity Log (Nav)
- `activityLog.read.*` - Read Activity Logs
- `activityLog.read.own.*` - Read Own Activity Logs

---

## Integration Examples

### Example 1: Employee Creation
```typescript
async createEmployee(req: Request, res: Response) {
  const employeeData = req.body;
  
  const operation = () => this.service.createEmployee(employeeData);
  await this.handleRequest(operation, res, {
    successMessage: "Employee created successfully!",
    statusCode: 201,
    logActivity: {
      action: "CREATE",
      entityType: "Employee",
      entityId: (result: any) => result.id,
      description: `Employee ${employeeData.name} ${employeeData.surname} created`,
      metadata: { employeeCode: employeeData.code }
    },
    req
  });
}
```

### Example 2: Attendance Update
```typescript
async updateAttendance(req: Request, res: Response) {
  const { id, data } = req.body;
  
  // Get old data for comparison
  const oldAttendance = await this.service.getAttendanceById(id);
  
  const operation = () => this.service.updateAttendance(id, data);
  await this.handleRequest(operation, res, {
    successMessage: "Attendance updated successfully!",
    logActivity: {
      action: "UPDATE",
      entityType: "Attendance",
      entityId: id,
      description: "Attendance updated",
      metadata: (result: any) => createMetadataFromChanges(oldAttendance, result)
    },
    req
  });
}
```

### Example 3: Login
```typescript
async loginUser(req: Request, res: Response) {
  const { username, password } = req.body;
  
  const operation = () => this.service.login(username, password);
  await this.handleRequest(operation, res, {
    successMessage: "Login successful!",
    logActivity: {
      action: "LOGIN",
      entityType: "User",
      entityId: (result: any) => result.user?.id,
      description: `User ${username} logged in`,
      metadata: { platform: req.body.platform }
    },
    req
  });
}
```

---

## Best Practices

1. **Always log important actions**: CREATE, UPDATE, DELETE, APPROVE, REJECT
2. **Include meaningful descriptions**: Help users understand what happened
3. **Store relevant metadata**: Before/after states, changes, context
4. **Use entityId when available**: Makes it easier to track entity history
5. **Don't log sensitive data**: Avoid logging passwords, tokens, etc.

---

## Migration

To apply the Activity Log system:

1. **Run Prisma migration:**
   ```bash
   npx prisma migrate deploy
   ```

2. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Restart the server**

---

## Notes

- Activity logging is **non-blocking** - if logging fails, it won't break the main operation
- All activity logs include user information (if authenticated)
- IP address and user agent are automatically captured
- Indexes are created for efficient querying
- Activity logs are never deleted (for audit purposes)
