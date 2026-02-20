// src/models/Product.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  price: number;
  description: string;
  image: string;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    image: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
   toJSON: {
  transform: (_doc, ret) => {
    const { __v, ...rest } = ret;
    return rest;
  },
},
  }
);

// Compound text index for search
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);
