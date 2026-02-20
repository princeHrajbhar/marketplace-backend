// src/controllers/productController.ts
import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/productService';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/apiResponse';

const productService = new ProductService();

export class ProductController {
  // ── GET /products?page=1&limit=10&search=phone ────────────────────────────

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
      const search = req.query.search as string | undefined;

      const result = await productService.getAll({ page, limit, search });

      res.status(200).json({
        success: true,
        message: 'Products fetched',
        data: result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ── GET /products/favorites ────────────────────────────────────────────────

  async getFavorites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const favorites = await productService.getFavorites(req.user!.userId);
      sendSuccess(res, 'Favorite products fetched', favorites);
    } catch (error) {
      next(error);
    }
  }

  // ── GET /products/:id ─────────────────────────────────────────────────────

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.getById(req.params.id);
      if (!product) {
        sendNotFound(res, 'Product not found');
        return;
      }
      sendSuccess(res, 'Product fetched', product);
    } catch (error) {
      next(error);
    }
  }

  // ── POST /products (admin) ─────────────────────────────────────────────────

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, price, description, image } = req.body;
      console.log('BODY:', req.body);
      const product = await productService.create(
        { title, price, description, image },
        req.user!.userId
      );
      sendCreated(res, 'Product created successfully', product);
    } catch (error) {
      next(error);
    }
  }

  // ── PUT /products/:id (admin) ──────────────────────────────────────────────

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, price, description, image } = req.body;
      const product = await productService.update(req.params.id, {
        ...(title !== undefined && { title }),
        ...(price !== undefined && { price }),
        ...(description !== undefined && { description }),
        ...(image !== undefined && { image }),
      });

      if (!product) {
        sendNotFound(res, 'Product not found');
        return;
      }
      sendSuccess(res, 'Product updated successfully', product);
    } catch (error) {
      next(error);
    }
  }

  // ── DELETE /products/:id (admin) ───────────────────────────────────────────

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await productService.delete(req.params.id);
      if (!deleted) {
        sendNotFound(res, 'Product not found');
        return;
      }
      sendSuccess(res, 'Product deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ── POST /products/:id/favorite ────────────────────────────────────────────

  async addFavorite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await productService.addFavorite(req.user!.userId, req.params.id);
      sendSuccess(res, 'Product added to favorites');
    } catch (error) {
      const msg = (error as Error).message;
      const code = msg.includes('not found') ? 404 : msg.includes('already') ? 409 : 400;
      sendError(res, msg, code);
    }
  }

  // ── DELETE /products/:id/favorite ──────────────────────────────────────────

  async removeFavorite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await productService.removeFavorite(req.user!.userId, req.params.id);
      sendSuccess(res, 'Product removed from favorites');
    } catch (error) {
      const msg = (error as Error).message;
      sendError(res, msg, msg.includes('not found') ? 404 : 400);
    }
  }
}
