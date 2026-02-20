// src/middlewares/roleMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import { sendUnauthorized, sendForbidden } from '../utils/apiResponse';

/**
 * Role-based access control middleware.
 * MUST be used AFTER the authenticate middleware.
 *
 * @example
 * router.post('/products', authenticate, authorize(UserRole.ADMIN), controller.create)
 * router.get('/admin/users', authenticate, authorize(UserRole.ADMIN), controller.list)
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'Authentication required');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendForbidden(
        res,
        `Access denied. This resource requires one of these roles: [${allowedRoles.join(', ')}]. Your role: ${req.user.role}`
      );
      return;
    }

    next();
  };
};

/**
 * Convenience shorthand for admin-only routes
 */
export const adminOnly = authorize(UserRole.ADMIN);
