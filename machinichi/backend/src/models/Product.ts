import mongoose, { Schema } from 'mongoose';

export interface IProductVariant {
  size?: string;
  color?: string;
  attributes?: Record<string, string>;
  sku: string;
  barcode?: string;
  batchNumber?: string;
  gstRate?: number;
  costPrice: number;
  mrpPrice: number;
  sellingPrice: number;
  quantity: number;
  warehouseStock?: number;
  reservedQuantity?: number;
  isAvailable: boolean;
  images?: { url: string; alt?: string }[];
}

export interface IProduct extends mongoose.Document {
  name: string;
  slug: string;
  sku: string;
  hsnCode: string;
  brand: string;
  category: mongoose.Types.ObjectId;
  description: string;
  shortDescription: string;
  costPrice: number;
  mrpPrice: number;
  sellingPrice: number;
  comparePrice?: number;
  discountPercent?: number;
  quantity: number;
  reservedQuantity: number;
  warehouseStock: number;
  minStock: number;
  maxStock?: number;
  lowStockThreshold: number;
  barcode?: string;
  batchNumber?: string;
  trackInventory: boolean;
  weight?: number;
  dimensions?: { height: number; width: number; length: number };
  gstRate: number;
  gstCategory?: string;
  unitType?: string;
  availableSizes?: string[];
  variants?: IProductVariant[];
  attributes?: Record<string, string>;
  warranty?: { period?: string; description?: string };
  returnPolicy?: { isReturnable: boolean; returnPeriodDays?: number; returnCondition?: string };
  marketplaceLinks?: {
    amazon?: string; flipkart?: string; meesho?: string; myntra?: string;
    ajio?: string; snapdeal?: string; jiomart?: string; ownWebsite?: string;
  };
  publishStatus: 'unlisted' | 'published' | 'archived';
  listedAt?: Date;
  listedBy?: mongoose.Types.ObjectId;
  tags: string[];
  badges: string[];
  isFeatured: boolean;
  isVisible: boolean;
  isActive: boolean;
  isDeleted: boolean;
  status: 'Active' | 'Draft' | 'Out of Stock' | 'Discontinued';
  images: { url: string; alt?: string; isPrimary: boolean; order: number }[];
  videos: { url: string; title?: string }[];
  seo: { metaTitle?: string; metaDescription?: string; metaKeywords?: string[] };
  totalViews: number;
  totalSales: number;
  totalRevenue: number;
  totalCartCount: number;
  averageRating: number;
  reviewCount: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  sku: { type: String, required: true, unique: true, uppercase: true },
  hsnCode: { type: String, required: true },
  brand: { type: String, required: true, trim: true },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  description: { type: String, required: true },
  shortDescription: { type: String, maxlength: 300 },
  costPrice: { type: Number, required: true, min: 0 },
  mrpPrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  comparePrice: { type: Number },
  discountPercent: { type: Number, default: 0 },
  quantity: { type: Number, default: 0, min: 0 },
  reservedQuantity: { type: Number, default: 0, min: 0 },
  warehouseStock: { type: Number, default: 0, min: 0 },
  minStock: { type: Number, default: 5, min: 0 },
  maxStock: { type: Number },
  lowStockThreshold: { type: Number, default: 10 },
  barcode: { type: String },
  batchNumber: { type: String },
  trackInventory: { type: Boolean, default: true },
  weight: { type: Number },
  dimensions: {
    height: { type: Number },
    width: { type: Number },
    length: { type: Number },
  },
  gstRate: { type: Number, default: 5 },
  gstCategory: { type: String },
  unitType: { type: String, default: 'Kilogram' },
  availableSizes: [{ type: String }],
  variants: [{
    size: String,
    color: String,
    attributes: { type: Map, of: String },
    sku: { type: String, required: true },
    barcode: String,
    batchNumber: String,
    gstRate: Number,
    costPrice: { type: Number, required: true },
    mrpPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    quantity: { type: Number, default: 0 },
    warehouseStock: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    images: [{ url: String, alt: String }],
  }],
  attributes: { type: Map, of: String },
  warranty: {
    period: String,
    description: String,
  },
  returnPolicy: {
    isReturnable: { type: Boolean, default: true },
    returnPeriodDays: { type: Number, default: 7 },
    returnCondition: String,
  },
  marketplaceLinks: {
    amazon: String,
    flipkart: String,
    meesho: String,
    myntra: String,
    ajio: String,
    snapdeal: String,
    jiomart: String,
    ownWebsite: String,
  },
  publishStatus: { type: String, enum: ['unlisted', 'published', 'archived'], default: 'unlisted', index: true },
  listedAt: { type: Date },
  listedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: String, lowercase: true }],
  badges: [String],
  isFeatured: { type: Boolean, default: false },
  isVisible: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Draft', 'Out of Stock', 'Discontinued'], default: 'Draft' },
  images: [{
    url: { type: String, required: true },
    alt: String,
    isPrimary: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  }],
  videos: [{ url: String, title: String }],
  seo: {
    metaTitle: String,
    metaDescription: String,
    metaKeywords: [String],
  },
  totalViews: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  totalCartCount: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

productSchema.index({ category: 1, status: 1, isVisible: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ status: 1 });
productSchema.index({ category: 1, publishStatus: 1 });
productSchema.index({ deletedAt: 1 }, { sparse: true });
productSchema.index({ name: 'text', 'seo.metaKeywords': 'text', tags: 'text' }, { weights: { name: 10, tags: 5 } });
productSchema.index({ sellingPrice: 1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ totalSales: -1 });
productSchema.index({ createdAt: -1 });

productSchema.pre('save', function () {
  if (this.mrpPrice && this.sellingPrice) {
    this.discountPercent = Math.round(((this.mrpPrice - this.sellingPrice) / this.mrpPrice) * 100);
  }
});

export const Product = mongoose.model<IProduct>('Product', productSchema);
