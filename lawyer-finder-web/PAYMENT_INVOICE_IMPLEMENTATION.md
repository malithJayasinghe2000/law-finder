# Payment & Invoice System Implementation Guide

## Overview
This document outlines the complete payment and invoice management system for lawyer subscriptions in the Lawyer.ai platform.

## Database Schema Changes

### Updated Models

#### Invoice Model
- Added `lawyerId` (relation to LawyerProfile)
- Added `planId` (relation to SubscriptionPlan)
- Changed `status` from `UNPAID` default to `PENDING`
- Added `paymentDetails` (JSON field for payment submission info)
- Removed `subscriptionCycleId` requirement (made optional)
- Added relation to `subscription`

#### Subscription Model
- Added `invoiceId` field with unique constraint
- Added relation `invoice` with `SubscriptionInvoice` relation name

#### LawyerProfile Model
- Added `invoices` relation for tracking lawyer invoices

#### SubscriptionPlan Model
- Added `invoices` relation

### New Enum: PaymentStatus
- PAID
- UNPAID
- PENDING
- RESUBMIT
- CANCELLED

## Backend API Routes

### Invoice Management APIs

#### 1. Check Active Subscription
**Route:** `POST /api/invoices/check-active-subscription`

**Request:**
```json
{
  "planId": "uuid"
}
```

**Response (success):**
```json
{
  "hasActiveSubscription": true|false,
  "subscription": {
    "id": "uuid",
    "planName": "string",
    "status": "ACTIVE|CANCELED|etc",
    "startDate": "ISO date",
    "endDate": "ISO date | null"
  }
}
```

**Purpose:** Validates if lawyer already has an active subscription for the plan before allowing new subscription.

---

#### 2. Create Invoice
**Route:** `POST /api/invoices/create`

**Request:**
```json
{
  "planId": "uuid",
  "billingCycle": "MONTHLY|YEARLY"
}
```

**Response (success):**
```json
{
  "invoice": {
    "id": "uuid",
    "amount": 5000,
    "status": "PENDING",
    "planName": "Professional",
    "createdAt": "ISO date"
  },
  "subscription": {
    "id": "uuid",
    "status": "ACTIVE",
    "billingCycle": "MONTHLY"
  }
}
```

**Purpose:** Creates a new invoice and associated subscription when lawyer clicks subscribe button.
**Note:** Subscription is created with ACTIVE status initially, but will be deactivated until invoice is approved by admin.

---

#### 3. Submit Payment
**Route:** `POST /api/invoices/submit-payment`

**Request:**
```json
{
  "invoiceId": "uuid",
  "bankName": "Commercial Bank",
  "accountHolder": "John Doe",
  "accountNumber": "xxx-xxx-xxx",
  "transactionDate": "ISO datetime",
  "transactionId": "TRANS12345",
  "amount": 5000,
  "receiptImageUrl": "https://...",
  "notes": "Optional notes"
}
```

**Response (success):**
```json
{
  "message": "Payment details submitted successfully",
  "invoice": {
    "id": "uuid",
    "status": "PENDING",
    "amount": 5000,
    "planName": "Professional",
    "paymentDetails": {...},
    "updatedAt": "ISO date"
  }
}
```

**Purpose:** Submits payment proof/details for the invoice. Status changes to PENDING awaiting admin approval.

---

#### 4. Get My Invoices (Lawyer)
**Route:** `GET /api/invoices/my-invoices?page=1&limit=10`

