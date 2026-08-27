import { Response, NextFunction } from 'express';
import { Wishlist } from '../models/Wishlist';
import { Product } from '../models/Product';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../services/apiResponse';
import { addToWishlistSchema, removeFromWishlistSchema } from '../validators';
import { Types } from 'mongoose';

export const getWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      return sendError(res, 'Authentication required', 401);
    }

    let wishlist = await Wishlist.findOne({ userId: new Types.ObjectId(req.user.userId) })
      .populate({
        path: 'products',
        select: 'name slug images sellingPrice mrp quantity variants isActive',
      });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId: new Types.ObjectId(req.user.userId),
        products: [],
      });
    }

    sendSuccess(res, { data: wishlist });
  } catch (error) {
    next(error);
  }
};

export const addToWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const validation = addToWishlistSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Validation failed', 400, validation.error.issues);
    }

    const { productId } = validation.data;

    const product = await Product.findById(productId);
    if (!product || !product.isActive || product.isDeleted) {
      return sendError(res, 'Product not found or inactive', 404);
    }

    const userId = new Types.ObjectId(req.user.userId);
    const prodObjId = new Types.ObjectId(productId);

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, products: [{ productId: prodObjId, addedAt: new Date() }] });
    } else {
      if ((wishlist.products as any).some((p: any) => (p.productId?.toString() || p.toString()) === productId)) {
        return sendError(res, 'Product already in wishlist', 400);
      }
      (wishlist.products as any).push({ productId: prodObjId, addedAt: new Date() });
      await wishlist.save();
    }

    await wishlist.populate({
      path: 'products',
      select: 'name slug images sellingPrice mrp quantity variants isActive',
    });

    sendSuccess(res, { data: wishlist, message: 'Added to wishlist' });
  } catch (error) {
    next(error);
  }
};

export const removeFromWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { productId } = req.params;
    const userId = new Types.ObjectId(req.user.userId);

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) return sendError(res, 'Wishlist not found', 404);

    wishlist.products = (wishlist.products as any).filter((p: any) => (p.productId?.toString() || p.toString()) !== productId);
    await wishlist.save();

    await wishlist.populate({
      path: 'products',
      select: 'name slug images sellingPrice mrp quantity variants isActive',
    });

    sendSuccess(res, { data: wishlist, message: 'Removed from wishlist' });
  } catch (error) {
    next(error);
  }
};

export const checkWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      return sendSuccess(res, { inWishlist: false });
    }

    const productId = String(req.params.productId);
    const wishlist = await Wishlist.findOne({
      userId: new Types.ObjectId(req.user.userId),
      'products.productId': new Types.ObjectId(productId),
    } as any);

    sendSuccess(res, { inWishlist: !!wishlist });
  } catch (error) {
    next(error);
  }
};
