import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import type { IUser } from '../models/User.js';
import type { RegisterInput, LoginInput } from '../validators/auth.validator.js';
import { AppError } from '../errors/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatusCodes.js';
import { envConfig } from '../config/env.config.js';

export class AuthService {
  /**
   * Register a new user
   */
  static async registerUser(input: RegisterInput): Promise<{ user: Partial<IUser>; token: string }> {
    const existingUser = await User.findOne({ email: input.email });
    if (existingUser) {
      throw new AppError('User with this email already exists', HTTP_STATUS.CONFLICT);
    }

    const user = await User.create(input);
    const token = this.generateToken(user._id.toString());

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };

    return { user: userResponse, token };
  }

  /**
   * Authenticate existing user
   */
  static async loginUser(input: LoginInput): Promise<{ user: Partial<IUser>; token: string }> {
    // Explicitly select password field since it's hidden by default in schema
    const user = await User.findOne({ email: input.email }).select('+password');
    if (!user) {
      throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
    }

    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
    }

    const token = this.generateToken(user._id.toString());

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };

    return { user: userResponse, token };
  }

  /**
   * Fetch authenticated user details
   */
  static async getCurrentUser(userId: string): Promise<Partial<IUser>> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  /**
   * Helper to sign JWT Tokens
   */
  private static generateToken(userId: string): string {
    return jwt.sign({ userId }, envConfig.jwtSecret, { expiresIn: '7d' });
  }
}