# Unit System Documentation

## Overview
The Unit System provides a generic organizational structure to group employees into units (service centers, branches, outlets, departments, stores, etc.). This system enables:

- **Unit Management**: Create, update, delete, and manage organizational units
- **Employee Assignment**: Assign employees to units (many-to-many relationship)
- **Access Control**: Restrict employees and attendance visibility based on unit membership
- **Supervisor Access**: Allow specific users to access all employees and attendances

## Features

### 1. Unit Management
- Create units with different types (SERVICE_CENTER, BRANCH, OUTLET, DEPARTMENT, STORE, etc.)
- Each unit can have an attendance manager (employee who manages attendance for that unit)
- Full CRUD operations with audit trail support

### 2. Employee-Unit Relationships
- Many-to-many relationship: Employees can belong to multiple units
- Units can have multiple employees
- Bulk assignment operations (assign, add, remove)
- Individual employee management

### 3. Permission System
- Unit-specific permissions for management
- Supervisor permissions to access all employees/attendances
- Role-based access control integration

---

## Database Schema

### Unit Model

```prisma
model Unit {
  id                  String      @id @default(uuid()) @db.VarChar(36)
  name                String
  type                UnitType
  description         String?
  address             String?
  contactNo           String?
  email               String?
  attendanceManagerId String?     @db.VarChar(36)
  createdAt           DateTime?   @default(now())
  updatedAt           DateTime?   @updatedAt
  isDeleted           DateTime?
  createdBy           String?     @db.VarChar(36)
  updatedBy           String?     @db.VarChar(36)
  previousUpdates     Json?       @db.JsonB

  attendanceManager   Employee?   @relation("UnitAttendanceManager", fields: [attendanceManagerId], references: [id])
  employees           UnitEmployee[]
}
```

### UnitEmployee Model (Junction Table)

```prisma
model UnitEmployee {
  id         String    @id @default(uuid()) @db.VarChar(36)
  unitId     String    @db.VarChar(36)
  employeeId String    @db.VarChar(36)
  createdAt  DateTime? @default(now())
  updatedAt  DateTime? @updatedAt
  isDeleted  DateTime?

  unit      Unit      @relation(fields: [unitId], references: [id])
  employee  Employee  @relation(fields: [employeeId], references: [id])

  @@unique([unitId, employeeId])
}
```

### UnitType Enum

```prisma
enum UnitType {
  SERVICE_CENTER
  BRANCH
  OUTLET
  DEPARTMENT
  STORE
  WAREHOUSE
  OFFICE
  FACTORY
  OTHER
}
```

---

## API Endpoints

### Unit Endpoints

#### 1. Get All Units

**Endpoint:** `GET /unit/getAll`

**Description:** Retrieves all active units with their attendance manager details.

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "message": "Units retrieved successfully!",
  "data": [
    {
      "id": "unit-id",
      "name": "Karachi Branch",
      "type": "BRANCH",
      "description": "Main branch in Karachi",
      "address": "123 Main Street, Karachi",
      "contactNo": "+92-300-1234567",
      "email": "karachi@company.com",
      "attendanceManagerId": "employee-id",
      "attendanceManager": {
        "id": "employee-id",
        "name": "John",
        "surname": "Doe",
        "code": "EMP001"
      },
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "isDeleted": null,
      "createdBy": "user-id",
      "updatedBy": "user-id",
      "previousUpdates": []
    }
  ]
}
```

**Business Logic:**
- Returns all units where `isDeleted` is `null`
- Includes attendance manager details (id, name, surname, code)
- Ordered by `createdAt` descending

---

#### 2. Get Paginated Units

**Endpoint:** `GET /unit/get`

**Description:** Retrieves units with pagination support.

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `pageSize` (integer, optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "message": "Units retrieved successfully!",
  "data": {
    "data": [
      {
        "id": "unit-id",
        "name": "Karachi Branch",
        "type": "BRANCH",
        "description": "Main branch in Karachi",
        "address": "123 Main Street, Karachi",
        "contactNo": "+92-300-1234567",
        "email": "karachi@company.com",
        "attendanceManagerId": "employee-id",
        "attendanceManager": {
          "id": "employee-id",
          "name": "John",
          "surname": "Doe",
          "code": "EMP001"
        },
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z",
        "isDeleted": null,
        "createdBy": "user-id",
        "updatedBy": "user-id",
        "previousUpdates": []
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 10,
    "totalPages": 5
  }
}
```

**Business Logic:**
- Paginates results based on `page` and `pageSize`
- Returns total count and pagination metadata
- Includes attendance manager details
- Ordered by `createdAt` descending

---

#### 3. Get Unit by ID

**Endpoint:** `GET /unit/getById`

**Description:** Retrieves a single unit by ID with attendance manager and update history.

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `id` (string, required): Unit ID

