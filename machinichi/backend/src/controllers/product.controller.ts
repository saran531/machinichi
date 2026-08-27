import { Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Review } from '../models/Review';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../services/apiResponse';
import { createProductSchema, updateProductSchema, productQuerySchema } from '../validators';
import { Types } from 'mongoose';

export const getProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = productQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return sendError(res, 'Validation failed', 400, validation.error.issues);
    }

    const { page, limit, sort, order, search, category, minPrice, maxPrice, isFeatured, tags, inStock } = validation.data;
    // STEP 5 gate: only Published products are ever shown to shoppers.
    // Draft/Unlisted/Archived products must never appear here.
    const filter: any = { isDeleted: false, publishStatus: 'published' };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      filter.category = new Types.ObjectId(category);
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.sellingPrice = {};
      if (minPrice !== undefined) filter.sellingPrice.$gte = minPrice;
      if (maxPrice !== undefined) filter.sellingPrice.$lte = maxPrice;
    }

    if (isFeatured !== undefined) filter.isFeatured = isFeatured;
    if (tags) filter.tags = { $in: tags.split(',').map(t => t.trim()) };

    if (inStock) {
      filter.$or = [
        { quantity: { $gt: 0 } },
        { 'variants.quantity': { $gt: 0 } },
      ];
    }

    const sortOption: any = {};
    if (sort) {
      sortOption[sort] = order === 'asc' ? 1 : -1;
    } else {
      sortOption.createdAt = -1;
    }

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select('-nutritionalInfo -seo -deletedAt')
        .populate('category', 'name slug'),
      Product.countDocuments(filter),
    ]);

    sendPaginated(res, products, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const product = await Product.findOne({ slug, isDeleted: false, publishStatus: 'published' })
      .populate('category', 'name slug')
      .populate('createdBy', 'name');

    if (!product) return sendError(res, 'Product not found', 404);

    const reviews = await Review.find({ productId: product._id, isApproved: true })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(10);

    sendSuccess(res, { data: { ...product.toObject(), reviews } });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false, publishStatus: 'published' })
      .populate('category', 'name slug');
    if (!product) return sendError(res, 'Product not found', 404);
    sendSuccess(res, { data: product });
  } catch (error) {
    next(error);
  }
};

export const getFeaturedProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const products = await Product.find({ isFeatured: true, isDeleted: false, publishStatus: 'published' })
      .select('-seo')
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(12);
    sendSuccess(res, { data: products });
  } catch (error) {
    next(error);
  }
};

export const searchProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return sendError(res, 'Search query is required', 400);
    }

    const products = await Product.find({
      isDeleted: false,
      publishStatus: 'published',
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { hsnCode: { $regex: q, $options: 'i' } },
        { 'variants.sku': { $regex: q, $options: 'i' } },
      ],
    })
      .select('name slug images sellingPrice mrpPrice quantity variants')
      .limit(20);

    sendSuccess(res, { data: products });
  } catch (error) {
    next(error);
  }
};

export const getSuggestions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.length < 1) {
      return sendSuccess(res, { data: [] });
    }

    const products = await Product.find({
      isDeleted: false,
      publishStatus: 'published',
      name: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' },
    })
      .select('name')
      .limit(10)
      .lean();

    const suggestions = products.map((p) => p.name);
    sendSuccess(res, { data: suggestions });
  } catch (error) {
    next(error);
  }
};

export const getRelatedProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(res, 'Product not found', 404);

    const related = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isDeleted: false,
      publishStatus: 'published',
    })
      .select('name slug images sellingPrice mrpPrice quantity')
      .limit(8);

    sendSuccess(res, { data: related });
  } catch (error) {
    next(error);
  }
};
