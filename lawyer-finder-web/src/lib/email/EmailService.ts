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

const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || '"TheLawyr" <noreply@thelawyr.lk>';

async function getAdminEmails(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
    return admins.map(a => a.email).filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch admin emails:', error);
    return [];
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const template = (title: string, body: string) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thelawyr.lk';
  const currentYear = new Date().getFullYear();
  return `
    <div style="background-color: #faf8f6; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; text-align: center; margin: 0;">
      <div style="background-color: #ffffff; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #efeae0; text-align: left; box-sizing: border-box;">
        <!-- Logo -->
        <div style="text-align: center; margin-bottom: 32px;">
          <img src="${appUrl}/logo.png" alt="TheLawyr Logo" style="height: 36px; display: inline-block; vertical-align: middle;" />
        </div>
        
        <!-- Divider -->
        <div style="height: 1px; background-color: #efeae0; margin-bottom: 32px;"></div>
        
        <!-- Header / Title -->
        <h2 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: normal; color: #0a0a0a; margin: 0 0 24px 0; line-height: 1.3; text-align: center;">
          ${title}
        </h2>
        
        <!-- Content Body -->
        <div style="color: #404040; font-size: 15px; line-height: 1.6; font-weight: 300; margin-bottom: 32px;">
          ${body}
        </div>
        
        <!-- Footer / Signature -->
        <div style="border-top: 1px solid #efeae0; padding-top: 24px; margin-top: 32px; text-align: center;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #737373; margin: 0 0 8px 0; font-weight: 700;">
            TheLawyr
          </p>
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #a3a3a3; margin: 0;">
            Copyright © ${currentYear} TheLawyr. All Rights Reserved.<br/>
            Powered by FiveNeurals.
          </p>
        </div>
      </div>
    </div>
  `;
};

async function sendMailSafe(to: string | string[], subject: string, html: string) {
  if (!to || (Array.isArray(to) && to.length === 0)) return;
  try {
    await transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
  } catch (error) {
    console.error('Email sending failed:', error);
  }
}

