# HRMS Database Schema

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ LeaveRequest : submits
    User ||--o{ Payroll : receives
    User ||--o{ PayrollItem : "financial entry for"
    User ||--o{ Attendance : "has"

    LeaveRequest ||--o| PayrollItem : "resolves to"
    Task ||--o| PayrollItem : "resolves to"

    Payroll ||--o{ PayrollItem : "contains"
    Payroll ||--o{ Attendance : "references"

    LeaveRequest {
        ObjectId _id PK
        ObjectId employee FK "ref: User"
        string type "annual|sick|maternity|unpaid|hourly|mission|overtime|attendance_correction"
        date startDate
        date endDate
        string startTime "HH:mm (hourly)"
        string endTime "HH:mm (hourly)"
        number days
        number hours
        string reason
        string status "draft|pending_manager|pending_general_manager|approved|rejected|cancelled|synced_to_payroll"
        ObjectId approvedBy FK "ref: User"
        date approvedAt
        string department
        string idempotencyKey UK "unique"
        string missionType "internal|external"
        string visitParty
        object geoLocation "{lat, lng, address}"
        number transportAllowance
        number overtimeHours
        number estimatedAmount
        ObjectId payrollItemId FK "ref: PayrollItem"
        object compensationResult
    }

    PayrollItem {
        ObjectId _id PK
        ObjectId employee FK "ref: User"
        string type "leave|mission|overtime|attendance_correction|other"
        string direction "addition|deduction"
        number amount
        string currency "SAR"
        string payrollCode "LEAVE_FULLY_PAID|LEAVE_UNPAID_DEDUCTION|..."
        string sourceType "informational type"
        string sourceModel "LeaveRequest|Task (used for refPath)"
        ObjectId sourceId FK "polymorphic ref via sourceModel"
        ObjectId payrollPeriod FK "ref: Payroll"
        date effectiveDate
        string idempotencyKey UK "prevents duplicate processing"
        string status "pending|active|processed|cancelled"
        string description "Arabic human-readable"
        object metadata "compensation breakdown"
        ObjectId createdBy FK "ref: User"
    }

    Payroll {
        ObjectId _id PK
        ObjectId employee FK "ref: User"
        date periodStart
        date periodEnd
        date paymentDate
        string frequency "monthly|biweekly|weekly"
        number baseSalary
        number workingDays
        number daysWorked
        object components "{allowances[], bonuses[], overtime{}}"
        object deductions "{absences{}, latePenalties{}, other[]}"
        object totals "{gross, deductions, net}"
        string status "pending|approved|paid|cancelled"
        ObjectId approvedBy FK
        boolean isPendingSalaryAssignment
    }

    Attendance {
        ObjectId _id PK
        ObjectId employee FK "ref: User"
        date date
        string status "present|absent|late|half_day|on_leave|work_from_home"
        string checkIn
        string checkOut
        number expectedHours
        number duration
        ObjectId leave FK "ref: LeaveRequest"
    }

    AuditLog {
        ObjectId _id PK
        ObjectId user FK "ref: User"
        string userRole
        string action "CREATE|UPDATE|DELETE|APPROVE|REJECT|PAY"
        string entity
        ObjectId entityId
        map details
        map previousValues
        map newValues
        string riskLevel "low|medium|high|critical"
    }
```

## Indexes

| Table | Index | Fields | Unique |
|-------|-------|--------|--------|
| LeaveRequest | employee_date | employee, startDate | No |
| LeaveRequest | department_status | department, status | No |
| LeaveRequest | idempotencyKey | idempotencyKey | Yes |
| PayrollItem | employee_period | employee, payrollPeriod | No |
| PayrollItem | idempotencyKey | idempotencyKey | Yes |
| PayrollItem | source | sourceType, sourceId | No |
| Payroll | employee_period | employee, periodStart, periodEnd | No |
| AuditLog | user_created | user, createdAt | No |
| AuditLog | entity | entity, entityId | No |

## Key Payroll Codes

| Code | Direction | Description |
|------|-----------|-------------|
| LEAVE_FULLY_PAID | none | Annual, sick, maternity (no financial impact) |
| LEAVE_UNPAID_DEDUCTION | deduction | Unpaid leave (daily_rate × days) |
| LEAVE_HOURLY_DEDUCTION | deduction | Hourly leave within balance (no charge) |
| LEAVE_HOURLY_PARTIAL_UNPAID | deduction | Hourly leave exceeding balance |
| MISSION_INTERNAL_ALLOWANCE | addition | 100 SAR default per internal mission |
| MISSION_EXTERNAL_ALLOWANCE | addition | 200 SAR default per external mission |
| OVERTIME_PAYMENT | addition | hourly_rate × multiplier × hours |
| ATTENDANCE_CORRECTION | none | No direct financial impact |

## Sync Flow

```
LeaveRequest (approved)
  │
  ├── calculateCompensation() → {amount, currency, payrollCode, isDeduction, breakdown}
  │
  ├── syncCompensationToPayroll()
  │     ├── idempotencyKey check (prevents duplicates)
  │     ├── Creates PayrollItem {employee, type, direction, amount, sourceModel, sourceId}
  │     └── Returns PayrollItem
  │
  ├── LeaveRequest.payrollItemId = PayrollItem._id
  │
  └── Attendance.create() for leave days

GET /api/payroll/payslip/current
  ├── Payroll.findOne(employeeId, status in [pending, approved])
  ├── PayrollItem.find(employeeId, status=active)
  ├── PayrollItem grouped by direction (additions/deductions)
  ├── LeaveRequest.checkLeaveBalance(annual, sick)
  └── Returns {payslipNumber, income, deductions, totals, leaveBalances}
```
