# Frontend Documentation - Permissions Webhook API

## Overview

This document describes how to retrieve updated user permissions using the webhook endpoint. The webhook allows your frontend application to fetch the latest permissions for a user's session without requiring them to log out and log back in.

---

## Base URL

All endpoints are relative to your API base URL.

```
Base URL: https://your-api-domain.com
```

---

## Endpoint

### Get Updated Permissions by Token

**Endpoint:** `/webhook/permissions`

**Methods:** `GET` or `POST`

**Authentication:** Not required (token is passed as parameter/body)

---

## GET Request

### Request

```http
GET /webhook/permissions?token=<jwt_token>
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | JWT authentication token from user's session |

### Example Request

```javascript
// Using Fetch API
const token = localStorage.getItem('authToken'); // or however you store the token

const response = await fetch(
  `${API_BASE_URL}/webhook/permissions?token=${token}`,
  {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
```

### cURL Example

```bash
curl -X GET "https://your-api-domain.com/webhook/permissions?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

## POST Request

### Request

```http
POST /webhook/permissions
Content-Type: application/json

{
  "token": "<jwt_token>"
}
```

### Request Body

```typescript
{
  token: string; // JWT authentication token
}
```

### Example Request

```javascript
// Using Fetch API
const token = localStorage.getItem('authToken');

const response = await fetch(`${API_BASE_URL}/webhook/permissions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    token: token
  })
});

const data = await response.json();
```

### cURL Example

```bash
curl -X POST "https://your-api-domain.com/webhook/permissions" \
  -H "Content-Type: application/json" \
  -d '{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'
```

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Permissions retrieved successfully!",
  "data": [
    "user.create.*",
    "user.read.*",
    "user.update.*",
    "user.delete.*",
    "group.create.*",
    "group.read.*",
    "role.read.*",
    "gatePass.approve.*",
    "gatePass.reject.*"
  ]
}
```

### Response Structure

```typescript
interface PermissionsResponse {
  success: boolean;
  message: string;
  data: string[]; // Array of permission strings
}
```

### Permission Format

Permissions follow a pattern: `<resource>.<action>.<scope>`

- **Resource**: The entity (e.g., `user`, `group`, `role`, `gatePass`)
- **Action**: The operation (e.g., `create`, `read`, `update`, `delete`, `approve`)
- **Scope**: Usually `*` for all, or specific IDs

**Examples:**
- `user.create.*` - Can create any user
- `user.read.*` - Can read any user
- `gatePass.approve.*` - Can approve any gate pass
- `group.update.*` - Can update any group

---

## Error Responses

### 400 Bad Request - Token Missing

```json
{
  "success": false,
  "message": "Token is required",
  "statusCode": 400
}
```

**When it occurs:** Token parameter is missing from request.

**How to handle:** Ensure the token is included in the request.

---

### 401 Unauthorized - Invalid or Expired Token

```json
{
  "success": false,
  "message": "Invalid or expired token",
  "statusCode": 401
}
```

**When it occurs:** 
- Token is invalid
- Token has expired
- Token format is incorrect

**How to handle:** 
- Redirect user to login page
- Clear stored token
- Request new token via login

---

### 401 Unauthorized - Token Revoked

```json
{
  "success": false,
  "message": "Token has been revoked",
  "statusCode": 401
}
```

**When it occurs:** Token has been blacklisted (user logged out).

**How to handle:** 
- Clear stored token
- Redirect to login page

---

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Error retrieving permissions",
  "error": "Error details...",
  "statusCode": 500
}
```

**When it occurs:** Server-side error.

**How to handle:** 
- Log the error
- Show user-friendly error message
- Retry after a delay if appropriate

---

## Frontend Implementation Examples

### React Hook Example

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UsePermissionsReturn {
  permissions: string[];
  loading: boolean;
  error: string | null;
  refreshPermissions: () => Promise<void>;
}

function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      setError('No authentication token found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/webhook/permissions?token=${token}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // Token invalid or expired
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setPermissions(data.data);
      } else {
        setError(data.message || 'Failed to fetch permissions');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching permissions');
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return {
    permissions,
    loading,
    error,
    refreshPermissions: fetchPermissions
  };
}

export default usePermissions;
```

### Usage in Component

```typescript
import React from 'react';
import usePermissions from './hooks/usePermissions';

function MyComponent() {
  const { permissions, loading, error, refreshPermissions } = usePermissions();

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={refreshPermissions}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={refreshPermissions}>Refresh Permissions</button>
      
      {hasPermission('user.create.*') && (
        <button>Create User</button>
      )}
      
      {hasPermission('gatePass.approve.*') && (
        <button>Approve Gate Pass</button>
      )}
    </div>
  );
}
```

