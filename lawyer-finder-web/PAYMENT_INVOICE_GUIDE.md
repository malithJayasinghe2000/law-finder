# Payment & Invoice System - Integration Guide

## Overview
This document explains the complete payment and invoice management system integration for lawyer subscriptions.

## System Architecture

### Database Schema Changes
The following models have been updated:

1. **Invoice Model**
   - `id`: Unique invoice identifier
   - `lawyerId`: Reference to lawyer profile
   - `planId`: Reference to subscription plan
   - `amount`: Payment amount in LKR
   - `status`: PENDING, PAID (APPROVED), RESUBMIT, CANCELLED
   - `paymentDetails`: JSON field storing payment submission details
   - `receiptImageUrl`: Optional receipt image URL
   - `adminNotes`: Admin notes field

2. **Subscription Model** (Updated)
   - Added `invoiceId`: Reference to linked invoice
   - Subscription now tracks its associated invoice

## Payment Flow

### Step 1: Lawyer Initiates Subscribe
**Endpoint**: Check Active Subscription
- **URL**: `POST /api/invoices/check-active-subscription`
- **Body**: `{ planId: string }`
- **Purpose**: Verify lawyer doesn't already have active subscription for that plan
- **Response**: `{ hasActiveSubscription: boolean }`

### Step 2: Create Invoice & Initial Subscription
**Endpoint**: Create Invoice
- **URL**: `POST /api/invoices/create`
- **Body**: `{ planId: string, billingCycle: "MONTHLY" | "YEARLY" }`
- **Purpose**: Create invoice (PENDING status) and inactive subscription
- **Response**: Invoice and subscription details

### Step 3: Submit Payment Details
**Endpoint**: Submit Payment
- **URL**: `POST /api/invoices/submit-payment`
- **Body**: 
```json
{
  "invoiceId": "string",
  "bankName": "string",
  "accountHolder": "string",
  "accountNumber": "string",
  "transactionDate": "ISO datetime",
  "transactionId": "string",
  "amount": "number",
  "receiptImageUrl": "string (optional)",
  "notes": "string (optional)"
}
```
- **Purpose**: Submit payment proof for admin verification
- **Response**: Updated invoice with payment details

## Admin Management

### View Invoices
**Endpoint**: Get Admin Invoices
- **URL**: `GET /api/admin/invoices?page=1&limit=10&status=PENDING`
- **Status Filter**: PENDING, PAID, RESUBMIT, CANCELLED, or empty for all
- **Response**: Paginated list of invoices

### Update Invoice Status
**Endpoint**: Update Invoice Status
- **URL**: `PUT /api/admin/invoices/{id}`
- **Body**: `{ status: "PAID" | "RESUBMIT" | "CANCELLED", adminNotes?: string }`
- **Actions**:
  - **PAID**: Activates subscription, deactivates other active subscriptions
  - **RESUBMIT**: Lawyer must resubmit payment details
  - **CANCELLED**: Subscription marked as cancelled, lawyer can't proceed

## Frontend Components

### 1. SubscriptionCheck Component
**File**: `src/components/subscriptions/SubscriptionCheck.tsx`
- Displays subscription plan details
- Checks for active subscriptions
- Initiates invoice creation
- Shows toast notifications

### 2. PaymentSubmissionForm Component
**File**: `src/components/subscriptions/PaymentSubmissionForm.tsx`
- Form for submitting payment details
- Validates all required fields with Zod
- Handles form submission
- Provides error feedback

### 3. LawyerInvoicesTable Component
**File**: `src/components/subscriptions/LawyerInvoicesTable.tsx`
- Displays lawyer's invoices in paginated table
- Shows invoice status with color-coded badges
- Provides "Submit Payment" button for PENDING invoices
- Provides "Resubmit" button for RESUBMIT status invoices
- Opens payment form in modal

