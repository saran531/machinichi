import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(1000).optional().default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ─── Category ────────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(50),
  description: z.string().max(500).optional(),
  image: z.string().optional(),
  parentCategory: objectIdSchema.optional(),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.number().int().nonnegative().optional(),
  seo: z.object({
    metaTitle: z.string().max(70).optional(),
    metaDescription: z.string().max(160).optional(),
  }).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// ─── Product ────────────────────────────────────────────────
const variantSchema = z.object({
  size: z.string().min(1).optional(),
  color: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  batchNumber: z.string().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  costPrice: z.number().nonnegative().optional().default(0),
  mrpPrice: z.number().positive(),
  sellingPrice: z.number().positive(),
  quantity: z.number().int().nonnegative().optional().default(0),
  isAvailable: z.boolean().optional().default(true),
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().optional(),
  })).optional(),
});

const productSeoSchema = z.object({
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  metaKeywords: z.array(z.string()).optional(),
}).optional();

const warrantySchema = z.object({
  period: z.string().optional(),
  description: z.string().optional(),
}).optional();

const returnPolicySchema = z.object({
  isReturnable: z.boolean().optional().default(true),
  returnPeriodDays: z.number().int().positive().optional().default(7),
  returnCondition: z.string().optional(),
}).optional();

// Step 1: catalog/product-info creation only. Never accepts publishStatus —
// new products always start 'unlisted' until explicitly added to the store.
export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200),
  slug: z.string().min(2).max(250).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  sku: z.string().min(1).max(50),
  hsnCode: z.string().min(1),
  brand: z.string().min(1).max(100),
  description: z.string().min(10).max(5000),
  shortDescription: z.string().max(300).optional(),
  category: objectIdSchema,
  costPrice: z.number().nonnegative().optional().default(0),
  mrpPrice: z.number().positive(),
  sellingPrice: z.number().positive(),
  comparePrice: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    height: z.number().positive().optional(),
    width: z.number().positive().optional(),
    length: z.number().positive().optional(),
  }).optional(),
  gstRate: z.number().min(0).max(100).optional().default(5),
  gstCategory: z.string().optional(),
  unitType: z.string().optional().default('Kilogram'),
  availableSizes: z.array(z.string()).optional(),
  variants: z.array(variantSchema).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  warranty: warrantySchema,
  returnPolicy: returnPolicySchema,
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    isPrimary: z.boolean().optional().default(false),
    order: z.number().int().nonnegative().optional().default(0),
  })).min(1, 'At least one image is required'),
  videos: z.array(z.object({
    url: z.string().url(),
    title: z.string().optional(),
  })).optional(),
  tags: z.array(z.string().max(30)).optional(),
  seo: productSeoSchema,
  isFeatured: z.boolean().optional().default(false),
  // Inventory may be seeded at creation, but stays independent of listing/publishing.
  quantity: z.number().int().nonnegative().optional().default(0),
  warehouseStock: z.number().int().nonnegative().optional().default(0),
  minStock: z.number().int().nonnegative().optional().default(5),
  maxStock: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional().default(10),
  barcode: z.string().optional(),
  batchNumber: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  publishStatus: z.enum(['unlisted', 'published', 'archived']).optional(),
  tags: z.string().optional(),
  inStock: z.coerce.boolean().optional(),
});

// ─── Inventory (Step 2 — completely separate from listing) ──────────────
export const inventoryAdjustSchema = z.object({
  variantSku: z.string().optional(), // omit to adjust the base product
  quantity: z.number().int().nonnegative().optional(),
  warehouseStock: z.number().int().nonnegative().optional(),
  reservedQuantity: z.number().int().nonnegative().optional(),
  minStock: z.number().int().nonnegative().optional(),
  maxStock: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  barcode: z.string().optional(),
  batchNumber: z.string().optional(),
  note: z.string().max(300).optional(),
}).refine(
  d => d.quantity !== undefined || d.warehouseStock !== undefined || d.reservedQuantity !== undefined ||
       d.minStock !== undefined || d.maxStock !== undefined || d.lowStockThreshold !== undefined ||
       d.barcode !== undefined || d.batchNumber !== undefined,
  { message: 'At least one inventory field must be provided' },
);

// ─── Listing (Step 3 & 5 — explicit "Add Product to Store" / publish) ───
const marketplaceLinksSchema = z.object({
  amazon: z.string().url().optional().or(z.literal('')),
  flipkart: z.string().url().optional().or(z.literal('')),
  meesho: z.string().url().optional().or(z.literal('')),
  myntra: z.string().url().optional().or(z.literal('')),
  ajio: z.string().url().optional().or(z.literal('')),
  snapdeal: z.string().url().optional().or(z.literal('')),
  jiomart: z.string().url().optional().or(z.literal('')),
  ownWebsite: z.string().url().optional().or(z.literal('')),
}).optional();

