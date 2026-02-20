// src/services/productService.ts
import mongoose from 'mongoose';
import { Product, IProduct } from '../models/Product';
import { User } from '../models/User';
import { PaginatedResult, PaginationMeta } from '../types';

export interface CreateProductInput {
  title: string;
  price: number;
  description: string;
  image: string;
}

export interface GetProductsQuery {
  page: number;
  limit: number;
  search?: string;
}

export class ProductService {
  // ── Create ────────────────────────────────────────────────────────────────────

  async create(input: CreateProductInput, adminId: string): Promise<IProduct> {
    return Product.create({ ...input, createdBy: adminId });
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  async update(
    productId: string,
    input: Partial<CreateProductInput>
  ): Promise<IProduct | null> {
    return Product.findOneAndUpdate(
      { _id: productId, isActive: true },
      { $set: input },
      { new: true, runValidators: true }
    );
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async delete(productId: string): Promise<boolean> {
    // Soft delete — keeps data for auditing
    const result = await Product.findOneAndUpdate(
      { _id: productId, isActive: true },
      { $set: { isActive: false } }
    );
    return !!result;
  }

  // ── Get All with Search + Pagination ──────────────────────────────────────────

  async getAll(query: GetProductsQuery): Promise<PaginatedResult<IProduct>> {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const filter: mongoose.FilterQuery<IProduct> = { isActive: true };

    if (search?.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return { items: items as IProduct[], meta };
  }

  // ── Get By ID ─────────────────────────────────────────────────────────────────

  async getById(productId: string): Promise<IProduct | null> {
    if (!mongoose.isValidObjectId(productId)) return null;
    return Product.findOne({ _id: productId, isActive: true });
  }

  // ── Add Favorite ──────────────────────────────────────────────────────────────

  async addFavorite(userId: string, productId: string): Promise<void> {
    if (!mongoose.isValidObjectId(productId)) {
      throw new Error('Invalid product ID');
    }

    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) throw new Error('Product not found');

    const pid = new mongoose.Types.ObjectId(productId);
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.favorites.some((f) => f.equals(pid))) {
      throw new Error('Product is already in your favorites');
    }

    await User.findByIdAndUpdate(userId, { $addToSet: { favorites: pid } });
  }

  // ── Remove Favorite ───────────────────────────────────────────────────────────

  async removeFavorite(userId: string, productId: string): Promise<void> {
    if (!mongoose.isValidObjectId(productId)) {
      throw new Error('Invalid product ID');
    }

    const pid = new mongoose.Types.ObjectId(productId);
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (!user.favorites.some((f) => f.equals(pid))) {
      throw new Error('Product is not in your favorites');
    }

    await User.findByIdAndUpdate(userId, { $pull: { favorites: pid } });
  }

  // ── Get User Favorites ────────────────────────────────────────────────────────

  async getFavorites(userId: string): Promise<IProduct[]> {
    const user = await User.findById(userId).populate({
      path: 'favorites',
      match: { isActive: true },
    });
    if (!user) throw new Error('User not found');
    return user.favorites as unknown as IProduct[];
  }
}