---

### React Context Example

```typescript
// PermissionsContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface PermissionsContextType {
  permissions: string[];
  loading: boolean;
  error: string | null;
  hasPermission: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      setError('No authentication token found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/webhook/permissions?token=${token}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setPermissions(data.data);
      } else {
        setError(data.message || 'Failed to fetch permissions');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
    
    // Refresh permissions every 5 minutes
    const interval = setInterval(fetchPermissions, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchPermissions]);

  const hasPermission = useCallback((permission: string): boolean => {
    return permissions.includes(permission);
  }, [permissions]);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading,
        error,
        hasPermission,
        refreshPermissions: fetchPermissions
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = (): PermissionsContextType => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
```

### App Setup

```typescript
// App.tsx
import { PermissionsProvider } from './contexts/PermissionsContext';

function App() {
  return (
    <PermissionsProvider>
      {/* Your app components */}
    </PermissionsProvider>
  );
}
```

### Usage in Components

```typescript
import { usePermissions } from './contexts/PermissionsContext';

function UserManagement() {
  const { hasPermission, loading } = usePermissions();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {hasPermission('user.create.*') && (
        <button>Create User</button>
      )}
      {hasPermission('user.update.*') && (
        <button>Edit User</button>
      )}
      {hasPermission('user.delete.*') && (
        <button>Delete User</button>
      )}
    </div>
  );
}
```

---

### Axios Example

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

async function getPermissions(token: string): Promise<string[]> {
  try {
    const response = await api.get('/webhook/permissions', {
      params: { token }
    });

    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Failed to fetch permissions');
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      // Token invalid - redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    throw error;
  }
}

// Usage
const token = localStorage.getItem('authToken');
if (token) {
  const permissions = await getPermissions(token);
  console.log('User permissions:', permissions);
}
```

---

### Vue.js Example

```vue
<template>
  <div>
    <button v-if="hasPermission('user.create.*')" @click="createUser">
      Create User
    </button>
    <button @click="refreshPermissions">Refresh Permissions</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const permissions = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const fetchPermissions = async () => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    error.value = 'No authentication token found';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/webhook/permissions?token=${token}`
    );

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = '/login';
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      permissions.value = data.data;
    } else {
      error.value = data.message || 'Failed to fetch permissions';
    }
  } catch (err: any) {
    error.value = err.message || 'Error fetching permissions';
  } finally {
    loading.value = false;
  }
};

const hasPermission = (permission: string): boolean => {
  return permissions.value.includes(permission);
};

const refreshPermissions = () => {
  fetchPermissions();
};

onMounted(() => {
  fetchPermissions();
  
  // Refresh every 5 minutes
  setInterval(fetchPermissions, 5 * 60 * 1000);
});
</script>
```

---

## When to Call the Webhook

### Recommended Scenarios

1. **On Application Load/Login**
   - Fetch permissions immediately after user logs in
   - Store in application state/context

2. **After Permission Changes**
   - When an admin updates user roles/groups/permissions
   - Call the webhook to refresh the affected user's permissions

3. **Periodic Refresh**
   - Poll the endpoint every 5-10 minutes to ensure permissions are up-to-date
   - Use `setInterval` or similar mechanism

4. **Before Critical Actions**
   - Before allowing user to perform sensitive operations
   - Verify permissions are still valid

5. **On Route Navigation**
   - Check permissions when navigating to protected routes
   - Refresh if needed

### Example: Refresh After Admin Updates Permissions

```typescript
// After admin updates user permissions
async function handlePermissionUpdate(userId: string) {
  // Update permissions in backend
  await updateUserPermissions(userId, newPermissions);
  
  // Notify affected user to refresh (if they're logged in)
  // You could use WebSocket, polling, or a notification system
  notifyUserToRefreshPermissions(userId);
}

// In the affected user's frontend
function listenForPermissionUpdates() {
  // Poll every 30 seconds when on permission-sensitive pages
  setInterval(async () => {
    await refreshPermissions();
  }, 30000);
}
```

---

## Best Practices

### 1. Cache Permissions

Store permissions in application state/context to avoid unnecessary API calls:

```typescript
// Store in React Context, Redux, Vuex, or similar
const [permissions, setPermissions] = useState<string[]>([]);
```

### 2. Handle Token Expiration

Always check for 401 responses and handle token expiration gracefully:

