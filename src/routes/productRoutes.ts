// src/routes/productRoutes.ts
import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { authenticate } from '../middlewares/authMiddleware';
import { authorize } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import {
  createProductValidation,
  updateProductValidation,
  mongoIdParamValidation,
  paginationQueryValidation,
} from '../middlewares/validate';
import { UserRole } from '../types';

const router = Router();
const ctrl = new ProductController();

// ─── Public Routes ─────────────────────────────────────────────────────────────

/**
 * @route   GET /products
 * @desc    Get all active products with search and pagination.
 * @access  Public
 * @query   page, limit, search
 */
router.get(
  '/',
  validate(paginationQueryValidation),
  ctrl.getAll.bind(ctrl)
);

/**
 * @route   GET /products/:id
 * @desc    Get single product by ID.
 * @access  Public
 */
router.get(
  '/:id',
  validate(mongoIdParamValidation),
  ctrl.getById.bind(ctrl)
);

// ─── Protected (any authenticated user) ────────────────────────────────────────

/**
 * @route   GET /products/user/favorites
 * @desc    Get current user's favorite products.
 * @access  Private
 */
router.get('/user/favorites', authenticate, ctrl.getFavorites.bind(ctrl));

/**
 * @route   POST /products/:id/favorite
 * @desc    Add product to favorites.
 * @access  Private (user)
 */
router.post(
  '/:id/favorite',
  authenticate,
  validate(mongoIdParamValidation),
  ctrl.addFavorite.bind(ctrl)
);

/**
 * @route   DELETE /products/:id/favorite
 * @desc    Remove product from favorites.
 * @access  Private (user)
 */
router.delete(
  '/:id/favorite',
  authenticate,
  validate(mongoIdParamValidation),
  ctrl.removeFavorite.bind(ctrl)
);

// ─── Admin Only Routes ──────────────────────────────────────────────────────────

/**
 * @route   POST /products
 * @desc    Create a new product.
 * @access  Private (admin only)
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  validate(createProductValidation),
  ctrl.create.bind(ctrl)
);

/**
 * @route   PUT /products/:id
 * @desc    Update an existing product.
 * @access  Private (admin only)
 */
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validate([...mongoIdParamValidation, ...updateProductValidation]),
  ctrl.update.bind(ctrl)
);

/**
 * @route   DELETE /products/:id
 * @desc    Soft-delete a product.
 * @access  Private (admin only)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validate(mongoIdParamValidation),
  ctrl.delete.bind(ctrl)
);

export default router;