export const EmailService = {
  /** `query` is built by src/lib/emailVerification.ts: token, language and where to return. */
  async sendEmailVerification(email: string, query: string, fullName: string) {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?${query}`;
    await sendMailSafe(email, 'Verify your email address - TheLawyr', template('Welcome to TheLawyr!', `
      <p>Dear ${fullName},</p>
      <p>Please click the button below to verify your email address.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="background-color: #bfa37a; color: #ffffff; padding: 14px 28px; text-decoration: none; display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 0;">Verify Email</a>
      </div>
    `));
  },

  /**
   * Invite someone to join a law firm.
   *
   * Deliberately plain about what accepting means. Joining a practice puts a
   * person inside a privilege boundary — they will be able to see that the
   * firm's matters exist — so the email says so rather than reading as a generic
   * "you've been added to a team" notification.
   */
  async sendFirmInvitation(params: {
    to: string;
    firmName: string;
    invitedByName: string;
    role: string;
    token: string;
  }) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thelawyr.lk';
    const url = `${appUrl}/firm-invitation?token=${params.token}`;

    const roleLabel: Record<string, string> = {
      FIRM_OWNER: 'a principal (partner) of the practice',
      FIRM_ADMIN: 'a practice manager',
      ATTORNEY: 'an attorney practising in the firm',
      PARALEGAL: 'a paralegal',
    };

    await sendMailSafe(
      params.to,
      `${params.invitedByName} has invited you to join ${params.firmName}`,
      template('An invitation to join a practice', `
        <p>${params.invitedByName} has invited you to join <strong>${params.firmName}</strong> on TheLawyr as ${roleLabel[params.role] ?? 'a member of the firm'}.</p>
        <p>If you accept, you will be able to see that the firm's matters exist. What you can read about any one of them depends on your role and on whether the matter is assigned to you - a client's own account of their legal problem is not visible to everyone in a practice.</p>
        <p>You do not have to accept, and nothing happens until you do.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #bfa37a; color: #ffffff; padding: 14px 28px; text-decoration: none; display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 0;">View the invitation</a>
        </div>
        <p style="font-size: 13px; color: #737373;">This invitation was sent to ${params.to} and can only be accepted by signing in with that address. It expires in 14 days. If you were not expecting it, ignore this email - no account of yours has been changed.</p>
      `)
    );
  },

  /**
   * A practice asks a client to confirm a request it opened for them.
   *
   * Says nothing about the matter: email is not a privileged channel, and the
   * address may be wrong. The details are shown only after the client signs in
   * with this address. See src/lib/firms/clientIntake.ts.
   */
  async sendClientIntakeInvitation(params: { to: string; firmName: string; token: string }) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thelawyr.lk';
    const url = `${appUrl}/client-request?token=${params.token}`;
    const firm = escapeHtml(params.firmName);

    await sendMailSafe(
      params.to,
      `${params.firmName} asks you to confirm your request`,
      template('Confirm your request', `
        <p><strong>${firm}</strong> says you asked them to act for you, and has opened a request on TheLawyr, the software the practice uses to manage its matters.</p>
        <p>Nothing is added to your account unless you confirm it. Sign in - or create an account with this email address - to see the request and accept or decline it.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #bfa37a; color: #ffffff; padding: 14px 28px; text-decoration: none; display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 0;">View the request</a>
        </div>
        <p style="font-size: 13px; color: #737373;">Sent to ${escapeHtml(params.to)}. The link expires in 14 days. If you did not contact ${firm}, ignore this email.</p>
      `)
    );
  },

  /**
   * A practice cannot act for this client. Never says why: the reason is a
   * conflict with another client, and that is confidential to them.
   */
  async sendRequestDeclined(params: { to: string; clientName: string; firmName: string; bookingNumber: string }) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thelawyr.lk';
    const firm = escapeHtml(params.firmName);
    await sendMailSafe(
      params.to,
      `Your request ${params.bookingNumber} - ${params.firmName} is unable to act`,
      template('Request not accepted', `
        <p>Dear ${escapeHtml(params.clientName)},</p>
        <p><strong>${firm}</strong> has told us it is unable to act for you in request <strong>${params.bookingNumber}</strong>.</p>
        <p>Practices decline for professional reasons they cannot share, and this is not a judgment on your matter. You are free to approach another practice.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/firms" style="background-color: #bfa37a; color: #ffffff; padding: 14px 28px; text-decoration: none; display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 0;">Browse practices</a>
        </div>
      `)
    );
  },

  // A data-protection request has been passed to a practice for the part that is
  // its own matter file. It carries a legal deadline, so the people who may answer
  // it are told. Deliberately nothing about the person or their request — the
  // practice reads that on the signed-in page, not in an inbox.
  async sendDataRequestReferred(params: { to: string; firmName: string; dueBy: Date }) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thelawyr.lk';
    const due = params.dueBy.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Colombo',
    });
    await sendMailSafe(
      params.to,
      `A data-protection request is waiting for ${params.firmName}`,
      template('Data-protection request', `
        <p>A client has asked for their personal data, and part of it is a matter file held by <strong>${escapeHtml(params.firmName)}</strong>.</p>
        <p>Your practice decides what happens to its own files. Please answer by <strong>${due}</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/en/dashboard/lawyer/firm/requests" style="background-color: #bfa37a; color: #ffffff; padding: 14px 28px; text-decoration: none; display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 0;">Open data requests</a>
        </div>
      `)
    );
  },

  /**
   * Our decision on a registered practice. Without it a practice asked for more
   * information never learned it was being waited on.
   */
  async sendFirmVerificationDecision(params: {
    to: string[];
    firmName: string;
    decision: 'VERIFIED' | 'REJECTED' | 'PENDING';
    notes: string | null;
  }) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thelawyr.lk';
    const firm = escapeHtml(params.firmName);
    const [subject, lead] = {
      VERIFIED: [
        `${params.firmName} is verified`,
        `<p>We have verified <strong>${firm}</strong>. It can now appear in the public directory.</p>`,
      ],
      REJECTED: [
        `${params.firmName} could not be verified`,
        `<p>We could not verify <strong>${firm}</strong>, so it is not shown in the public directory.</p>`,
      ],
      PENDING: [
        `We need more information about ${params.firmName}`,
        `<p>Before we can verify <strong>${firm}</strong>, we need more information from you.</p>`,
      ],
    }[params.decision];
    await sendMailSafe(
      params.to,
      subject,
      template('Practice verification', `
        ${lead}
        ${params.notes ? `<p><strong>Our note:</strong> ${escapeHtml(params.notes)}</p>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/en/dashboard/lawyer/firm" style="background-color: #bfa37a; color: #ffffff; padding: 14px 28px; text-decoration: none; display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 0;">Open your practice</a>
        </div>
      `)
    );
  },

  /**
   * Sent to the OLD address when our staff change an account's email. Without
   * it a change of address — the first step of taking an account over — would
   * be invisible to the person who owns it.
   */
  async sendEmailChangedByAdmin(params: { oldEmail: string; newEmail: string }) {
    await sendMailSafe(
      params.oldEmail,
      'The email address on your TheLawyr account was changed',
      template('Email address changed', `
        <p>Our team changed the email address on your account to <strong>${escapeHtml(params.newEmail)}</strong>.</p>
        <p>From now on you sign in with the new address, and messages about your account go there.</p>
        <p>If you did not ask for this, reply to this email straight away.</p>
      `)
    );
  },

  /** An admin withdrew an attorney's verification; they are told why. */
  async sendVerificationRevoked(params: { to: string; fullName: string; reason: string }) {
    await sendMailSafe(
      params.to,
      'Your verification on TheLawyr has been withdrawn',
      template('Verification withdrawn', `
        <p>Dear ${escapeHtml(params.fullName)},</p>
        <p>We have withdrawn the verification on your attorney profile. While it is withdrawn you are not shown in the public directory.</p>
        <p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
        <p>If you think this is a mistake, reply to this email.</p>
      `)
    );
  },

  /** A one-hour link to choose a new password. */
  async sendPasswordReset(params: { to: string; resetUrl: string; byAdmin: boolean }) {
    await sendMailSafe(
      params.to,
      'Reset your TheLawyr password',
      template('Reset your password', `
        <p>${params.byAdmin ? 'Our team sent you this link at your request.' : 'Someone asked to reset the password for this account.'} Use the button below to choose a new password. The link works once and expires in one hour.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${params.resetUrl}" style="background-color: #bfa37a; color: #ffffff; padding: 14px 28px; text-decoration: none; display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 0;">Choose a new password</a>
        </div>
        <p>If you did not ask for this, ignore this email. Your password stays the same.</p>
      `)
    );
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

  // Matter reassigned within the firm.
  //
  // The client engaged the FIRM, so the firm is entitled to decide which of its
  // attorneys acts — but the client is entitled to know who that is. Naming the
  // firm as the provider, with the attorney acting for it, is the wording
  // required by guardrail rule 7.
  async sendMatterReassignedClient(
    email: string,
    clientName: string,
    bookingNumber: string,
    firmName: string,
    attorneyName: string
  ) {
    await sendMailSafe(email, `Your matter ${bookingNumber} - attorney assigned`, template('Attorney Assigned', `
      <p>Dear ${clientName},</p>
      <p>${firmName} has assigned <strong>${attorneyName}</strong> to act on your matter
         <strong>${bookingNumber}</strong>.</p>
      <p>${firmName} remains the provider of legal services in this matter. Your engagement
         terms, fee and scope are unchanged.</p>
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
  },

  // 15. Invoice Payment Approved / Receipt
  async sendInvoicePaidReceipt(email: string, lawyerName: string, invoiceId: string, amount: number, paymentReason: string, billingCycle?: string) {
    const formattedAmount = amount.toLocaleString();
    const invoiceNumber = `LAI-${new Date().getFullYear()}-${invoiceId.substring(0, 8).toUpperCase()}`;
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });

    await sendMailSafe(email, `Payment Receipt: Invoice #${invoiceId.substring(0, 8).toUpperCase()} - TheLawyr`, template(
      '<span style="color: #16a34a;">Payment Confirmed / Receipt</span>', 
      `
      <p>Dear ${lawyerName},</p>
      <p>Thank you for your payment. This email serves as your official payment receipt.</p>
      
      <!-- Receipt Details Table -->
      <div style="background-color: #faf8f6; padding: 20px; border: 1px solid #efeae0; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #737373; font-weight: bold;">Receipt Number:</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #737373; font-weight: bold;">Payment Date:</td>
            <td style="padding: 6px 0; text-align: right;">${date}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0 6px 0; font-weight: bold; border-top: 1px solid #efeae0;">Description:</td>
            <td style="padding: 12px 0 6px 0; text-align: right; font-weight: bold; border-top: 1px solid #efeae0;">${paymentReason}</td>
          </tr>
          ${billingCycle ? `
          <tr>
            <td style="padding: 6px 0; color: #737373;">Billing Cycle:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: bold;">${billingCycle}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 12px 0; font-size: 18px; font-weight: bold; border-top: 2px solid #16a34a; color: #0a0a0a;">Amount Paid:</td>
            <td style="padding: 12px 0; font-size: 18px; font-weight: bold; border-top: 2px solid #16a34a; text-align: right; color: #16a34a;">LKR ${formattedAmount}.00</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://thelawyr.lk'}/dashboard/lawyer/payments/offline/${invoiceId}" style="background-color: #16a34a; color: #ffffff; padding: 14px 28px; text-decoration: none; display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 0;">View in Dashboard</a>
      </div>
      `
    ));
  },

  // 16. Send Invoice Email
  async sendInvoiceCreated(email: string, lawyerName: string, invoiceId: string, amount: number, paymentReason: string, billingCycle?: string) {
    const formattedAmount = amount.toLocaleString();
    const invoiceNumber = `LAI-${new Date().getFullYear()}-${invoiceId.substring(0, 8).toUpperCase()}`;
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
    const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });

    await sendMailSafe(email, `Invoice Created: #${invoiceId.substring(0, 8).toUpperCase()} - TheLawyr`, template(
      'Invoice Issued', 
      `
      <p>Dear ${lawyerName},</p>
      <p>An invoice has been generated for your subscription or service with TheLawyr.</p>
      
      <!-- Invoice Details Table -->
      <div style="background-color: #faf8f6; padding: 20px; border: 1px solid #efeae0; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #737373; font-weight: bold;">Invoice Number:</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #737373; font-weight: bold;">Date Issued:</td>
            <td style="padding: 6px 0; text-align: right;">${date}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #737373; font-weight: bold;">Due Date:</td>
            <td style="padding: 6px 0; text-align: right; color: #dc2626; font-weight: bold;">${dueDate}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0 6px 0; font-weight: bold; border-top: 1px solid #efeae0;">Description:</td>
            <td style="padding: 12px 0 6px 0; text-align: right; font-weight: bold; border-top: 1px solid #efeae0;">${paymentReason}</td>
          </tr>
          ${billingCycle ? `
          <tr>
            <td style="padding: 6px 0; color: #737373;">Billing Cycle:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: bold;">${billingCycle}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 12px 0; font-size: 18px; font-weight: bold; border-top: 2px solid #000000; color: #0a0a0a;">Total Due:</td>
            <td style="padding: 12px 0; font-size: 18px; font-weight: bold; border-top: 2px solid #000000; text-align: right; color: #bfa37a;">LKR ${formattedAmount}.00</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://thelawyr.lk'}/dashboard/lawyer/payments/offline/${invoiceId}" style="background-color: #bfa37a; color: #ffffff; padding: 14px 28px; text-decoration: none; display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 0;">Pay Now</a>
      </div>
      `
    ));
  },

  async sendPaymentApprovedAwaitingLawyerClient(email: string, clientName: string, bookingNumber: string, lawyerName: string) {
    await sendMailSafe(email, `Payment Approved: Booking Awaiting Lawyer Confirmation - ${bookingNumber}`, template('Payment Approved', `
      <p>Dear ${clientName},</p>
      <p>Your payment for booking <strong>${bookingNumber}</strong> has been successfully verified and approved.</p>
      <p>The booking request has been forwarded to <strong>${lawyerName}</strong> for confirmation. You will receive an email once the lawyer approves or updates the booking.</p>
    `));
  },

  async sendBookingApprovedClient(email: string, clientName: string, bookingNumber: string, lawyerName: string, date: string, time: string) {
    await sendMailSafe(email, `Booking Confirmed: ${bookingNumber}`, template('Booking Confirmed', `
      <p>Dear ${clientName},</p>
      <p>Great news! <strong>${lawyerName}</strong> has approved your booking <strong>${bookingNumber}</strong>.</p>
      <p><strong>Scheduled Date:</strong> ${date}</p>
      <p><strong>Scheduled Time:</strong> ${time}</p>
      <p>Please log in to your dashboard to view meeting details or physical office location.</p>
    `));
  },

  async sendBookingRescheduledClient(email: string, clientName: string, bookingNumber: string, lawyerName: string, newDate: string, newTime: string, remarks: string) {
    await sendMailSafe(email, `Booking Reschedule Proposed - ${bookingNumber}`, template('Booking Reschedule Proposed', `
      <p>Dear ${clientName},</p>
      <p><strong>${lawyerName}</strong> has proposed a reschedule for booking <strong>${bookingNumber}</strong>.</p>
      <p><strong>Proposed New Date:</strong> ${newDate}</p>
      <p><strong>Proposed New Time:</strong> ${newTime}</p>
      <p><strong>Lawyer Remarks:</strong> ${remarks || 'No remarks provided.'}</p>
      <p>Please log in to your client dashboard to accept or decline this reschedule request.</p>
    `));
  },

  async sendBookingRejectedClient(email: string, clientName: string, bookingNumber: string, lawyerName: string, remarks: string) {
    await sendMailSafe(email, `Booking Rejected by Lawyer - ${bookingNumber}`, template('Booking Rejected', `
      <p>Dear ${clientName},</p>
      <p>We regret to inform you that <strong>${lawyerName}</strong> has rejected your booking <strong>${bookingNumber}</strong>.</p>
      <p><strong>Reason/Remarks:</strong> ${remarks || 'No remarks provided.'}</p>
      <p>A refund of the booking amount will be processed to your account. You can check the status of your refund in your dashboard.</p>
    `));
  }
};
