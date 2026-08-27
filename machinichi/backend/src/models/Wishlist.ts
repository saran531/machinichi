import mongoose, { Schema } from 'mongoose';

export interface IWishlistProduct {
  productId: mongoose.Types.ObjectId;
  variantSize?: string;
  addedAt: Date;
}

export interface IWishlist extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  products: IWishlistProduct[];
  createdAt: Date;
  updatedAt: Date;
}

const wishlistSchema = new Schema<IWishlist>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  products: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSize: String,
    addedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

wishlistSchema.index({ 'products.productId': 1 });

export const Wishlist = mongoose.model<IWishlist>('Wishlist', wishlistSchema);
