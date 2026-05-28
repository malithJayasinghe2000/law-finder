import nodemailer from 'nodemailer';
import prisma from '@/lib/db';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER || 'testing_user',
    pass: process.env.SMTP_PASS || 'testing_password'
  }
});

const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || '"LawFinder SL" <noreply@lawfinder.lk>';

async function getAdminEmails(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
    return admins.map(a => a.email).filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch admin emails:', error);
    return [];
  }
}

const template = (title: string, body: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>${title}</h2>
    ${body}
  </div>
`;

async function sendMailSafe(to: string | string[], subject: string, html: string) {
  if (!to || (Array.isArray(to) && to.length === 0)) return;
  try {
    await transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
  } catch (error) {
    console.error('Email sending failed:', error);
  }
}

export const EmailService = {
  async sendEmailVerification(email: string, token: string, fullName: string) {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}`;
    await sendMailSafe(email, 'Verify your email address - LawFinder SL', template('Welcome to LawFinder SL!', `
      <p>Dear ${fullName},</p>
      <p>Please click the button below to verify your email address.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="background-color: #0a0a0a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
      </div>
    `));
  },

  async sendApplicationSubmitted(email: string, fullName: string) {
    await sendMailSafe(email, 'Lawyer Application Received', template('Application Received', `
      <p>Dear ${fullName},</p>
      <p>We have successfully received your application. Our legal team will review your BASL credentials shortly.</p>
    `));
  },

  async sendApplicationApproved(email: string, fullName: string) {
    await sendMailSafe(email, 'Lawyer Application Approved', template('Application Approved', `
      <p>Dear ${fullName},</p>
      <p>Congratulations! Your application has been approved. You can now log in to your Lawyer Dashboard.</p>
    `));
  },
  
  async sendApplicationRejected(email: string, fullName: string, reason: string) {
    await sendMailSafe(email, 'Lawyer Application Update', template('Application Update', `
      <p>Dear ${fullName},</p>
      <p>Unfortunately, your application could not be approved at this time.</p>
      <p><strong>Reason:</strong> ${reason}</p>
    `));
  },

  // 1. New Booking Created - Client
  async sendBookingCreatedClient(email: string, clientName: string, lawyerName: string, date: string, time: string, bookingNumber: string) {
    await sendMailSafe(email, 'Booking Created - Payment Required', template('Booking Placed', `
      <p>Dear ${clientName},</p>
      <p>Your consultation with ${lawyerName} on <strong>${date} at ${time}</strong> has been reserved.</p>
      <p>Booking Ref: <strong>${bookingNumber}</strong></p>
      <p>Please log in to your dashboard to complete the payment and confirm the booking.</p>
    `));
  },

  // 2. New Booking Created - Lawyer
  async sendBookingCreatedLawyer(email: string, lawyerName: string, clientName: string, date: string, time: string) {
    await sendMailSafe(email, 'New Booking Reserved (Pending Payment)', template('New Booking Alert', `
      <p>Dear ${lawyerName},</p>
      <p>A client (${clientName}) has reserved a consultation slot for <strong>${date} at ${time}</strong>.</p>
      <p>The booking is currently pending payment. You will be notified once the payment is confirmed.</p>
    `));
  },

  // 3. New Booking Created - Admin
  async sendBookingCreatedAdmin(clientName: string, lawyerName: string, date: string, time: string, bookingNumber: string) {
    const admins = await getAdminEmails();
    await sendMailSafe(admins, `New Booking Alert: ${bookingNumber}`, template('New Booking Needs Attention', `
      <p>A new booking has been placed and is pending payment.</p>
      <ul>
        <li>Booking Ref: ${bookingNumber}</li>
        <li>Client: ${clientName}</li>
        <li>Lawyer: ${lawyerName}</li>
        <li>Date/Time: ${date} ${time}</li>
      </ul>
    `));
  },

  // 4. Payment Submitted - Client
  async sendPaymentSubmittedClient(email: string, clientName: string, bookingNumber: string) {
    await sendMailSafe(email, 'Payment Receipt Received', template('Payment Received', `
      <p>Dear ${clientName},</p>
      <p>We have received your bank transfer receipt for booking <strong>${bookingNumber}</strong>.</p>
      <p>Our admin team is verifying it. You will receive a confirmation email shortly.</p>
    `));
  },

  // 5. Payment Verification Needed - Admin
  async sendPaymentVerificationAdmin(bookingNumber: string, clientName: string, amount: number) {
    const admins = await getAdminEmails();
    await sendMailSafe(admins, `Payment Verification Required: ${bookingNumber}`, template('Action Required: Verify Payment', `
      <p>Client ${clientName} has uploaded a bank transfer receipt for booking <strong>${bookingNumber}</strong>.</p>
      <p>Amount: LKR ${amount}</p>
      <p>Please log in to the admin dashboard to verify or reject this payment.</p>
    `));
  },

  // 6. Booking Confirmed - Client
  async sendBookingConfirmationClient(email: string, clientName: string, lawyerName: string, date: string, time: string, meetingLink?: string, officeAddress?: string) {
    await sendMailSafe(email, `Booking Confirmed: Consultation with ${lawyerName}`, template('Booking Confirmed!', `
      <p>Dear ${clientName},</p>
      <p>Your payment has been verified and your consultation is confirmed for <strong>${date} at ${time}</strong>.</p>
      ${meetingLink ? `<p><strong>Online Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
      ${officeAddress ? `<p><strong>Office Address:</strong> ${officeAddress}</p>` : ''}
    `));
  },

  // 7. Booking Confirmed - Lawyer
  async sendBookingConfirmationLawyer(email: string, lawyerName: string, clientName: string, date: string, time: string, mode: string) {
    await sendMailSafe(email, 'New Consultation Confirmed', template('Consultation Confirmed', `
      <p>Dear ${lawyerName},</p>
      <p>A new consultation has been fully paid and confirmed.</p>
      <ul>
        <li>Client: ${clientName}</li>
        <li>Date/Time: ${date} ${time}</li>
        <li>Mode: ${mode}</li>
      </ul>
    `));
  },

  // 8. Payment Resubmit - Client
  async sendPaymentResubmitClient(email: string, clientName: string, bookingNumber: string, reason?: string) {
    await sendMailSafe(email, `Payment Verification Failed - ${bookingNumber}`, template('Action Required: Resubmit Payment', `
      <p>Dear ${clientName},</p>
      <p>We were unable to verify your payment receipt for booking <strong>${bookingNumber}</strong>.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>Please log in to your dashboard and submit a clearer receipt or use an alternative payment method.</p>
    `));
  },

  // 9. Booking Cancelled - Client
  async sendBookingCancelledClient(email: string, clientName: string, bookingNumber: string, reason: string, refundAmount: number) {
    await sendMailSafe(email, `Booking Cancelled - ${bookingNumber}`, template('Booking Cancelled', `
      <p>Dear ${clientName},</p>
      <p>Your booking <strong>${bookingNumber}</strong> has been cancelled.</p>
      <p>Reason: ${reason}</p>
      ${refundAmount > 0 ? `<p>A refund of LKR ${refundAmount} is currently pending processing by our admin team.</p>` : ''}
    `));
  },

  // 10. Booking Cancelled - Lawyer
  async sendBookingCancelledLawyer(email: string, lawyerName: string, bookingNumber: string, clientName: string) {
    await sendMailSafe(email, `Consultation Cancelled - ${bookingNumber}`, template('Consultation Cancelled', `
      <p>Dear ${lawyerName},</p>
      <p>The consultation with ${clientName} (Ref: ${bookingNumber}) has been cancelled.</p>
      <p>This slot is now available for other clients to book.</p>
    `));
  },

  // 12. Refund Processed
  async sendRefundProcessed(email: string, clientName: string, bookingNumber: string, refundAmount: number) {
    await sendMailSafe(email, `Refund Processed - ${bookingNumber}`, template('Refund Processed', `
      <p>Dear ${clientName},</p>
      <p>Your refund of <strong>LKR ${refundAmount}</strong> for booking ${bookingNumber} has been successfully processed.</p>
      <p>Please allow a few business days for the funds to appear in your account.</p>
    `));
  },

  // 13. Refund Declined
  async sendRefundDeclined(email: string, clientName: string, bookingNumber: string, reason: string) {
    await sendMailSafe(email, `Refund Declined - ${bookingNumber}`, template('Refund Update', `
      <p>Dear ${clientName},</p>
      <p>Your refund request for booking ${bookingNumber} was declined by our admin team.</p>
      <p><strong>Reason:</strong> ${reason}</p>
    `));
  },

  // 14. Consultation Completed
  async sendConsultationCompleted(email: string, clientName: string, lawyerName: string) {
    await sendMailSafe(email, `How was your consultation with ${lawyerName}?`, template('Leave a Review', `
      <p>Dear ${clientName},</p>
      <p>Your consultation with ${lawyerName} was recently marked as completed.</p>
      <p>Please log in to your dashboard to leave a rating and review to help others find great legal assistance!</p>
    `));
  }
};