**Response (success):**
```json
{
  "invoices": [
    {
      "id": "uuid",
      "planName": "Professional",
      "amount": 5000,
      "status": "PENDING|PAID|RESUBMIT|CANCELLED",
      "paymentReason": "Subscription payment",
      "paymentDetails": {...},
      "receiptImageUrl": "https://...",
      "subscriptionStatus": "ACTIVE|INACTIVE|CANCELED",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**Purpose:** Retrieves all invoices for the logged-in lawyer.

---

#### 5. Get All Invoices (Admin)
**Route:** `GET /api/admin/invoices?page=1&limit=10&status=PENDING`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `status` - Filter by status (PENDING, PAID, RESUBMIT, CANCELLED)

**Response (success):**
```json
{
  "invoices": [
    {
      "id": "uuid",
      "lawyerId": "uuid",
      "lawyerName": "John Doe",
      "lawyerEmail": "john@example.com",
      "planName": "Professional",
      "amount": 5000,
      "status": "PENDING",
      "paymentDetails": {...},
      "adminNotes": "",
      "subscriptionStatus": "ACTIVE",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

**Purpose:** Admin can view all invoices with filtering by status (descending order).

---

#### 6. Update Invoice Status (Admin)
**Route:** `PUT /api/admin/invoices/[id]`

**Request:**
```json
{
  "status": "PAID|RESUBMIT|CANCELLED",
  "adminNotes": "Optional admin notes"
}
```

**Response (success):**
```json
{
  "message": "Invoice status updated to PAID",
  "invoice": {
    "id": "uuid",
    "status": "PAID",
    "adminNotes": "",
    "lawyerName": "John Doe",
    "amount": 5000,
    "planName": "Professional",
    "subscriptionStatus": "ACTIVE",
    "updatedAt": "ISO date"
  }
}
```

**Status Update Logic:**
- **PAID (Approve):** Activates the subscription. Deactivates all other active subscriptions for this lawyer.
- **RESUBMIT:** Keeps subscription inactive. Lawyer can resubmit payment details.
- **CANCELLED:** Cancels the subscription. Lawyer cannot do anything.

**Purpose:** Admin approves, rejects, or requests resubmission of payment invoices.

---

#### 7. Get Invoice Details (Admin/Lawyer)
**Route:** `GET /api/admin/invoices/[id]`

**Response (success):**
```json
{
  "id": "uuid",
  "lawyerId": "uuid",
  "lawyerName": "John Doe",
  "lawyerEmail": "john@example.com",
  "planName": "Professional",
  "amount": 5000,
  "status": "PENDING",
  "paymentReason": "Subscription payment",
  "paymentDetails": {
    "bankName": "Commercial Bank",
    "accountHolder": "John Doe",
    "accountNumber": "xxx-xxx",
    "transactionDate": "ISO datetime",
    "transactionId": "TRANS12345",
    "amount": 5000,
    "notes": "optional notes",
    "submittedAt": "ISO datetime"
  },
  "receiptImageUrl": "https://...",
  "adminNotes": "",
  "subscriptionStatus": "ACTIVE",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

**Purpose:** Retrieve full details of a specific invoice.

---

## Frontend Components

### 1. SubscriptionCheck Component
**Location:** `src/components/subscriptions/SubscriptionCheck.tsx`

**Props:**
```typescript
interface SubscriptionCheckProps {
  planId: string;
  planName: string;
  amount: number;
  onInvoiceCreated: (invoiceId: string, amount: number) => void;
}
```

**Features:**
- Checks for active subscriptions before allowing new ones
- Shows toast message if subscription already exists
- Creates invoice on subscription
- Triggers payment form on success

---

### 2. PaymentSubmissionForm Component
**Location:** `src/components/subscriptions/PaymentSubmissionForm.tsx`

**Props:**
```typescript
interface PaymentSubmissionFormProps {
  invoiceId: string;
  amount: number;
  planName: string;
  onSuccess?: () => void;
}
```

**Features:**
- Form validation using Zod
- Collects bank transfer details
- Supports receipt image upload
- Shows success/error toast messages
- Optional onSuccess callback

**Form Fields:**
- Bank Name (required)
- Account Holder Name (required)
- Account Number (required)
- Transaction Date (required, datetime)
- Transaction ID (required)
- Amount (required, number)
- Receipt Image URL (optional, URL)
- Additional Notes (optional, text)

---

### 3. LawyerInvoicesTable Component
**Location:** `src/components/subscriptions/LawyerInvoicesTable.tsx`

**Features:**
- Displays all invoices for logged-in lawyer
- Pagination support (page/limit)
- Status badges (Pending, Approved, Resubmit, Cancelled)
- Shows invoice ID, plan name, amount, status, creation date
- Action buttons:
  - PENDING: "Submit Payment" button opens form
  - RESUBMIT: "Resubmit" button opens form
  - PAID/CANCELLED: Disabled button
- Modal for payment form submission
- Auto-refresh after successful payment submission

---

### 4. AdminInvoicesTable Component
**Location:** `src/components/admin/AdminInvoicesTable.tsx`

**Features:**
- Displays all invoices with admin controls
- Status filter dropdown (All, Pending, Approved, Resubmit, Cancelled)
- Descending order by creation date
- Pagination support
- Shows: Invoice ID, Lawyer Name/Email, Plan, Amount, Status, Created Date
- Action buttons:
  - View: Opens detailed invoice modal with payment details
  - Action dropdown (for PENDING status):
    - Approve: Changes status to PAID, activates subscription
    - Resubmit: Changes status to RESUBMIT
    - Cancel: Changes status to CANCELLED
- Modal shows full payment details submitted by lawyer
- Admin can add notes

---

## Pages

### 1. Lawyer Invoices Page
**URL:** `/[locale]/dashboard/lawyer/invoices`
**Component:** `LawyerInvoicesTable`
**Purpose:** View and manage own invoices

### 2. Admin Invoices Page
**URL:** `/[locale]/dashboard/admin/invoices`
**Component:** `AdminInvoicesTable`
**Purpose:** Manage all lawyer payment invoices

### 3. Invoice Payment Page (Updated)
**URL:** `/[locale]/dashboard/lawyer/payments/invoice/[planId]`
**Changes:**
- Added "Pay Now" button that creates invoice and shows form
- Integrated `PaymentSubmissionForm` component
- Shows payment modal instead of payment method selection
- On success, redirects to invoices page

---

## Workflow

### For Lawyers

1. **Subscribe to Plan**
   - Lawyer clicks "Subscribe Now" on pricing page
   - System checks for existing active subscriptions
   - If active subscription exists → show toast message
   - If no active subscription → create invoice with PENDING status
   - Show invoice details and payment form

2. **Submit Payment**
   - Fill in bank transfer details
   - Upload receipt image (optional)
   - Submit form
   - Invoice status changes to PENDING
   - Lawyer sees invoice in "My Invoices" table with "Pending" status

3. **Accept Resubmission (if needed)**
   - Admin rejects with RESUBMIT status
   - Invoice shows "Resubmit" button in table
   - Lawyer can resubmit updated payment details

4. **View Approved Invoices**
   - Admin approves → subscription becomes ACTIVE
   - Invoice shows status "Approved"
   - Lawyer can use subscription features

---

### For Admins

1. **View All Invoices**
   - Navigate to Admin → Payment Invoices
   - See all invoices ordered by newest first
   - Filter by status (Pending, Approved, Resubmit, Cancelled)

2. **Review Payment Details**
   - Click "View" button on invoice row
   - See full payment details (bank info, receipt, etc.)
   - Review lawyer's submitted information

3. **Take Action**
   - **Approve:** Changes status to PAID, activates subscription
     - Deactivates all other active subscriptions for this lawyer
     - Activates the current subscription
   - **Resubmit:** Changes status to RESUBMIT
     - Allows lawyer to resubmit with corrections
   - **Cancel:** Changes status to CANCELLED
     - Cancels both invoice and subscription
     - Lawyer cannot do anything with this invoice

---

## Key Business Rules

1. **Only One Active Subscription Per Plan Per Lawyer**
   - Before creating invoice, system checks for active subscriptions
   - If active exists, shows toast message preventing duplicate

2. **Subscription Activation**
   - Subscription is created with ACTIVE status
   - But remains inactive until invoice is PAID
   - When invoice is approved (PAID), subscription is activated
   - All other active subscriptions for that lawyer are deactivated

3. **Invoice Status Flow**
   - PENDING → PAID (approved) → Subscription ACTIVE
   - PENDING → RESUBMIT → Lawyer can resubmit
   - PENDING → CANCELLED → Cannot do anything
   - RESUBMIT → PAID (approved) → Subscription ACTIVE
   - RESUBMIT → CANCELLED → Cannot do anything

4. **Soft Delete Pattern**
   - No hard deletion of invoices
   - Use status field to manage lifecycle
   - All invoices retained for audit trail

---

## API Response Codes

- **200 OK:** Request successful
- **201 CREATED:** Invoice created successfully
- **400 BAD REQUEST:** Invalid request data
- **401 UNAUTHORIZED:** Not authenticated
- **403 FORBIDDEN:** Not authorized for this resource
- **404 NOT FOUND:** Resource not found
- **500 INTERNAL SERVER ERROR:** Server error

---

## Schema Validation

### Schemas (Zod)

1. **CreateInvoiceSchema**
   - planId: UUID required
   - billingCycle: MONTHLY|YEARLY (default MONTHLY)

2. **SubmitPaymentSchema**
   - invoiceId: UUID required
   - bankName: string required
   - accountHolder: string required
   - accountNumber: string required
   - transactionDate: ISO datetime required
   - transactionId: string required
   - amount: positive number required
   - receiptImageUrl: URL optional
   - notes: string optional

3. **CheckActiveSubscriptionSchema**
   - planId: UUID required

4. **PaymentStatusSchema**
   - Must be one of: PAID, UNPAID, PENDING, RESUBMIT, CANCELLED

---

## Error Handling

All endpoints include:
- Input validation with Zod
- Proper HTTP status codes
- User-friendly error messages
- Toast notifications on frontend
- Logging for debugging

---

## Future Enhancements

1. Payment gateway integration (online payments)
2. Automated reminders for pending invoices
3. Invoice generation and email
4. Subscription auto-renewal logic
5. Refund processing
6. Payment history reports
7. Financial analytics for admins

---

## Migration Notes

If migrating from old system:
1. Update existing invoices with proper status
2. Create subscriptions for active invoices
3. Link invoices to subscriptions
4. Verify all timestamps are correct

---

## Testing Checklist

- [ ] Lawyer subscription check validation
- [ ] Invoice creation and status assignment
- [ ] Payment form validation
- [ ] Admin invoice viewing and filtering
- [ ] Admin invoice status changes
- [ ] Subscription activation on approval
- [ ] Multiple subscription deactivation
- [ ] Toast notifications display correctly
- [ ] Pagination works correctly
- [ ] Authorization checks work
