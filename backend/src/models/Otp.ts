import { Schema, model, Document, Types } from 'mongoose';

export interface IOtp extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  otp: string;
  createdAt: Date;
  expiresAt: Date;
}

const otpSchema = new Schema<IOtp>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // Automatically deletes from MongoDB after 10 mins
  },
});

export const Otp = model<IOtp>('Otp', otpSchema);