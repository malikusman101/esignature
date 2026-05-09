const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const emailTemplates = {
  welcome: (name, verifyUrl) => ({
    subject: `Welcome to ${process.env.APP_NAME || 'eSign'}! Verify your email`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px; letter-spacing: -0.5px;">✍️ eSign</h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="color: #1a1a2e; font-size: 22px;">Welcome, ${name}!</h2>
          <p style="color: #555; line-height: 1.6;">Your account has been created. Please verify your email address to get started.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="background: #1a1a2e; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Verify Email Address</a>
          </div>
          <p style="color: #999; font-size: 13px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  }),

  signRequest: (signerName, senderName, documentTitle, signUrl, message) => ({
    subject: `${senderName} has requested your signature on "${documentTitle}"`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">✍️ eSign</h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="color: #1a1a2e;">Signature Request</h2>
          <p style="color: #555; line-height: 1.6;">Hello <strong>${signerName}</strong>,</p>
          <p style="color: #555; line-height: 1.6;"><strong>${senderName}</strong> has requested your electronic signature on:</p>
          <div style="background: #f8f9ff; border-left: 4px solid #1a1a2e; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #1a1a2e; font-weight: 600; font-size: 16px;">📄 ${documentTitle}</p>
          </div>
          ${message ? `<p style="color: #555; font-style: italic; background: #f9f9f9; padding: 12px 16px; border-radius: 8px;">"${message}"</p>` : ''}
          <div style="text-align: center; margin: 32px 0;">
            <a href="${signUrl}" style="background: #1a1a2e; color: #fff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">Review & Sign Document</a>
          </div>
          <p style="color: #999; font-size: 13px;">This is a legally binding electronic signature request. Your signature carries the same legal weight as a handwritten signature.</p>
        </div>
        <div style="background: #f8f8f8; padding: 20px 40px; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 12px; margin: 0;">Powered by eSign Platform • Secure & Legal Electronic Signatures</p>
        </div>
      </div>
    `,
  }),

  documentCompleted: (ownerName, documentTitle, downloadUrl) => ({
    subject: `✅ All parties have signed "${documentTitle}"`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">✍️ eSign</h1>
        </div>
        <div style="padding: 40px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">✅</span>
          </div>
          <h2 style="color: #1a1a2e; text-align: center;">Document Completed!</h2>
          <p style="color: #555; line-height: 1.6;">Hello <strong>${ownerName}</strong>,</p>
          <p style="color: #555; line-height: 1.6;">All parties have signed <strong>"${documentTitle}"</strong>. The completed document is now available for download.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${downloadUrl}" style="background: #22c55e; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Download Signed Document</a>
          </div>
        </div>
      </div>
    `,
  }),

  signedConfirmation: (signerName, documentTitle) => ({
    subject: `You have signed "${documentTitle}"`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">✍️ eSign</h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="color: #1a1a2e;">Signing Confirmed</h2>
          <p style="color: #555; line-height: 1.6;">Hello <strong>${signerName}</strong>,</p>
          <p style="color: #555; line-height: 1.6;">You have successfully signed <strong>"${documentTitle}"</strong>. A copy will be sent to you once all parties have completed signing.</p>
        </div>
      </div>
    `,
  }),

  resetPassword: (name, resetUrl) => ({
    subject: 'Reset your eSign password',
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">✍️ eSign</h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="color: #1a1a2e;">Password Reset</h2>
          <p style="color: #555; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
          <p style="color: #555; line-height: 1.6;">You requested to reset your password. Click the button below to create a new password.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="background: #ef4444; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #999; font-size: 13px;">This link expires in 1 hour. If you didn't request this, please ignore this email and your password will remain unchanged.</p>
        </div>
      </div>
    `,
  }),

  reminder: (signerName, senderName, documentTitle, signUrl) => ({
    subject: `Reminder: Please sign "${documentTitle}"`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">✍️ eSign</h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="color: #1a1a2e;">⏰ Signing Reminder</h2>
          <p style="color: #555; line-height: 1.6;">Hello <strong>${signerName}</strong>,</p>
          <p style="color: #555; line-height: 1.6;">This is a friendly reminder that <strong>${senderName}</strong> is waiting for your signature on <strong>"${documentTitle}"</strong>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${signUrl}" style="background: #f59e0b; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Sign Now</a>
          </div>
        </div>
      </div>
    `,
  }),
};

const sendEmail = async ({ to, template, data }) => {
  const transporter = createTransporter();
  const { subject, html } = emailTemplates[template](...data);

  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'eSign'}" <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    html,
  });
};

module.exports = { sendEmail, emailTemplates };