**Response:**
```json
{
  "success": true,
  "message": "Unit retrieved successfully!",
  "data": {
    "id": "unit-id",
    "name": "Karachi Branch",
    "type": "BRANCH",
    "description": "Main branch in Karachi",
    "address": "123 Main Street, Karachi",
    "contactNo": "+92-300-1234567",
    "email": "karachi@company.com",
    "attendanceManagerId": "employee-id",
    "attendanceManager": {
      "id": "employee-id",
      "name": "John",
      "surname": "Doe",
      "code": "EMP001"
    },
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "isDeleted": null,
    "createdBy": "user-id",
    "updatedBy": "user-id",
    "updatedByName": "john.doe",
    "previousUpdates": []
  }
}
```

**Business Logic:**
- Returns unit with `id` matching the provided ID
- Includes attendance manager details
- Includes `updatedByName` (resolved username from `updatedBy`)
- Returns `null` if unit not found or deleted

**Error Responses:**
- `400`: Unit ID is required
- `404`: Unit not found

---

#### 4. Get Deleted Units

**Endpoint:** `GET /unit/deleted`

**Description:** Retrieves soft-deleted units with pagination.

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `pageSize` (integer, optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "message": "Deleted units retrieved successfully!",
  "data": {
    "data": [
      {
        "id": "unit-id",
        "name": "Old Branch",
        "type": "BRANCH",
        "isDeleted": "2024-01-20T10:00:00.000Z",
        // ... other fields
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

**Business Logic:**
- Returns units where `isDeleted` is not `null`
- Paginated results
- Ordered by `createdAt` descending

---

#### 5. Get Total Units Count

**Endpoint:** `GET /unit/total`

**Description:** Returns the total count of active units.

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "message": "Total units count retrieved successfully!",
  "data": 50
}
```

**Business Logic:**
- Counts units where `isDeleted` is `null`
- Returns integer count

---

#### 6. Create Unit

**Endpoint:** `POST /unit/create`

**Description:** Creates a new unit.

**Authentication:** Required (Bearer Token)

**Permission Required:** `unit.create.*`

**Request Body:**
```json
{
  "name": "Karachi Branch",
  "type": "BRANCH",
  "description": "Main branch in Karachi",
  "address": "123 Main Street, Karachi",
  "contactNo": "+92-300-1234567",
  "email": "karachi@company.com",
  "attendanceManagerId": "employee-id",
  "createdByUserId": "user-id"
}
```

**Request Body Fields:**
- `name` (string, required): Unit name
- `type` (UnitType, required): Unit type (SERVICE_CENTER, BRANCH, OUTLET, DEPARTMENT, STORE, WAREHOUSE, OFFICE, FACTORY, OTHER)
- `description` (string, optional): Unit description
- `address` (string, optional): Unit address
- `contactNo` (string, optional): Contact number
- `email` (string, optional): Email address
- `attendanceManagerId` (string, optional): Employee ID who manages attendance
- `createdByUserId` (string, optional): User ID who created the unit

**Response:**
```json
{
  "success": true,
  "message": "Unit created successfully!",
  "data": {
    "id": "unit-id",
    "name": "Karachi Branch",
    "type": "BRANCH",
    "description": "Main branch in Karachi",
    "address": "123 Main Street, Karachi",
    "contactNo": "+92-300-1234567",
    "email": "karachi@company.com",
    "attendanceManagerId": "employee-id",
    "attendanceManager": {
      "id": "employee-id",
      "name": "John",
      "surname": "Doe",
      "code": "EMP001"
    },
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "isDeleted": null,
    "createdBy": "user-id",
    "updatedBy": null,
    "previousUpdates": []
  }
}
```

**Business Logic:**
- Creates a new unit with provided data
- Sets `createdAt` timestamp
- Sets `createdBy` from `createdByUserId`
- Initializes `previousUpdates` as empty array
- Links to attendance manager if `attendanceManagerId` provided
- Returns created unit with attendance manager details

**Error Responses:**
- `400`: Invalid request data
- `401`: Unauthorized
- `500`: Server error

---

#### 7. Update Unit

**Endpoint:** `PUT /unit/update`

**Description:** Updates an existing unit with audit trail support.

**Authentication:** Required (Bearer Token)

**Permission Required:** `unit.update.*`

**Request Body:**
```json
{
  "id": "unit-id",
  "name": "Updated Branch Name",
  "type": "SERVICE_CENTER",
  "description": "Updated description",
  "address": "456 New Street, Karachi",
  "contactNo": "+92-300-9876543",
  "email": "updated@company.com",
  "attendanceManagerId": "new-employee-id",
  "updatedByUserId": "user-id"
}
```

**Request Body Fields:**
- `id` (string, required): Unit ID to update
- `name` (string, optional): Updated name
- `type` (UnitType, optional): Updated type
- `description` (string, optional): Updated description
- `address` (string, optional): Updated address
- `contactNo` (string, optional): Updated contact number
- `email` (string, optional): Updated email
- `attendanceManagerId` (string, optional): Updated attendance manager ID
- `updatedByUserId` (string, optional): User ID who updated the unit

**Response:**
```json
{
  "success": true,
  "message": "Unit updated successfully!",
  "data": {
    "id": "unit-id",
    "name": "Updated Branch Name",
    "type": "SERVICE_CENTER",
    "description": "Updated description",
    "address": "456 New Street, Karachi",
    "contactNo": "+92-300-9876543",
    "email": "updated@company.com",
    "attendanceManagerId": "new-employee-id",
    "attendanceManager": {
      "id": "new-employee-id",
      "name": "Jane",
      "surname": "Smith",
      "code": "EMP002"
    },
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T12:00:00.000Z",
    "isDeleted": null,
    "createdBy": "user-id",
    "updatedBy": "user-id",
    "previousUpdates": [
      {
        "data": {
          "name": "Karachi Branch",
          "type": "BRANCH",
          "description": "Main branch in Karachi",
          "address": "123 Main Street, Karachi",
          "contactNo": "+92-300-1234567",
          "email": "karachi@company.com",
          "attendanceManagerId": "employee-id"
        },
        "updatedBy": "user-id",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

**Business Logic:**
- Updates unit with provided data
- Captures current state in `previousUpdates` before update
- Maintains last 3 update records in `previousUpdates`
- Sets `updatedAt` timestamp
- Sets `updatedBy` from `updatedByUserId`
- Updates attendance manager link if `attendanceManagerId` changed
- Returns updated unit with attendance manager details

**Error Responses:**
- `400`: Unit ID is required or invalid request data
- `401`: Unauthorized
- `404`: Unit not found
- `500`: Server error

---

#### 8. Delete Unit (Soft Delete)

**Endpoint:** `POST /unit/delete`

**Description:** Soft deletes a unit (sets `isDeleted` timestamp).

**Authentication:** Required (Bearer Token)

**Permission Required:** `unit.delete.*`

**Request Body:**
```json
{
  "id": "unit-id"
}
```

**Request Body Fields:**
- `id` (string, required): Unit ID to delete

**Response:**
```json
{
  "success": true,
  "message": "Unit deleted successfully!",
  "data": {
    "id": "unit-id",
    "name": "Karachi Branch",
    "isDeleted": "2024-01-20T12:00:00.000Z",
    // ... other fields
  }
}
```

**Business Logic:**
- Sets `isDeleted` to current timestamp
- Unit is not permanently deleted (soft delete)
- Unit remains in database but is excluded from active queries
- Employee assignments to the unit remain intact

**Error Responses:**
- `400`: Unit ID is required
- `401`: Unauthorized
- `404`: Unit not found (already deleted or doesn't exist)
- `500`: Server error

---

#### 9. Restore Unit

**Endpoint:** `POST /unit/restore`

**Description:** Restores a soft-deleted unit (sets `isDeleted` to `null`).

**Authentication:** Required (Bearer Token)

**Permission Required:** `unit.restore.*`

**Request Body:**
```json
{
  "id": "unit-id"
}
```

**Request Body Fields:**
- `id` (string, required): Unit ID to restore

**Response:**
```json
{
  "success": true,
  "message": "Unit restored successfully!",
  "data": {
    "id": "unit-id",
    "name": "Karachi Branch",
    "isDeleted": null,
    // ... other fields
  }
}
```

**Business Logic:**
- Sets `isDeleted` to `null`
- Unit becomes active again
- Unit appears in active queries

**Error Responses:**
- `400`: Unit ID is required
- `401`: Unauthorized
- `404`: Unit not found
- `500`: Server error

---

#### 10. Search Units

**Endpoint:** `POST /unit/search`

**Description:** Searches units by name, description, or address.

**Authentication:** Required (Bearer Token)

**Permission Required:** `unit.read.*`

**Request Body:**
```json
{
  "searchTerm": "Karachi",
  "page": 1,
  "pageSize": 10
}
```

**Request Body Fields:**
- `searchTerm` (string, required): Search term (searches in name, description, address)
- `page` (integer, optional): Page number (default: 1)
- `pageSize` (integer, optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "message": "Units search completed successfully!",
  "data": {
    "data": [
      {
        "id": "unit-id",
        "name": "Karachi Branch",
        "type": "BRANCH",
        "description": "Main branch in Karachi",
        "address": "123 Main Street, Karachi",
        "attendanceManager": {
          "id": "employee-id",
          "name": "John",
          "surname": "Doe",
          "code": "EMP001"
        },
        // ... other fields
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

**Business Logic:**
- Searches in `name`, `description`, and `address` fields
- Case-insensitive search (ILIKE)
- Returns paginated results
- Only searches active units (`isDeleted` is `null`)
- Includes attendance manager details

**Error Responses:**
- `400`: Search term is required
- `401`: Unauthorized
- `500`: Server error

---

#### 11. Get Unit History

**Endpoint:** `POST /unit/getHistoryById`

**Description:** Retrieves update history (audit trail) for a unit.

**Authentication:** Required (Bearer Token)

**Permission Required:** `unit.viewPreviousUpdate.*`

**Request Body:**
```json
{
  "id": "unit-id",
  "filter": false,
  "date": "2024-01-15"
}
```

**Request Body Fields:**
- `id` (string, required): Unit ID
- `filter` (boolean, optional): If `true`, returns only dates. If `false`, returns full update records
- `date` (string, optional): If `filter` is `true` and `date` is provided, returns record for that specific date

**Response (filter: false):**
```json
{
  "success": true,
  "message": "Unit history retrieved successfully!",
  "data": [
    {
      "data": {
        "name": "Old Name",
        "type": "BRANCH",
        "description": "Old description",
        "address": "Old address",
        "contactNo": "+92-300-1111111",
        "email": "old@company.com",
        "attendanceManagerId": "old-employee-id"
      },
      "updatedBy": "user-id",
      "updatedByName": "john.doe",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

**Response (filter: true, with date):**
```json
{
  "success": true,
  "message": "Unit history retrieved successfully!",
  "data": {
    "data": {
      "name": "Old Name",
      "type": "BRANCH",
      // ... other fields
    },
    "updatedBy": "user-id",
    "updatedByName": "john.doe",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Response (filter: true, without date):**
```json
{
  "success": true,
  "message": "Unit history retrieved successfully!",
  "data": [
    "2024-01-15T10:00:00.000Z",
    "2024-01-20T12:00:00.000Z"
  ]
}
```

**Business Logic:**
- Returns `previousUpdates` array from unit record
- Resolves `updatedByName` from `updatedBy` user ID
- Maintains last 3 update records
- If `filter` is `true` and `date` provided, returns record matching that date
- If `filter` is `true` and no `date`, returns array of update dates

**Error Responses:**
- `400`: Unit ID is required
- `401`: Unauthorized
- `404`: Unit not found
- `500`: Server error

---

### UnitEmployee Endpoints

#### 12. Get Employees by Unit ID

**Endpoint:** `POST /unitEmployee/getEmployeesByUnitId`

**Description:** Retrieves all employees assigned to a specific unit.

**Authentication:** Required (Bearer Token)

**Permission Required:** `unitEmployee.read.*`

**Request Body:**
```json
{
  "unitId": "unit-id"
}
```

**Request Body Fields:**
- `unitId` (string, required): Unit ID

**Response:**
```json
{
  "success": true,
  "message": "Employees retrieved successfully!",
  "data": [
    {
      "id": "unitEmployee-id",
      "unitId": "unit-id",
      "employeeId": "employee-id",
      "employee": {
        "id": "employee-id",
        "name": "John",
        "surname": "Doe",
        "code": "EMP001",
        "designation": "Manager",
        "department": "IT",
        "status": "ACTIVE",
        "image": "image-url"
      },
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "isDeleted": null
    }
  ]
}
```

**Business Logic:**
- Returns all `UnitEmployee` records for the specified unit
- Only returns active assignments (`isDeleted` is `null`)
- Includes full employee details (id, name, surname, code, designation, department, status, image)
- Ordered by employee name ascending

**Error Responses:**
- `400`: Unit ID is required
- `401`: Unauthorized
- `500`: Server error

---

#### 13. Get Units by Employee ID

**Endpoint:** `POST /unitEmployee/getUnitsByEmployeeId`

**Description:** Retrieves all units assigned to a specific employee.

**Authentication:** Required (Bearer Token)

**Permission Required:** `unitEmployee.read.*`

**Request Body:**
```json
{
  "employeeId": "employee-id"
}
```

**Request Body Fields:**
- `employeeId` (string, required): Employee ID

**Response:**
```json
{
  "success": true,
  "message": "Units retrieved successfully!",
  "data": [
    {
      "id": "unitEmployee-id",
      "unitId": "unit-id",
      "employeeId": "employee-id",
      "unit": {
        "id": "unit-id",
        "name": "Karachi Branch",
        "type": "BRANCH",
        "description": "Main branch in Karachi",
        "address": "123 Main Street, Karachi"
      },
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "isDeleted": null
    }
  ]
}
```

**Business Logic:**
- Returns all `UnitEmployee` records for the specified employee
- Only returns active assignments (`isDeleted` is `null`)
- Includes unit details (id, name, type, description, address)
- Ordered by unit name ascending

**Error Responses:**
- `400`: Employee ID is required
- `401`: Unauthorized
- `500`: Server error

---

#### 14. Assign Employees to Unit (Bulk Assignment - Replace)

**Endpoint:** `POST /unitEmployee/assignEmployeesToUnit`

**Description:** Assigns employees to a unit, replacing all existing assignments for that unit.

**Authentication:** Required (Bearer Token)

**Permission Required:** `unitEmployee.assign.*`

**Request Body:**
```json
{
  "unitId": "unit-id",
  "employeeIds": ["employee-id-1", "employee-id-2", "employee-id-3"]
}
```

**Request Body Fields:**
- `unitId` (string, required): Unit ID
- `employeeIds` (array of strings, required): Array of employee IDs to assign

**Response:**
```json
{
  "success": true,
  "message": "Employees assigned to unit successfully!",
  "data": [
    {
      "id": "unitEmployee-id-1",
      "unitId": "unit-id",
      "employeeId": "employee-id-1",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    },
    {
      "id": "unitEmployee-id-2",
      "unitId": "unit-id",
      "employeeId": "employee-id-2",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    }
  ]
}
```

**Business Logic:**
1. **Soft deletes all existing assignments** for the unit (sets `isDeleted` to current timestamp)
2. **Creates new assignments** for provided employee IDs
3. Uses `upsert` to handle duplicates (if assignment already exists, restores it instead of creating duplicate)
4. Returns all created/updated assignments

**Use Case:** Use when you want to completely replace the unit's employee list (e.g., reassigning all employees to a unit)

**Error Responses:**
- `400`: Unit ID is required or employeeIds array is required/invalid
- `401`: Unauthorized
- `500`: Server error

---

#### 15. Add Employees to Unit (Bulk Addition)

**Endpoint:** `POST /unitEmployee/addEmployeesToUnit`

**Description:** Adds employees to a unit without removing existing assignments.

**Authentication:** Required (Bearer Token)

**Permission Required:** `unitEmployee.assign.*`

**Request Body:**
```json
{
  "unitId": "unit-id",
  "employeeIds": ["employee-id-4", "employee-id-5"]
}
```

**Request Body Fields:**
- `unitId` (string, required): Unit ID
- `employeeIds` (array of strings, required): Array of employee IDs to add

**Response:**
```json
{
  "success": true,
  "message": "Employees added to unit successfully!",
  "data": [
    {
      "id": "unitEmployee-id-4",
      "unitId": "unit-id",
      "employeeId": "employee-id-4",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    },
    {
      "id": "unitEmployee-id-5",
      "unitId": "unit-id",
      "employeeId": "employee-id-5",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    }
  ]
}
```

**Business Logic:**
1. **Does NOT remove existing assignments**
2. **Creates new assignments** for provided employee IDs
3. Uses `upsert` to handle duplicates:
   - If assignment exists and is deleted, restores it (sets `isDeleted` to `null`)
   - If assignment exists and is active, updates `updatedAt`
   - If assignment doesn't exist, creates new one
4. Returns all created/updated assignments

**Use Case:** Use when you want to add more employees to a unit without affecting existing assignments (e.g., adding new employees to an existing unit)

**Error Responses:**
- `400`: Unit ID is required or employeeIds array is required/invalid
- `401`: Unauthorized
- `500`: Server error

---

#### 16. Remove Employees from Unit (Bulk Removal)

**Endpoint:** `POST /unitEmployee/removeEmployeesFromUnit`

**Description:** Removes multiple employees from a unit (soft delete).

**Authentication:** Required (Bearer Token)

**Permission Required:** `unitEmployee.assign.*`

**Request Body:**
```json
{
  "unitId": "unit-id",
  "employeeIds": ["employee-id-1", "employee-id-2"]
}
```

**Request Body Fields:**
- `unitId` (string, required): Unit ID
- `employeeIds` (array of strings, required): Array of employee IDs to remove

**Response:**
```json
{
  "success": true,
  "message": "Employees removed from unit successfully!",
  "data": null
}
```

**Business Logic:**
1. Soft deletes assignments matching `unitId` and `employeeIds`
2. Sets `isDeleted` to current timestamp
3. Sets `updatedAt` to current timestamp
4. Only removes active assignments (`isDeleted` is `null`)

**Use Case:** Use when you want to remove multiple employees from a unit at once

**Error Responses:**
- `400`: Unit ID is required or employeeIds array is required/invalid
- `401`: Unauthorized
- `500`: Server error

---

#### 17. Remove Employee from Unit (Single Removal)

**Endpoint:** `POST /unitEmployee/removeEmployeeFromUnit`

**Description:** Removes a single employee from a unit (soft delete).

**Authentication:** Required (Bearer Token)

**Permission Required:** `unitEmployee.assign.*`

**Request Body:**
```json
{
  "unitId": "unit-id",
  "employeeId": "employee-id"
}
```

**Request Body Fields:**
- `unitId` (string, required): Unit ID
- `employeeId` (string, required): Employee ID to remove

**Response:**
```json
{
  "success": true,
  "message": "Employee removed from unit successfully!",
  "data": null
}
```

**Business Logic:**
1. Soft deletes assignment matching `unitId` and `employeeId`
2. Sets `isDeleted` to current timestamp
3. Sets `updatedAt` to current timestamp
4. Only removes active assignments (`isDeleted` is `null`)

**Use Case:** Use when you want to remove a single employee from a unit

**Error Responses:**
- `400`: Unit ID or Employee ID is required
- `401`: Unauthorized
- `500`: Server error

---

## Business Logic Implementation

### Unit Management

#### Create Unit
- Generates UUID for unit ID
- Sets `createdAt` timestamp
- Sets `createdBy` from `createdByUserId`
- Initializes `previousUpdates` as empty array
- Links to attendance manager if `attendanceManagerId` provided
- Validates unit type against enum values

#### Update Unit
- Captures current state before update
- Adds current state to `previousUpdates` array
- Maintains last 3 update records (removes older records)
- Sets `updatedAt` timestamp
- Sets `updatedBy` from `updatedByUserId`
- Updates attendance manager link if changed

#### Delete Unit
- Soft delete: Sets `isDeleted` timestamp
- Unit remains in database
- Employee assignments remain intact
- Unit excluded from active queries

#### Restore Unit
- Sets `isDeleted` to `null`
- Unit becomes active again
- Appears in active queries

### Employee-Unit Relationships

#### Bulk Assignment (assignEmployeesToUnit)
1. **Replace existing assignments:**
   - Soft deletes all existing assignments for the unit
   - Creates new assignments for provided employee IDs
   - Uses `upsert` to handle duplicates (restores if exists)

#### Bulk Addition (addEmployeesToUnit)
1. **Add without removing:**
   - Does NOT remove existing assignments
   - Creates new assignments or restores deleted ones
   - Uses `upsert` to handle duplicates

#### Bulk Removal (removeEmployeesFromUnit)
1. **Remove multiple employees:**
   - Soft deletes assignments matching unitId and employeeIds
   - Only removes active assignments

#### Single Removal (removeEmployeeFromUnit)
1. **Remove single employee:**
   - Soft deletes assignment matching unitId and employeeId
   - Only removes active assignments

### Composite Unique Constraint

The `UnitEmployee` model uses a composite unique constraint on `[unitId, employeeId]`:
- Prevents duplicate assignments (same employee to same unit)
- Allows employees to belong to multiple units
- Allows units to have multiple employees
- Prisma uses `unitId_employeeId` as the constraint name for `upsert` operations

---

## Permissions

### Unit Permissions

| Permission ID | Description | Parent |
|--------------|-------------|--------|
| `unit.*` | Unit (Nav) | - |
| `unit.create.*` | Create Units | `unit.*` |
| `unit.read.*` | Read Units | `unit.*` |
| `unit.update.*` | Update Units | `unit.*` |
| `unit.delete.*` | Delete Units | `unit.*` |
| `unit.restore.*` | Restore Units | `unit.*` |
| `unit.viewPreviousUpdate.*` | View Previous Update | `unit.*` |

### UnitEmployee Permissions

| Permission ID | Description | Parent |
|--------------|-------------|--------|
| `unitEmployee.*` | Unit Employee Management | `unit.*` |
| `unitEmployee.assign.*` | Assign Employees | `unitEmployee.*` |
| `unitEmployee.read.*` | View Unit Employees | `unitEmployee.*` |

### Supervisor Permissions

| Permission ID | Description | Parent |
|--------------|-------------|--------|
| `employee.read.all.*` | Access All Employees (Supervisor) | `employee.read.*` |
| `attendance.read.all.*` | Access All Attendances (Supervisor) | `attendance.read.*` |

**Supervisor Permissions:**
- Users with `employee.read.all.*` can access all employees regardless of unit membership
- Users with `attendance.read.all.*` can access all attendances regardless of unit membership
- Used for supervisors/managers who need organization-wide access

---

## Data Models

### Unit Type

```typescript
enum UnitType {
  SERVICE_CENTER = "SERVICE_CENTER",
  BRANCH = "BRANCH",
  OUTLET = "OUTLET",
  DEPARTMENT = "DEPARTMENT",
  STORE = "STORE",
  WAREHOUSE = "WAREHOUSE",
  OFFICE = "OFFICE",
  FACTORY = "FACTORY",
  OTHER = "OTHER"
}
```

### Unit Interface

```typescript
interface Unit {
  id?: string;
  name: string;
  type: UnitType;
  description?: string;
  address?: string;
  contactNo?: string;
  email?: string;
  attendanceManagerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: Date;
  createdBy?: string;
  updatedBy?: string;
  previousUpdates?: any;
}
```

### UnitEmployee Interface

```typescript
interface UnitEmployee {
  id?: string;
  unitId: string;
  employeeId: string;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: Date;
}
```

---

## Usage Examples

### Example 1: Create a Service Center

**Request:**
```bash
POST /unit/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Karachi Service Center",
  "type": "SERVICE_CENTER",
  "description": "Main service center in Karachi",
  "address": "123 Service Road, Karachi",
  "contactNo": "+92-300-1234567",
  "email": "karachi@company.com",
  "attendanceManagerId": "employee-id",
  "createdByUserId": "user-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Unit created successfully!",
  "data": {
    "id": "unit-123",
    "name": "Karachi Service Center",
    "type": "SERVICE_CENTER",
    "description": "Main service center in Karachi",
    "address": "123 Service Road, Karachi",
    "contactNo": "+92-300-1234567",
    "email": "karachi@company.com",
    "attendanceManagerId": "employee-id",
    "attendanceManager": {
      "id": "employee-id",
      "name": "John",
      "surname": "Doe",
      "code": "EMP001"
    },
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "isDeleted": null,
    "createdBy": "user-id",
    "updatedBy": null,
    "previousUpdates": []
  }
}
```

---

### Example 2: Assign Employees to Unit (Replace All)

**Request:**
```bash
POST /unitEmployee/assignEmployeesToUnit
Authorization: Bearer <token>
Content-Type: application/json

{
  "unitId": "unit-123",
  "employeeIds": ["emp-1", "emp-2", "emp-3", "emp-4"]
}
```

**What happens:**
1. All existing assignments for `unit-123` are soft deleted
2. New assignments are created for employees: `emp-1`, `emp-2`, `emp-3`, `emp-4`
3. If any assignment already exists (even if deleted), it's restored instead of creating duplicate

**Response:**
```json
{
  "success": true,
  "message": "Employees assigned to unit successfully!",
  "data": [
    {
      "id": "ue-1",
      "unitId": "unit-123",
      "employeeId": "emp-1",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    },
    {
      "id": "ue-2",
      "unitId": "unit-123",
      "employeeId": "emp-2",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    },
    {
      "id": "ue-3",
      "unitId": "unit-123",
      "employeeId": "emp-3",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    },
    {
      "id": "ue-4",
      "unitId": "unit-123",
      "employeeId": "emp-4",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    }
  ]
}
```

---

### Example 3: Add Employees to Unit (Keep Existing)

**Request:**
```bash
POST /unitEmployee/addEmployeesToUnit
Authorization: Bearer <token>
Content-Type: application/json

{
  "unitId": "unit-123",
  "employeeIds": ["emp-5", "emp-6"]
}
```

**What happens:**
1. Existing assignments for `unit-123` remain intact
2. New assignments are created for employees: `emp-5`, `emp-6`
3. If any assignment already exists (even if deleted), it's restored
4. Unit now has employees: `emp-1`, `emp-2`, `emp-3`, `emp-4`, `emp-5`, `emp-6`

**Response:**
```json
{
  "success": true,
  "message": "Employees added to unit successfully!",
  "data": [
    {
      "id": "ue-5",
      "unitId": "unit-123",
      "employeeId": "emp-5",
      "createdAt": "2024-01-20T13:00:00.000Z",
      "updatedAt": "2024-01-20T13:00:00.000Z",
      "isDeleted": null
    },
    {
      "id": "ue-6",
      "unitId": "unit-123",
      "employeeId": "emp-6",
      "createdAt": "2024-01-20T13:00:00.000Z",
      "updatedAt": "2024-01-20T13:00:00.000Z",
      "isDeleted": null
    }
  ]
}
```

---

### Example 4: Get Employees by Unit

**Request:**
```bash
POST /unitEmployee/getEmployeesByUnitId
Authorization: Bearer <token>
Content-Type: application/json

{
  "unitId": "unit-123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Employees retrieved successfully!",
  "data": [
    {
      "id": "ue-1",
      "unitId": "unit-123",
      "employeeId": "emp-1",
      "employee": {
        "id": "emp-1",
        "name": "John",
        "surname": "Doe",
        "code": "EMP001",
        "designation": "Manager",
        "department": "IT",
        "status": "ACTIVE",
        "image": "https://example.com/image.jpg"
      },
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    },
    {
      "id": "ue-2",
      "unitId": "unit-123",
      "employeeId": "emp-2",
      "employee": {
        "id": "emp-2",
        "name": "Jane",
        "surname": "Smith",
        "code": "EMP002",
        "designation": "Developer",
        "department": "IT",
        "status": "ACTIVE",
        "image": "https://example.com/image2.jpg"
      },
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    }
  ]
}
```

---

### Example 5: Get Units by Employee

**Request:**
```bash
POST /unitEmployee/getUnitsByEmployeeId
Authorization: Bearer <token>
Content-Type: application/json

{
  "employeeId": "emp-1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Units retrieved successfully!",
  "data": [
    {
      "id": "ue-1",
      "unitId": "unit-123",
      "employeeId": "emp-1",
      "unit": {
        "id": "unit-123",
        "name": "Karachi Service Center",
        "type": "SERVICE_CENTER",
        "description": "Main service center in Karachi",
        "address": "123 Service Road, Karachi"
      },
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z",
      "isDeleted": null
    },
    {
      "id": "ue-7",
      "unitId": "unit-456",
      "employeeId": "emp-1",
      "unit": {
        "id": "unit-456",
        "name": "Lahore Branch",
        "type": "BRANCH",
        "description": "Branch in Lahore",
        "address": "456 Branch Road, Lahore"
      },
      "createdAt": "2024-01-21T10:00:00.000Z",
      "updatedAt": "2024-01-21T10:00:00.000Z",
      "isDeleted": null
    }
  ]
}
```

**Note:** This employee belongs to multiple units (Karachi Service Center and Lahore Branch), demonstrating the many-to-many relationship.

---

## Implementation Details

### Model Layer

#### Unit Model (`src/modules/AMS/Unit/models/unit.model.ts`)
- **gpFindMany**: Returns all active units with attendance manager
- **gpFindById**: Returns unit by ID with attendance manager and updatedByName
- **gpPgFindMany**: Paginated units with attendance manager
- **gpPgFindDeletedMany**: Paginated deleted units
- **gpSearch**: Search units by name, description, address
- **gpCreate**: Creates unit with audit trail
- **gpUpdate**: Updates unit with audit trail (maintains last 3 updates)
- **gpSoftDelete**: Soft deletes unit
- **gpRestore**: Restores soft-deleted unit
- **getHistoryById**: Returns update history with resolved usernames

#### UnitEmployee Model (`src/modules/AMS/Unit/models/unitEmployee.model.ts`)
- **getEmployeesByUnitId**: Returns employees for a unit with employee details
- **getUnitsByEmployeeId**: Returns units for an employee with unit details
- **getUnitEmployeeByUnitAndEmployee**: Returns specific assignment

### Service Layer

#### Unit Service (`src/modules/AMS/Unit/services/unit.service.ts`)
- Wraps model methods with business logic
- Handles array creation (bulk create support)
- Provides error handling

#### UnitEmployee Service (`src/modules/AMS/Unit/services/unitEmployee.service.ts`)
- **assignEmployeesToUnit**: Replaces all assignments (soft delete existing, create new)
- **addEmployeesToUnit**: Adds assignments without removing existing (uses upsert)
- **removeEmployeesFromUnit**: Bulk removal (soft delete)
- **removeEmployeeFromUnit**: Single removal (soft delete)
- **getEmployeesByUnitId**: Wrapper for model method
- **getUnitsByEmployeeId**: Wrapper for model method

### Controller Layer

#### Unit Controller (`src/modules/AMS/Unit/controllers/unit.controller.ts`)
- Validates request parameters
- Calls service methods
- Handles responses using BaseController pattern
- Returns standardized success/error responses

#### UnitEmployee Controller (`src/modules/AMS/Unit/controllers/unitEmployee.controller.ts`)
- Validates request parameters (unitId, employeeIds array)
- Calls service methods
- Handles responses using BaseController pattern
- Returns standardized success/error responses

### Route Layer

#### Unit Routes (`src/modules/AMS/Unit/routes/unit.routes.ts`)
- Defines all unit endpoints
- Includes Swagger documentation
- Maps routes to controller methods

#### UnitEmployee Routes (`src/modules/AMS/Unit/routes/unitEmployee.routes.ts`)
- Defines all unitEmployee endpoints
- Includes Swagger documentation
- Maps routes to controller methods

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Unit ID is required"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Unit with ID {id} not found."
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Migration

### Migration File
**Location:** `prisma/migrations/20260116000000_add_unit_system/migration.sql`

### Migration Steps

1. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Apply Migration:**
   ```bash
   npx prisma migrate deploy
   ```

### Migration SQL

The migration creates:
- `UnitType` enum
- `Unit` table
- `UnitEmployee` table
- Composite unique index on `[unitId, employeeId]`
- Foreign key constraints

### Safety Features
- All new columns are nullable where appropriate
- No existing data is modified
- Migration is non-destructive

---

## Best Practices

### 1. Unit Creation
- Always provide a meaningful name
- Select appropriate unit type
- Optionally assign an attendance manager
- Include contact information for communication

### 2. Employee Assignment
- Use `assignEmployeesToUnit` when replacing all employees
- Use `addEmployeesToUnit` when adding employees without removing existing
- Use `removeEmployeesFromUnit` for bulk removal
- Use `removeEmployeeFromUnit` for single removal

### 3. Access Control
- Use `employee.read.all.*` permission for supervisors who need organization-wide access
- Use `attendance.read.all.*` permission for supervisors who need organization-wide attendance access
- Regular users should only see employees/attendances from their assigned units

### 4. Unit Management
- Use soft delete (don't permanently delete units with history)
- Review update history before making changes
- Keep unit information up to date

---

## Future Enhancements

### Potential Features
1. **Unit Hierarchy**: Parent-child relationships between units
2. **Unit Statistics**: Employee count, attendance statistics per unit
3. **Bulk Operations**: Bulk create/update/delete units
4. **Unit Templates**: Predefined unit configurations
5. **Unit Reporting**: Reports specific to units

---

**Version:** 1.0  
**Last Updated:** 2026-01-16
