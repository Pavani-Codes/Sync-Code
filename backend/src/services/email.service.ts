export const sendOTPEmail = async (
  toEmail: string,
  otp: string,
  subject: string = 'SyncCode - Verification Code'
): Promise<void> => {
  console.log(`\n======================================================`);
  console.log(`[DEV OTP LOG]`);
  console.log(`To: ${toEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`OTP Code: ---> ${otp} <---`);
  console.log(`======================================================\n`);
};