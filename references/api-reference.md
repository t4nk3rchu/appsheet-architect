# AppSheet REST API Reference

Comprehensive specification for invoking AppSheet REST API endpoints, authenticating requests, performing CRUD operations, and configuring webhooks.

---

## 1. Overview & Base Endpoint

The AppSheet API allows external systems (backend services, Cloud Functions, Zapier, Make, Postman) to query, insert, update, and delete records in AppSheet apps.

### Base Endpoint URL
```http
POST https://api.appsheet.com/api/v2/apps/{appId}/tables/{tableName}/Action
```

- **`{appId}`**: Unique application ID (found in AppSheet Editor under *Manage > Integrations > IN API*).
- **`{tableName}`**: The target table name as defined in the AppSheet data model.

---

## 2. Authentication & Headers

All requests must be sent via `POST` with the following HTTP headers:

```http
Content-Type: application/json
ApplicationAccessKey: V2-AbCdEf1234567890XYZ...
```

> **Security Note:** Application access keys should be generated under *Manage > Integrations > IN API* and kept confidential in secret managers or environment variables.

---

## 3. Supported Actions

| Action | Description | Required Parameters |
| :--- | :--- | :--- |
| **`Add`** | Inserts one or more new records | `Rows` (array of row objects) |
| **`Edit`** | Updates existing records matching the key column | `Rows` (array of row objects containing Key) |
| **`Delete`** | Deletes records matching the specified keys | `Rows` (array of objects containing Key) |
| **`Find`** | Queries and retrieves records | `Selector` or `Rows` (with Key values) |
| **`AddOrUpdate`** | Inserts if key doesn't exist; updates if key exists | `Rows` (array of row objects) |

---

## 4. Request Payload Schema

```json
{
  "Action": "Add",
  "Properties": {
    "Locale": "en-US",
    "Location": "47.623098, -122.330184",
    "Timezone": "Pacific Standard Time",
    "UserEmail": "service-account@example.com",
    "RunAsUserEmail": "auditor@example.com",
    "UserSettings": {
      "Department": "Operations"
    },
    "ReturnValues": true
  },
  "Rows": [
    {
      "OrderID": "ORD-1001",
      "Customer": "Acme Corp",
      "OrderDate": "2026-08-28",
      "Status": "Pending",
      "Total": 1450.00
    }
  ]
}
```

### Properties Object Fields
- **`Locale`** *(string)*: Client locale for formatting (e.g. `"en-US"`).
- **`Timezone`** *(string)*: Timezone string for date/time resolution.
- **`UserEmail`** *(string)*: Recorded author email in change audit logs.
- **`RunAsUserEmail`** *(string)*: Evaluates security filters and user role rules as this user.
- **`UserSettings`** *(object)*: Key-value map mimicking active user settings.
- **`ReturnValues`** *(boolean | array)*: If `true`, returns full row records after insertion/update. Can specify column list: `["OrderID", "Total"]`.

---

## 5. Action Examples

### 5.1 `Add` (Insert Rows)
```json
{
  "Action": "Add",
  "Properties": {
    "Locale": "en-US",
    "Timezone": "UTC"
  },
  "Rows": [
    {
      "ProductID": "PROD-99",
      "Name": "Wireless Sensor",
      "UnitPrice": 49.99,
      "InventoryCount": 200
    }
  ]
}
```

### 5.2 `Edit` (Update Existing Rows)
```json
{
  "Action": "Edit",
  "Properties": {
    "Locale": "en-US"
  },
  "Rows": [
    {
      "ProductID": "PROD-99",
      "UnitPrice": 44.99,
      "InventoryCount": 185
    }
  ]
}
```

### 5.3 `Delete` (Delete Rows)
```json
{
  "Action": "Delete",
  "Rows": [
    {
      "ProductID": "PROD-99"
    }
  ]
}
```

### 5.4 `Find` (Query Rows with Selector)
```json
{
  "Action": "Find",
  "Properties": {
    "Selector": "Filter(Products, [UnitPrice] > 30.00)"
  },
  "Rows": []
}
```

---

## 6. Response Schema & Status Codes

### Success Response (`200 OK`)
```json
[
  {
    "ProductID": "PROD-99",
    "Name": "Wireless Sensor",
    "UnitPrice": 44.99,
    "InventoryCount": 185,
    "_RowNumber": 12
  }
]
```

### Common HTTP Status Codes

- **`200 OK`**: Operation succeeded. Response body contains row arrays.
- **`400 Bad Request`**: Malformed JSON payload or invalid formula syntax in `Selector`.
- **`401 Unauthorized`**: Missing or invalid `ApplicationAccessKey` header.
- **`403 Forbidden`**: User or API key lacks permissions for the specified action or app.
- **`404 Not Found`**: Invalid `{appId}` or `{tableName}`.
- **`500 Internal Server Error`**: Backend failure or data source timeout.

---

## 7. Webhook Integrations

### Outbound Webhooks (from AppSheet Bots)
AppSheet bots can trigger HTTP requests to external endpoints on row events:
- **URL**: `https://api.yourdomain.com/v1/webhook`
- **HTTP Method**: `POST`, `PUT`, `PATCH`, or `DELETE`
- **HTTP Headers**: Custom authorization headers (e.g. `Authorization: Bearer <token>`)
- **Body Template**:
  ```json
  {
    "event": "ORDER_CREATED",
    "order_id": "<<[OrderID]>>",
    "customer": "<<[CustomerID].[Name]>>",
    "total": <<[Total]>>,
    "timestamp": "<<NOW()>>"
  }
  ```
