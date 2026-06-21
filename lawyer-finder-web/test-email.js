require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER || 'testing_user',
    pass: process.env.SMTP_PASS || 'testing_password'
  }
});

const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || '"LawFinder SL" <noreply@lawfinder.lk>';

async function testMail() {
  console.log('Using SMTP Configuration:');
  console.log('Host:', process.env.SMTP_HOST || '(fallback) smtp.ethereal.email');
  console.log('Port:', process.env.SMTP_PORT || '(fallback) 587');
  console.log('User:', process.env.SMTP_USER || '(fallback) testing_user');
  console.log('Pass:', process.env.SMTP_PASS ? '********' : '(fallback) testing_password');
  console.log('From Email:', FROM_EMAIL);

  try {
    console.log('Verifying transporter connection...');
    await transporter.verify();
    console.log('Connection verified successfully! Sending a test email...');

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: process.env.SMTP_USER || 'test@example.com',
      subject: 'LawFinder SMTP Test Email',
      html: '<p>If you see this, your SMTP configuration is correct!</p>'
    });

    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    if (info.envelope) {
      console.log('Envelope:', info.envelope);
    }
  } catch (error) {
    console.error('SMTP testing failed with error:');
    console.error(error);
  }
}

testMail();
