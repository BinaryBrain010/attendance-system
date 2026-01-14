# Entity Types List

This document lists all entity types that are tracked in the Activity Log system across the application.

## AMS Module (Attendance Management System)

### Employee Management
- **Employee** - Employee records (create, update, delete, restore)
- **EmployeeFile** - Employee file attachments (upload, delete)

### Attendance Management
- **Attendance** - Attendance records (create, update, delete, mark attendance, bulk operations)
- **AttendanceRequest** - Attendance change requests (create, update, delete, restore, approve/reject)

### Leave Management
- **LeaveConfiguration** - Leave type configurations (create, update, delete, restore)
- **LeaveAllocation** - Employee leave allocations (create, update, delete, restore, bulk assign)
- **LeaveRequest** - Leave requests (create, update, delete, restore, approve/reject)

### Holiday Management
- **Holiday** - Holiday records (create, update, delete, restore, bulk mark Sundays)

### Unit Management
- **Unit** - Unit/Service Center records (create, update, delete, restore)
- **UnitEmployee** - Unit-Employee relationships (assign, add, remove employees)

## App Module (Application Features)

### Customer Management
- **Customer** - Customer records (create, update, delete, restore)

### Gate Pass Management
- **GatePass** - Gate pass records (create, update, delete, restore, approve)
- **GatePassItem** - Gate pass items (create, update, delete, restore)

### Item Management
- **Item** - Item/Product records (create, update, delete, restore)

## RBAC Module (Role-Based Access Control)

### User Management
- **User** - User accounts (create, update, delete, restore, password changes, login, logout)
- **UserRole** - User-Role assignments (create, update, delete, restore)

### Role Management
- **Role** - Role definitions (create, update, delete, restore)
- **UserRole** - User role changes (when user's role is changed)

### Group Management
- **Group** - Group definitions (create, update, delete, restore)
- **GroupRole** - Group-Role assignments (create, update, delete, restore)
- **UserGroup** - User-Group assignments (create, update, delete, restore)

### Feature & Permission Management
- **Feature** - Application features (create, update, delete, restore)
- **FeaturePermission** - Feature permissions (create, update, delete, restore)

## Summary

**Total Entity Types: 19**

### By Module:
- **AMS Module**: 8 entity types
- **App Module**: 4 entity types
- **RBAC Module**: 7 entity types

### Common Actions Tracked:
- **CREATE** - Entity creation
- **UPDATE** - Entity modification
- **DELETE** - Entity deletion (soft delete)
- **RESTORE** - Entity restoration
- **APPROVE** - Approval actions (for requests)
- **REJECT** - Rejection actions (for requests)
- **LOGIN** - User login
- **LOGOUT** - User logout
- **BULK_CREATE** - Bulk creation operations
- **BULK_UPDATE** - Bulk update operations
- **BULK_DELETE** - Bulk delete operations
- **REQUEST** - Request creation (for approval workflows)

## Usage in Activity Log Queries

When querying activity logs, you can filter by any of these entity types:

```typescript
// Example: Get all activity logs for Employee entity
{
  entityType: "Employee",
  page: 1,
  pageSize: 10
}

// Example: Get activity logs for a specific attendance record
{
  entityType: "Attendance",
  entityId: "attendance-id-here"
}
```

## Notes

- All entity types are case-sensitive
- Entity IDs are UUIDs (string format)
- Some entities support bulk operations (indicated in descriptions)
- Login/Logout actions are tracked for the "User" entity type
- Approval/Rejection actions are tracked for request-based entities (AttendanceRequest, LeaveRequest)
