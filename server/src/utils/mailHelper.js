const nodemailer = require('nodemailer');

let cachedTransporter = null;

/**
 * Obtain or initialize the Nodemailer transporter.
 * Uses SMTP settings from process.env if available,
 * otherwise falls back to Ethereal test account (with offline jsonTransport fallback).
 */
const getTransporter = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    return cachedTransporter;
  } catch (error) {
    console.warn('Ethereal test account unavailable, using fallback jsonTransport:', error.message);
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true
    });
    return cachedTransporter;
  }
};

/**
 * Send a payment reminder email.
 */
const sendReminderEmail = async ({
  to,
  customerName,
  shopName,
  amountPaise,
  customMessage,
  shopPhone
}) => {
  try {
    const transporter = await getTransporter();
    const formattedAmount = `₹${(amountPaise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    const subject = `Payment Reminder: Outstanding Dues of ${formattedAmount} at ${shopName}`;
    const messageBody =
      customMessage ||
      `Dear ${customerName}, this is a gentle reminder that your outstanding balance of ${formattedAmount} at ${shopName} is overdue. Kindly clear your dues at your earliest convenience.`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0d6efd; color: #ffffff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">UdhaarBook</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Neighbourhood Credit Ledger</p>
        </div>
        <div style="padding: 24px; color: #333333; line-height: 1.6;">
          <h2 style="color: #212529; font-size: 18px; margin-top: 0;">Payment Due Reminder</h2>
          <p>Dear <strong>${customerName}</strong>,</p>
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 15px; color: #856404;">
              ${messageBody}
            </p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 10px 0; color: #6c757d;">Store Name:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${shopName}</td>
            </tr>
            ${
              shopPhone
                ? `
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 10px 0; color: #6c757d;">Store Contact:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${shopPhone}</td>
            </tr>`
                : ''
            }
            <tr style="border-bottom: 2px solid #0d6efd;">
              <td style="padding: 12px 0; font-size: 16px; font-weight: bold; color: #0d6efd;">Current Overdue Amount:</td>
              <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: bold; color: #dc3545;">${formattedAmount}</td>
            </tr>
          </table>
          <p style="font-size: 13px; color: #6c757d; margin-top: 24px;">
            You can view your complete transaction history, download monthly statements, or verify entries anytime on UdhaarBook.
          </p>
        </div>
        <div style="background-color: #f8f9fa; border-top: 1px solid #dee2e6; padding: 15px; text-align: center; font-size: 12px; color: #6c757d;">
          Automated notification sent via UdhaarBook. Please do not reply directly to this email.
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"UdhaarBook" <notifications@udhaarbook.in>`,
      to,
      subject,
      text: `${messageBody}\n\nStore: ${shopName}\nOutstanding Amount: ${formattedAmount}\n${
        shopPhone ? `Phone: ${shopPhone}\n` : ''
      }`,
      html: htmlContent
    });

    let previewUrl = null;
    try {
      previewUrl = nodemailer.getTestMessageUrl(info) || null;
    } catch {
      previewUrl = null;
    }

    return {
      success: true,
      messageId: info.messageId || 'sent',
      previewUrl
    };
  } catch (error) {
    console.error('Failed to send reminder email:', error.message);
    return {
      success: false,
      error: error.message,
      previewUrl: null
    };
  }
};

module.exports = {
  getTransporter,
  sendReminderEmail
};