```typescript
if (response.status === 401) {
  // Clear token and redirect to login
  localStorage.removeItem('authToken');
  window.location.href = '/login';
}
```

### 3. Implement Permission Checking Helper

Create a reusable function to check permissions:

```typescript
function hasPermission(permission: string, permissions: string[]): boolean {
  return permissions.includes(permission);
}

// Or with wildcard support
function hasPermission(permission: string, permissions: string[]): boolean {
  // Exact match
  if (permissions.includes(permission)) {
    return true;
  }
  
  // Wildcard check (e.g., "user.*" matches "user.create.*")
  const [resource, action] = permission.split('.');
  return permissions.some(p => {
    const [pResource, pAction] = p.split('.');
    return pResource === resource && (pAction === '*' || pAction === action);
  });
}
```

### 4. Show Loading States

Always show loading indicators while fetching permissions:

```typescript
if (loading) {
  return <Spinner />;
}
```

### 5. Error Handling

Implement proper error handling and user feedback:

```typescript
if (error) {
  return (
    <ErrorMessage 
      message={error} 
      onRetry={refreshPermissions} 
    />
  );
}
```

### 6. Optimize API Calls

Avoid calling the webhook too frequently:

```typescript
// Good: Refresh every 5 minutes
setInterval(refreshPermissions, 5 * 60 * 1000);

// Bad: Refresh every second
setInterval(refreshPermissions, 1000);
```

---

## Permission Checking Examples

### Simple Permission Check

```typescript
const canCreateUser = permissions.includes('user.create.*');
const canApproveGatePass = permissions.includes('gatePass.approve.*');
```

### Conditional Rendering

```typescript
{hasPermission('user.create.*') && (
  <button onClick={handleCreateUser}>Create User</button>
)}
```

### Route Protection

```typescript
// React Router example
function ProtectedRoute({ permission, children }) {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
}

// Usage
<Route 
  path="/users" 
  element={
    <ProtectedRoute permission="user.read.*">
      <UserManagement />
    </ProtectedRoute>
  } 
/>
```

### Action Authorization

```typescript
function handleDeleteUser(userId: string) {
  if (!hasPermission('user.delete.*')) {
    alert('You do not have permission to delete users');
    return;
  }
  
  // Proceed with deletion
  deleteUser(userId);
}
```

---

## Integration with Login Flow

### After Login

```typescript
async function handleLogin(username: string, password: string) {
  // 1. Login and get token
  const loginResponse = await fetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, platform: 'Admin' })
  });
  
  const { token, permissions } = await loginResponse.json();
  
  // 2. Store token
  localStorage.setItem('authToken', token);
  
  // 3. Store initial permissions (from login response)
  setPermissions(permissions);
  
  // 4. Optionally refresh to ensure latest
  await refreshPermissions();
}
```

---

## Troubleshooting

### Issue: Permissions not updating

**Solution:** 
- Ensure you're calling the webhook after permission changes
- Check that the token is valid and not expired
- Verify the token matches the user whose permissions were updated

### Issue: 401 Unauthorized errors

**Solution:**
- Check if token is stored correctly
- Verify token hasn't expired
- Ensure token format is correct (JWT)
- Check if user has been logged out (token blacklisted)

### Issue: Empty permissions array

**Solution:**
- This is normal if user has no permissions assigned
- Check backend to ensure user has roles/groups/permissions assigned
- Verify user is not the excluded admin user

---

## API Response Examples

### Full Response Example

```json
{
  "success": true,
  "message": "Permissions retrieved successfully!",
  "data": [
    "user.create.*",
    "user.read.*",
    "user.update.*",
    "user.delete.*",
    "group.create.*",
    "group.read.*",
    "group.update.*",
    "role.read.*",
    "gatePass.create.*",
    "gatePass.read.*",
    "gatePass.approve.*",
    "gatePass.reject.*",
    "employee.read.*",
    "attendance.read.*"
  ]
}
```

### Empty Permissions (User with no permissions)

```json
{
  "success": true,
  "message": "Permissions retrieved successfully!",
  "data": []
}
```

---

## Summary

- **Endpoint:** `/webhook/permissions` (GET or POST)
- **Purpose:** Fetch updated permissions for a user session
- **When to use:** On login, periodically, after permission changes, before critical actions
- **Response:** Array of permission strings
- **Error handling:** Always handle 401 (unauthorized) and redirect to login
- **Best practice:** Cache permissions, refresh periodically, check before actions

---

## Support

For questions or issues, contact the backend team or refer to the main API documentation.
