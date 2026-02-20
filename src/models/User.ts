// src/models/User.ts
import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '../types';
import { env } from '../config/env';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  googleId?: string;
  profilePicture?: string;
  favorites: mongoose.Types.ObjectId[];
  // Token management
  tokenVersion: number;        // Incremented on password change / logout-all → invalidates all JWTs
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Methods
  comparePassword(candidate: string): Promise<boolean>;
  incrementTokenVersion(): Promise<void>;
  toSafeObject(): Record<string, unknown>;
}

export interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
      index: true,
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
    profilePicture: String,
    favorites: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    // ── Token Management ──────────────────────────────────────────────────────
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
      index: true,
    },
    resetPasswordExpiry: {
      type: Date,
      select: false,
    },
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.tokenVersion;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpiry;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Hooks ────────────────────────────────────────────────────────────────────

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();

  try {
    this.password = await bcrypt.hash(this.password, env.bcrypt.saltRounds);
    // Bump token version on password change to invalidate existing tokens
    if (!this.isNew) {
      this.tokenVersion = (this.tokenVersion || 0) + 1;
    }
    next();
  } catch (err) {
    next(err as Error);
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.incrementTokenVersion = async function (): Promise<void> {
  this.tokenVersion = (this.tokenVersion || 0) + 1;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.toSafeObject = function (): Record<string, unknown> {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    isVerified: this.isVerified,
    isActive: this.isActive,
    profilePicture: this.profilePicture,
    favorites: this.favorites,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// ─── Static Methods ───────────────────────────────────────────────────────────

userSchema.statics.findByEmail = function (email: string): Promise<IUser | null> {
  return this.findOne({ email: email.toLowerCase().trim() }).select(
    '+password +tokenVersion'
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
