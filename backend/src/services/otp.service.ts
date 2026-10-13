import { Otp } from '../models/Otp.js';
import { User } from '../models/User.js';
import { AppError } from '../errors/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatusCodes.js';

export class OtpService {
  /**
   * Generate 6-digit OTP and print to terminal
   */
  static async createAndSendOtp(userId: string, email: string): Promise<string> {
    // Delete any existing OTPs for this user
    await Otp.deleteMany({ userId });

    // Generate random 6-digit code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.create({
      userId,
      otp: otpCode,
      expiresAt,
    });

    // Student-level logger: Print directly to VS Code terminal!
    console.log('\n==================================================');
    console.log(`[OTP Engine]: Verification Code for ${email}`);
    console.log(`[OTP Engine]: 👉 YOUR CODE IS: ${otpCode} 👈`);
    console.log('==================================================\n');

    return otpCode;
  }

  /**
   * Verify provided OTP
   */
  static async verifyOtp(email: string, otpInput: string): Promise<boolean> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const otpRecord = await Otp.findOne({ userId: user._id, otp: otpInput });
    if (!otpRecord) {
      throw new AppError('Invalid or expired OTP', HTTP_STATUS.BAD_REQUEST);
    }

    // Mark user as verified and remove used OTP
    user.isVerified = true;
    await user.save();
    await Otp.deleteOne({ _id: otpRecord._id });

    return true;
  }
}