import nodemailer from 'nodemailer';
import { envConfig } from '../config/env.config.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS, // Your App Password generated in Google Account
  },
});

export const sendOtpEmail = async (toEmail: string, name: string, otp: string): Promise<void> => {
  const mailOptions = {
    from: `"SyncCode" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Verification Code - SyncCode',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #4F46E5; text-align: center;">SyncCode Verification</h2>
        <p>Hi <b>${name}</b>,</p>
        <p>Thank you for signing up for SyncCode. Please use the verification code below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; background: #EEF2FF; padding: 10px 25px; border-radius: 8px;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};