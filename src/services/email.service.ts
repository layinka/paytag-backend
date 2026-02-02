/**
 * Email Service (Mock Implementation)
 * In production, integrate with SendGrid, AWS SES, etc.
 */
export class EmailService {
  /**
   * Send OTP code via email
   * Currently logs to console for MVP
   */
  async sendOtpEmail(email: string, code: string): Promise<void> {
    console.log('');
    console.log('📧 ═══════════════════════════════════════');
    console.log('   EMAIL: OTP Code');
    console.log('   To:', email);
    console.log('   Code:', code);
    console.log('   Expires in: 10 minutes');
    console.log('═══════════════════════════════════════');
    console.log('');

    // TODO: Integrate with email service
    // await sendgrid.send({
    //   to: email,
    //   subject: 'Your PayTag Login Code',
    //   text: `Your verification code is: ${code}`,
    // });
  }

  /**
   * Send welcome email after successful registration
   */
  async sendWelcomeEmail(email: string): Promise<void> {
    console.log('');
    console.log('📧 ═══════════════════════════════════════');
    console.log('   EMAIL: Welcome to PayTag');
    console.log('   To:', email);
    console.log('═══════════════════════════════════════');
    console.log('');
  }
}
