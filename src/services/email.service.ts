import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Email Service
 * Uses Nodemailer with SMTP and Handlebars templates
 */
export class EmailService {
  private transporter: nodemailer.Transporter;
  private emailFrom: string;

  constructor() {
    this.emailFrom = process.env.EMAIL_FROM || 'noreply@paytag.com';

    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: parseInt(process.env.EMAIL_PORT || '587') === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      requireTLS: true,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Read and compile email template
   */
  private readTemplate(filePath: string): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return fs.readFileSync(path.join(__dirname, '..', 'emails', filePath), 'utf-8');
  }

  /**
   * Send email using template
   */
  private async sendEmail(
    to: string,
    subject: string,
    template: string,
    data: object
  ): Promise<void> {
    try {
      const layoutHtml = this.readTemplate('layouts/main.hbs');
      const templateHtml = this.readTemplate(`templates/${template}.hbs`);

      const bodyTemplate = handlebars.compile(templateHtml);
      const compiledBody = bodyTemplate(data);

      const layoutTemplate = handlebars.compile(layoutHtml);
      const finalHtml = layoutTemplate({
        subject,
        body: compiledBody,
        currentYear: new Date().getFullYear(),
      });

      const mailOptions = {
        from: `"PayTag" <${this.emailFrom}>`,
        to,
        subject,
        html: finalHtml,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email sent: %s', info.messageId);
    } catch (error) {
      console.error('❌ Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send OTP code via email
   */
  async sendOtpEmail(email: string, code: string): Promise<void> {
    console.log('📧 Sending OTP email to:', email);
    
    await this.sendEmail(
      email,
      'Your PayTag Login Code',
      'otp',
      { code }
    );
  }

  /**
   * Send welcome email after successful registration
   */
  async sendWelcomeEmail(email: string): Promise<void> {
    console.log('📧 Sending welcome email to:', email);
    
    await this.sendEmail(
      email,
      'Welcome to PayTag! 🎉',
      'welcome',
      { appUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3012' }
    );
  }
}