### 4. AdminInvoicesTable Component
**File**: `src/components/admin/AdminInvoicesTable.tsx`
- Displays all invoices in paginated table
- Filters by status (PENDING, PAID, RESUBMIT, CANCELLED)
- Shows lawyer information alongside invoice
- View button to see payment details
- Action dropdown for PENDING invoices (Approve, Resubmit, Cancel)
- Updates subscription status on approval

## Pages Created

### Lawyer Dashboard
- **URL**: `/[locale]/dashboard/lawyer/payments/invoices`
- **Component**: `LawyerInvoicesTable`
- **Purpose**: View personal subscription invoices

### Admin Dashboard
- **URL**: `/[locale]/dashboard/admin/invoices`
- **Component**: `AdminInvoicesTable`
- **Purpose**: Manage all lawyer payment invoices

## Key Features

### 1. One Active Subscription Per User
- When admin approves payment, all other active subscriptions for that user are deactivated
- Ensures only one active plan at a time

### 2. Subscription Status Management
- Invoices start in PENDING status
- Subscriptions created alongside invoices (inactive)
- Only activated when invoice is APPROVED by admin
- Can be cancelled if invoice is CANCELLED

### 3. Payment Status Tracking
- PENDING: Awaiting admin review
- PAID: Approved and subscription activated
- RESUBMIT: Lawyer needs to resubmit payment details
- CANCELLED: Cannot proceed, lawyer locked out

### 4. Invoice Details
Stored in `paymentDetails` JSON field:
- Bank name
- Account holder name
- Account number
- Transaction date and ID
- Amount
- Submission timestamp

## Validation

### Frontend Validation
- Zod schemas validate all form inputs
- Real-time error feedback
- Type-safe form handling

### Backend Validation
- Validates request data with Zod
- Checks authorization (lawyer owns invoice or admin)
- Verifies invoice existence and status
- Prevents invalid state transitions

## Error Handling

### Toast Notifications
- Success messages on successful operations
- Error messages with clear descriptions
- Auto-dismiss after 3 seconds

### API Response Codes
- 200: Success (GET, PUT)
- 201: Created (POST)
- 400: Invalid input
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 500: Server error

## Integration Steps

1. **Database Migration**
   - Schema has been updated with necessary fields
   - Run `npx prisma migrate dev` to apply changes

2. **Import Components**
   ```tsx
   import { SubscriptionCheck } from '@/components/subscriptions/SubscriptionCheck';
   import { PaymentSubmissionForm } from '@/components/subscriptions/PaymentSubmissionForm';
   import { LawyerInvoicesTable } from '@/components/subscriptions/LawyerInvoicesTable';
   import { AdminInvoicesTable } from '@/components/admin/AdminInvoicesTable';
   ```

3. **Use in Pages**
   - Admin invoices already added to `/dashboard/admin/invoices`
   - Lawyer invoices already added to `/dashboard/lawyer/payments/invoices`

## API Examples

### Create Invoice
```bash
curl -X POST /api/invoices/create \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "plan-id-here",
    "billingCycle": "MONTHLY"
  }'
```

### Submit Payment
```bash
curl -X POST /api/invoices/submit-payment \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "invoice-id-here",
    "bankName": "Bank of Ceylon",
    "accountHolder": "John Doe",
    "accountNumber": "123-456-789",
    "transactionDate": "2024-04-11T10:30:00Z",
    "transactionId": "TXN123456",
    "amount": 15000
  }'
```

### Approve Invoice (Admin)
```bash
curl -X PUT /api/admin/invoices/invoice-id-here \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PAID",
    "adminNotes": "Payment verified"
  }'
```

## Future Enhancements

1. Email notifications to lawyers when invoice status changes
2. Automatic invoice generation based on subscription renewal dates
3. Payment gateway integration (Stripe, PayPal)
4. Automated payment verification
5. Invoice PDF generation and download
6. Payment history reports
7. Subscription renewal reminders
8. Late payment handling

## Support

For issues or questions about this implementation, refer to the API documentation in the respective route files.