export const listProductSchema = z.object({
  marketplaceLinks: marketplaceLinksSchema,
});

export const unlistProductSchema = z.object({
  status: z.enum(['unlisted', 'archived']).default('unlisted'),
  reason: z.string().max(300).optional(),
});

export const updateListingSchema = z.object({
  marketplaceLinks: marketplaceLinksSchema,
});

// ─── Cart ────────────────────────────────────────────────
const cartItemSchema = z.object({
  productId: objectIdSchema,
  variantSize: z.string().optional(),
  quantity: z.number().int().positive().min(1).max(99),
});

export const addToCartSchema = z.object({
  productId: objectIdSchema,
  variantSize: z.string().optional(),
  quantity: z.number().int().positive().min(1).max(99),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().min(1).max(99),
});

export const removeCartItemSchema = z.object({
  productId: objectIdSchema,
  variantSize: z.string().optional(),
});

export const clearCartSchema = z.object({
  sessionId: z.string().optional(),
});

export const mergeCartSchema = z.object({
  sessionId: z.string(),
});

// ─── Wishlist ────────────────────────────────────────────────
export const addToWishlistSchema = z.object({
  productId: objectIdSchema,
});

export const removeFromWishlistSchema = z.object({
  productId: objectIdSchema,
});

// ─── Saved For Later ─────────────────────────────────────────
export const saveForLaterSchema = z.object({
  productId: objectIdSchema,
  variantSize: z.string().optional(),
  quantity: z.number().int().positive().optional().default(1),
});

export const moveToCartSchema = z.object({
  productId: objectIdSchema,
  variantSize: z.string().optional(),
  quantity: z.number().int().positive().optional(),
});

// ─── Order ────────────────────────────────────────────────
const addressDetailSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
  addressLine1: z.string().min(5).max(200),
  addressLine2: z.string().max(200).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode'),
  country: z.string().optional().default('India'),
  addressType: z.enum(['home', 'work', 'other']).optional(),
});

const orderItemSchema = z.object({
  productId: objectIdSchema,
  name: z.string(),
  image: z.string().url(),
  variantSize: z.string().optional(),
  quantity: z.number().int().positive(),
  mrp: z.number().positive(),
  sellingPrice: z.number().positive(),
  gstRate: z.number().optional().default(5),
});

const couponApplySchema = z.object({
  code: z.string().optional(),
  discountAmount: z.number().nonnegative().optional().default(0),
  couponId: objectIdSchema.optional(),
}).optional();

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  shippingAddress: addressDetailSchema,
  billingAddress: addressDetailSchema.optional(),
  paymentMethod: z.enum(['razorpay', 'cod']),
  coupon: couponApplySchema,
  notes: z.string().max(500).optional(),
  isIntraState: z.boolean().optional().default(true),
  shippingCharges: z.number().nonnegative().optional().default(0),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(['pending_approval', 'accepted', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned']),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  courierName: z.string().optional(),
  packageWeight: z.number().optional(),
});

export const delayOrderSchema = z.object({
  reason: z.string().min(1, 'Delay reason is required'),
  expectedDate: z.string().min(1, 'Expected delivery date is required'),
  customerNote: z.string().optional(),
});

export const orderHistoryQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

// ─── Payment ────────────────────────────────────────────────
export const createPaymentOrderSchema = z.object({
  orderId: objectIdSchema,
  amount: z.number().positive(),
  currency: z.string().optional().default('INR'),
});

export const createDirectPaymentOrderSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional().default('INR'),
  items: z.array(z.object({
    productId: objectIdSchema,
    // name/image are accepted for backward compatibility but are never
    // trusted — the server always re-resolves them from the Product
    // collection using productId (see createDirectPaymentOrder). This
    // prevents an order ever being stored with a mismatched product name.
    name: z.string().optional(),
    image: z.string().optional().default(''),
    quantity: z.number().int().positive(),
    sellingPrice: z.number().positive(),
    selectedSize: z.string().optional(),
  })).min(1, 'At least one item is required'),
  shippingAddress: z.object({
    fullName: z.string().optional(),
    streetAddress: z.string().optional(),
    city: z.string().optional(),
    zipCode: z.string().optional(),
    phoneNumber: z.string().optional(),
    mobileNumber: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    houseFlat: z.string().optional(),
    streetArea: z.string().optional(),
    landmark: z.string().optional(),
    deliveryInstructions: z.string().optional(),
    isDefault: z.boolean().optional(),
  }).optional(),
  subtotal: z.number().optional(),
  shippingCharges: z.number().optional().default(0),
  discountAmount: z.number().optional().default(0),
  promoCode: z.string().optional(),
  promoDiscount: z.number().optional().default(0),
  coupon: z.object({
    code: z.string(),
    couponId: objectIdSchema,
    discountAmount: z.number().optional().default(0),
    discountType: z.string().optional(),
  }).optional(),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  orderId: objectIdSchema,
});

