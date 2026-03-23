import nodemailer from 'nodemailer';

// In production, configure exact SMTP (e.g., Resend, SendGrid, Amazon SES) via ENV vars.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER || 'testing_user',
    pass: process.env.SMTP_PASS || 'testing_password'
  }
});

export const EmailService = {
  
  async sendApplicationSubmitted(email: string, fullName: string) {
    console.log(`[EMAIL SIMULATION] Triggering 'Application Submitted' to ${email} for ${fullName}`);
    // await transporter.sendMail({
    //   from: '"LawFinder SL" <noreply@lawfinder.lk>',
    //   to: email,
    //   subject: 'Lawyer Application Received - LawFinder SL',
    //   html: `<p>Dear ${fullName},</p><p>We have successfully received your application. Our legal team will review your BASL credentials shortly.</p>`
    // });
  },

  async sendApplicationApproved(email: string, fullName: string) {
    console.log(`[EMAIL SIMULATION] Triggering 'Application Approved' to ${email}`);
    // await transporter.sendMail({
    // ....
    // });
  },
  
  async sendApplicationRejected(email: string, fullName: string, reason: string) {
    console.log(`[EMAIL SIMULATION] Triggering 'Application Rejected' to ${email}`);
  }
};
