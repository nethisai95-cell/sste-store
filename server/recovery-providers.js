import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST?.trim() || '';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER?.trim() || '';
const smtpPassword = process.env.SMTP_PASSWORD || '';
const emailFrom = process.env.RECOVERY_EMAIL_FROM?.trim() || '';
const providerTimeoutMs = 10000;

export const recoveryProviderOptions = {
  emailEnabled: Boolean(
    smtpHost && Number.isInteger(smtpPort) && smtpPort > 0 && smtpPort <= 65535 &&
    smtpUser && smtpPassword && emailFrom,
  ),
};

export async function sendRecoveryEmail({ to, code, accountType }) {
  if (!recoveryProviderOptions.emailEnabled) throw new Error('SMTP recovery email is not configured.');
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: smtpUser, pass: smtpPassword },
    connectionTimeout: providerTimeoutMs,
    greetingTimeout: providerTimeoutMs,
    socketTimeout: providerTimeoutMs,
  });
  await transporter.sendMail({
    from: emailFrom,
    to,
    subject: 'Your SSTE Studio password reset code',
    text: [
      `Your SSTE Studio ${accountType} account password reset code is ${code}.`,
      '',
      'This code expires in 15 minutes and can be used only once.',
      'If you did not request a reset, you can ignore this email.',
    ].join('\n'),
  });
}
