// src/services/emailService.ts
import { getTransporter } from '../config/nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const BRAND = 'Marketplace';
const YEAR = new Date().getFullYear();

const baseLayout = (content: string, headerColor: string, headerTitle: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${headerTitle} — ${BRAND}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);">
        <!-- HEADER -->
        <tr>
          <td style="background:${headerColor};padding:40px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🛍️</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.5px;">${headerTitle}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${BRAND}</p>
          </td>
        </tr>
        <!-- BODY -->
        <tr>
          <td style="padding:40px 32px;">
            ${content}
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 32px;text-align:center;border-top:1px solid #e9ecef;">
            <p style="margin:0;color:#adb5bd;font-size:12px;">© ${YEAR} ${BRAND}. All rights reserved.</p>
            <p style="margin:6px 0 0;color:#adb5bd;font-size:11px;">This is an automated message — please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const paragraph = (text: string) =>
  `<p style="margin:0 0 16px;color:#374151;line-height:1.7;font-size:15px;">${text}</p>`;

const otpBox = (otp: string, expiresMinutes: number) => `
<div style="background:#f5f3ff;border:2px dashed #8b5cf6;border-radius:12px;padding:28px 24px;text-align:center;margin:24px 0;">
  <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your One-Time Password</p>
  <p style="margin:0;font-size:48px;font-weight:800;letter-spacing:14px;color:#6366f1;font-family:'Courier New',monospace;">${otp}</p>
  <p style="margin:12px 0 0;color:#9ca3af;font-size:13px;">⏱ Valid for <strong>${expiresMinutes} minutes</strong> · Do not share this code</p>
</div>`;

const ctaButton = (href: string, label: string, color = '#6366f1') => `
<div style="text-align:center;margin:28px 0;">
  <a href="${href}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:-.2px;">${label}</a>
</div>`;

const alertBox = (text: string) => `
<div style="background:#fff3cd;border-left:4px solid #ffc107;border-radius:6px;padding:14px 16px;margin:20px 0;">
  <p style="margin:0;color:#856404;font-size:13px;">⚠️ ${text}</p>
</div>`;

// ─── Email Service ─────────────────────────────────────────────────────────────

export class EmailService {
  private async send(to: string, subject: string, html: string): Promise<void> {
    await getTransporter().sendMail({
      from: `"${BRAND}" <${env.email.from}>`,
      to,
      subject,
      html,
    });
  }

  // ── OTP Email ────────────────────────────────────────────────────────────────

  async sendOtpEmail(to: string, otp: string, name: string): Promise<void> {
    const html = baseLayout(
      `
      ${paragraph(`Hi <strong>${name}</strong>,`)}
      ${paragraph(`You requested to verify your email address. Enter the OTP below in the app:`)}
      ${otpBox(otp, env.otp.expiresMinutes)}
      ${alertBox("Never share your OTP with anyone. Our team will never ask for it.")}
      ${paragraph(`If you didn't create an account, please ignore this email.`)}
      `,
      'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)',
      '📧 Verify Your Email'
    );
    await this.send(to, `Verify Your Email — ${BRAND}`, html);
    logger.info(`OTP email sent → ${to}`);
  }

  // ── Forgot Password Email ─────────────────────────────────────────────────────

  async sendForgotPasswordEmail(to: string, resetLink: string, name: string): Promise<void> {
    const html = baseLayout(
      `
      ${paragraph(`Hi <strong>${name}</strong>,`)}
      ${paragraph(`We received a request to reset your password. Click the button below to proceed:`)}
      ${ctaButton(resetLink, 'Reset My Password', '#ef4444')}
      ${alertBox('This link expires in <strong>1 hour</strong>. If you did not request a password reset, ignore this email — your password will not change.')}
      ${paragraph(`Or copy this link into your browser:`)}
      <p style="word-break:break-all;font-size:12px;color:#9ca3af;background:#f9fafb;padding:12px;border-radius:6px;">${resetLink}</p>
      `,
      'linear-gradient(135deg,#ef4444 0%,#f97316 100%)',
      '🔑 Reset Your Password'
    );
    await this.send(to, `Reset Your Password — ${BRAND}`, html);
    logger.info(`Password reset email sent → ${to}`);
  }

  // ── Welcome Email ─────────────────────────────────────────────────────────────

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const html = baseLayout(
      `
      ${paragraph(`Hi <strong>${name}</strong>, welcome aboard! 🎉`)}
      ${paragraph(`Your account has been verified successfully. You can now log in and start exploring the marketplace.`)}
      ${paragraph(`Here's what you can do:`)}
      <ul style="color:#374151;line-height:2;font-size:15px;padding-left:20px;">
        <li>Browse thousands of products</li>
        <li>Search and filter by category</li>
        <li>Save your favorites</li>
        <li>Manage your profile</li>
      </ul>
      `,
      'linear-gradient(135deg,#10b981 0%,#059669 100%)',
      '🎉 Welcome to Marketplace!'
    );
    await this.send(to, `Welcome to ${BRAND}!`, html);
    logger.info(`Welcome email sent → ${to}`);
  }

  // ── Password Changed Confirmation ─────────────────────────────────────────────

  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    const html = baseLayout(
      `
      ${paragraph(`Hi <strong>${name}</strong>,`)}
      ${paragraph(`Your password was successfully changed. If you made this change, no further action is needed.`)}
      ${alertBox('If you did NOT change your password, contact support immediately and secure your account.')}
      `,
      'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
      '🔒 Password Changed'
    );
    await this.send(to, `Password Changed — ${BRAND}`, html);
    logger.info(`Password changed email sent → ${to}`);
  }
}