export const refundPaymentSchema = z.object({
  paymentId: objectIdSchema,
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
});

// ─── Review ────────────────────────────────────────────────
export const createReviewSchema = z.object({
  productId: objectIdSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  comment: z.string().min(5).max(2000),
  images: z.array(z.string().url()).max(5).optional(),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(200).optional(),
  comment: z.string().min(5).max(2000).optional(),
  images: z.array(z.string().url()).max(5).optional(),
}).refine(d => d.rating || d.comment || d.images, {
  message: 'At least one field must be provided',
});

export const reviewQuerySchema = paginationSchema.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

// ─── Coupon ────────────────────────────────────────────────
export const createCouponSchema = z.object({
  name: z.string().min(1, 'Offer name is required').max(100),
  code: z.string()
    .min(3, 'Code must be at least 3 characters')
    .max(10, 'Code must be at most 10 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Code must contain only letters and numbers')
    .transform(v => v.toUpperCase()),
  description: z.string().max(500).optional().default(''),
  offerType: z.enum(['coupon', 'flash_sale', 'bundle', 'scratch_card']).optional().default('coupon'),
  discountType: z.enum(['percentage', 'free_delivery']),
  discountValue: z.number().min(0),
  maxDiscountAmount: z.number().positive().optional(),
  minOrderAmount: z.number().nonnegative().optional().default(0),
  minQuantity: z.number().int().nonnegative().optional().default(1),
  usageLimit: z.number().int().nonnegative().optional().default(0),
  perUserLimit: z.number().int().positive().optional().default(1),
  isActive: z.boolean().optional().default(true),
  status: z.enum(['active', 'draft']).optional().default('active'),
  startsAt: z.string().min(1, 'Start date is required'),
  expiresAt: z.string().min(1, 'End date is required'),
});

export const updateCouponSchema = createCouponSchema.partial();

export const applyCouponSchema = z.object({
  code: z.string().min(1).transform(v => v.toUpperCase()),
  orderAmount: z.number().nonnegative(),
  totalQuantity: z.number().int().nonnegative().optional().default(0),
  items: z.array(z.object({
    productId: objectIdSchema,
    categoryId: objectIdSchema.optional(),
    quantity: z.number().int().positive(),
    sellingPrice: z.number().nonnegative(),
  })).min(1),
});

// ─── Return Request ─────────────────────────────────────────
export const createReturnRequestSchema = z.object({
  orderId: objectIdSchema,
  orderItemId: objectIdSchema,
  reason: z.string().min(5).max(500),
  description: z.string().min(5).max(2000),
  quantity: z.number().int().positive(),
  images: z.array(z.string().url()).max(5).optional(),
  pickupAddress: addressDetailSchema,
});

export const returnActionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'picked_up', 'refunded']),
  adminNote: z.string().max(500).optional(),
  refundAmount: z.number().positive().optional(),
});

// ─── Address ────────────────────────────────────────────────
export const createAddressSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
  addressLine1: z.string().min(5).max(200),
  addressLine2: z.string().max(200).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode'),
  country: z.string().optional().default('India'),
  addressType: z.enum(['home', 'work', 'other']).optional().default('home'),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

// ─── Notification ───────────────────────────────────────────
export const notificationQuerySchema = paginationSchema.extend({
  type: z.string().optional(),
  isRead: z.coerce.boolean().optional(),
});

export const markReadSchema = z.object({
  notificationIds: z.array(objectIdSchema).min(1),
});

// ─── Banner ─────────────────────────────────────────────────
export const createBannerSchema = z.object({
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
  image: z.string().optional(),
  imageWebp: z.string(),
  imageFallback: z.string(),
  bigText: z.string().max(100).optional(),
  smallText: z.string().max(150).optional(),
  buttonText: z.string().max(30).optional(),
  buttonURL: z.string().optional(),
  contentPosition: z.enum(['Left Side', 'Right Side']).optional().default('Left Side'),
  link: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  position: z.number().int().nonnegative().optional(),
  order: z.number().int().optional(),
  bgColor: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updateBannerSchema = createBannerSchema.partial();

// ─── Auth ────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email().max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  password: z.string().min(1),
}).refine(d => d.email || d.phone, {
  message: 'Either email or phone is required',
});

export const otpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  purpose: z.enum(['email_verification', 'phone_verification', 'password_reset', 'login']),
}).refine(d => d.email || d.phone, {
  message: 'Either email or phone is required',
});

export const verifyOtpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  otp: z.string().length(6),
  purpose: z.enum(['email_verification', 'phone_verification', 'password_reset', 'login']),
}).refine(d => d.email || d.phone, {
  message: 'Either email or phone is required',
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
});

// ─── Profile ──────────────────────────────────────────────
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  avatar: z.string().url().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
});

// ─── Analytics ──────────────────────────────────────────────
export const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
});
