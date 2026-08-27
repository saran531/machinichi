import { Types } from 'mongoose';
import { View } from '../models/View';
import { ProductViewEvent } from '../models/ProductViewEvent';
import { ProductAnalytics } from '../models/ProductAnalytics';
import { Product } from '../models/Product';
import { Order } from '../models/Order';

function getPeriodStart(): { day: Date; week: Date; month: Date } {
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = new Date(day);
  week.setDate(week.getDate() - week.getDay());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  return { day, week, month };
}

function getPreviousPeriods() {
  const now = new Date();
  const prevDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const prevWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { prevDay, prevWeek, prevMonth };
}

// Enterprise identity rule: every analytics event uses a stable identity key.
// Priority: userId (logged-in) > guestId (permanent UUID stored in localStorage)
// > sessionId (temporary). guestId replaces sessionId as the canonical guest
// identifier — it survives page reloads, window closures, and browser restarts,
// so a single guest is never counted as multiple unique users.
function identityKey(userId?: string, guestId?: string, sessionId?: string): string {
  return userId || guestId || sessionId || '';
}

async function recordViewEvent(
  productId: Types.ObjectId,
  userId?: string,
  guestId?: string,
  sessionId?: string,
  meta?: { referrer?: string; source?: string; ip?: string },
) {
  await ProductViewEvent.create({
    productId,
    userId: userId ? new Types.ObjectId(userId) : undefined,
    sessionId: guestId || sessionId,
    viewedAt: new Date(),
    referrer: meta?.referrer,
    source: meta?.source || 'direct',
    ip: meta?.ip,
  });
}

function computeGrowth(current: number, previous: number): number | null {
  if (previous <= 0 && current <= 0) return null;
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

async function updatePeriodCounts(productId: Types.ObjectId) {
  const { day, week, month } = getPeriodStart();
  const { prevDay, prevWeek, prevMonth } = getPreviousPeriods();

  const [viewsSinceDay, viewsSinceWeek, viewsSinceMonth, prevDayCount, prevWeekCount, prevMonthCount] =
    await Promise.all([
      ProductViewEvent.countDocuments({ productId, viewedAt: { $gte: day } }),
      ProductViewEvent.countDocuments({ productId, viewedAt: { $gte: week } }),
      ProductViewEvent.countDocuments({ productId, viewedAt: { $gte: month } }),
      ProductViewEvent.countDocuments({ productId, viewedAt: { $gte: prevDay, $lt: day } }),
      ProductViewEvent.countDocuments({ productId, viewedAt: { $gte: prevWeek, $lt: week } }),
      ProductViewEvent.countDocuments({ productId, viewedAt: { $gte: prevMonth, $lt: month } }),
    ]);

  await ProductAnalytics.findOneAndUpdate(
    { productId },
    {
      $set: {
        viewsToday: viewsSinceDay,
        viewsThisWeek: viewsSinceWeek,
        viewsThisMonth: viewsSinceMonth,
        previousDayViews: prevDayCount,
        previousWeekViews: prevWeekCount,
        previousMonthViews: prevMonthCount,
        dailyGrowth: computeGrowth(viewsSinceDay, prevDayCount),
        weeklyGrowth: computeGrowth(viewsSinceWeek, prevWeekCount),
        monthlyGrowth: computeGrowth(viewsSinceMonth, prevMonthCount),
        snapshotDate: new Date(),
      },
    },
    { upsert: false },
  );
}

async function getPeriodSales(
  productId: Types.ObjectId,
  since: Date,
  until?: Date,
): Promise<number> {
  const match: Record<string, unknown> = {
    paymentStatus: 'Paid',
  };
  const dateFilter: Record<string, Date> = { $gte: since };
  if (until) dateFilter.$lt = until;
  match.createdAt = dateFilter;

  const result = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $match: { 'items.productId': productId } },
    { $group: { _id: null, totalQty: { $sum: '$items.quantity' } } },
  ]);

  return result[0]?.totalQty ?? 0;
}

async function updateSalesGrowth(productId: Types.ObjectId) {
  const { day, week, month } = getPeriodStart();
  const { prevDay, prevWeek, prevMonth } = getPreviousPeriods();

  const [todaySales, weekSales, monthSales, prevDaySales, prevWeekSales, prevMonthSales] =
    await Promise.all([
      getPeriodSales(productId, day),
      getPeriodSales(productId, week),
      getPeriodSales(productId, month),
      getPeriodSales(productId, prevDay, day),
      getPeriodSales(productId, prevWeek, week),
      getPeriodSales(productId, prevMonth, month),
    ]);

  await ProductAnalytics.findOneAndUpdate(
    { productId },
    {
      $set: {
        salesToday: todaySales,
        salesThisWeek: weekSales,
        salesThisMonth: monthSales,
        previousDaySales: prevDaySales,
        previousWeekSales: prevWeekSales,
        previousMonthSales: prevMonthSales,
        dailySalesGrowth: computeGrowth(todaySales, prevDaySales),
        weeklySalesGrowth: computeGrowth(weekSales, prevWeekSales),
        monthlySalesGrowth: computeGrowth(monthSales, prevMonthSales),
        snapshotDate: new Date(),
      },
    },
    { upsert: false },
  );
}

export const trackView = async (
  productId: string,
  identity: { userId?: string; guestId?: string; sessionId?: string },
  meta?: { referrer?: string; source?: string; ip?: string },
) => {
  const pid = new Types.ObjectId(productId);
  const uid = identity.userId || undefined;
  const gid = identity.guestId || undefined;
  const sid = identity.sessionId || undefined;

  const query = uid
    ? { userId: new Types.ObjectId(uid), productId: pid }
    : gid
    ? { guestId: gid, productId: pid, userId: { $exists: false } }
    : { sessionId: sid, productId: pid };

  const existing = await View.findOne(query);

  if (existing) {
    await View.findByIdAndUpdate(existing._id, { lastViewedAt: new Date() });
    await recordViewEvent(pid, uid, gid, sid, meta);
    return { counted: false, firstViewed: false };
  }

  const doc: any = { productId: pid, firstViewedAt: new Date(), lastViewedAt: new Date() };
  if (uid) doc.userId = new Types.ObjectId(uid);
  if (gid) doc.sessionId = gid;
  else if (sid) doc.sessionId = sid;
  await View.create(doc);
  await recordViewEvent(pid, uid, gid, sid, meta);

  await ProductAnalytics.findOneAndUpdate(
    { productId: pid },
    {
      $inc: { totalUniqueViews: 1 },
      $set: { lastViewedAt: new Date() },
    },
    { upsert: true },
  );

  await updatePeriodCounts(pid);

  return { counted: true, firstViewed: true };
};

export const mergeGuestViews = async (userId: string, guestId: string) => {
  const uid = new Types.ObjectId(userId);
  const guestViews = await View.find({ sessionId: guestId, userId: { $exists: false } });

  for (const gv of guestViews) {
    const existingUserView = await View.findOne({ userId: uid, productId: gv.productId });
    if (existingUserView) {
      await View.findByIdAndDelete(gv._id);
    } else {
      await View.findByIdAndUpdate(gv._id, { userId: uid, $unset: { sessionId: '' } });
    }
  }

  await ProductViewEvent.updateMany(
    { sessionId: guestId, userId: { $exists: false } },
    { userId: uid },
  );

  // Fix Cart Count: if guestId and userId both exist for the same product,
  // the same person was counted twice — decrement totalUniqueCartUsers
  // to correct the over-count from trackCartAdd, and remove the guestId.
  await ProductAnalytics.updateMany(
    { currentCartUsers: { $all: [guestId, userId] } },
    {
      $pull: { currentCartUsers: guestId },
      $inc: { totalUniqueCartUsers: -1 },
    },
  );

  // Reassign remaining guest-only entries to the authenticated user.
  await ProductAnalytics.updateMany(
    { currentCartUsers: guestId },
    { $set: { "currentCartUsers.$[elem]": userId } },
    { arrayFilters: [{ elem: guestId }] },
  );
};

async function ensureAnalyticsDoc(productId: Types.ObjectId) {
  await ProductAnalytics.updateOne(
    { productId },
    { $setOnInsert: { productId, currentCartUsers: [] } },
    { upsert: true },
  );
}

export const trackCartAdd = async (
  productId: string,
  identity: { userId?: string; guestId?: string; sessionId?: string },
) => {
  const pid = new Types.ObjectId(productId);
  const key = identityKey(identity.userId, identity.guestId, identity.sessionId);
  const gid = identity.guestId || identity.sessionId;
  if (!key) return { success: false };

  // Plain-equality upsert first (no $ne in the filter) so this can never
  // race into a duplicate-key error against the unique `productId` index.
  await ensureAnalyticsDoc(pid);

  // Check membership BEFORE mutating: `$inc: totalCartAdds` always modifies
  // the document on every call, so `modifiedCount` from a combined update
  // can't be used to detect "was this actually a new cart user" — read the
  // current state explicitly instead.
  const before = await ProductAnalytics.findOne({ productId: pid }).select('currentCartUsers');
  const alreadyInCart = !!before?.currentCartUsers?.includes(key);

  const incFields: Record<string, number> = { totalCartAdds: 1 };
  if (!alreadyInCart) incFields.totalUniqueCartUsers = 1;

  await ProductAnalytics.updateOne(
    { productId: pid },
    { $addToSet: { currentCartUsers: key }, $inc: incFields },
  );

  return { success: true, alreadyInCart };
};

export const trackCartRemove = async (
  productId: string,
  identity: { userId?: string; guestId?: string; sessionId?: string },
) => {
  const pid = new Types.ObjectId(productId);
  const keys = [identity.userId, identity.guestId, identity.sessionId].filter(Boolean);
  if (keys.length === 0) return { success: false };

  await ProductAnalytics.updateOne(
    { productId: pid },
    { $pull: { currentCartUsers: { $in: keys } }, $inc: { totalCartRemoves: 1 } },
  );

  return { success: true };
};

export const recordPurchase = async (
  productId: string,
  userId: string,
  revenue: number,
  quantity: number,
  guestId?: string,
  sessionId?: string,
) => {
  const pid = new Types.ObjectId(productId);

  await ProductAnalytics.findOneAndUpdate(
    { productId: pid },
    {
      $pull: { currentCartUsers: userId },
      $inc: {
        totalPurchases: 1,
        totalRevenue: revenue,
        totalUnitsSold: quantity,
      },
      $set: { lastPurchasedAt: new Date() },
    },
    { upsert: true },
  );

  // Also try to remove the guestId/sessionId key if it's still in the array
  const guestKey = guestId || sessionId;
  if (guestKey) {
    await ProductAnalytics.updateOne(
      { productId: pid, currentCartUsers: guestKey },
      { $pull: { currentCartUsers: guestKey } },
    );
  }

  // Compute sales-growth rates from the Order collection
  await updateSalesGrowth(pid);

  // Keep the legacy Product-level counters in sync too — the admin listing
  // UI falls back to these when the analytics rollup hasn't loaded yet, so
  // both must reflect real sales, not just one of them.
  await Product.findByIdAndUpdate(pid, {
    $inc: { totalSales: quantity, totalRevenue: revenue },
  });
};

export const bulkRecordPurchases = async (
  items: { productId: string; quantity: number; price: number }[],
  userId: string,
  guestId?: string,
  sessionId?: string,
) => {
  for (const item of items) {
    await recordPurchase(item.productId, userId, item.price * item.quantity, item.quantity, guestId, sessionId);
  }
};

export const getProductAnalytics = async (productId: string) => {
  const pid = new Types.ObjectId(productId);
  let analytics = await ProductAnalytics.findOne({ productId: pid });

  if (!analytics) {
    analytics = await ProductAnalytics.create({ productId: pid, currentCartUsers: [] });
  }

  const currentCartCount = analytics.currentCartUsers.length;
  const totalUniqueCartUsers = analytics.totalUniqueCartUsers || 0;

  const conversionRate = analytics.totalUniqueViews > 0
    ? ((analytics.totalPurchases / analytics.totalUniqueViews) * 100).toFixed(2)
    : null;

  const cartConversionRate = totalUniqueCartUsers > 0
    ? ((analytics.totalPurchases / totalUniqueCartUsers) * 100).toFixed(2)
    : null;

  return {
    totalUniqueViews: analytics.totalUniqueViews,
    totalUniqueCartUsers,
    currentCartCount,
    totalCartAdds: analytics.totalCartAdds,
    totalPurchases: analytics.totalPurchases,
    totalRevenue: analytics.totalRevenue,
    totalUnitsSold: analytics.totalUnitsSold,
    totalWishlistAdds: analytics.totalWishlistAdds,
    totalWishlistRemoves: analytics.totalWishlistRemoves,
    lastViewedAt: analytics.lastViewedAt,
    lastPurchasedAt: analytics.lastPurchasedAt,
    viewsToday: analytics.viewsToday,
    viewsThisWeek: analytics.viewsThisWeek,
    viewsThisMonth: analytics.viewsThisMonth,
    dailyGrowth: analytics.dailyGrowth,
    weeklyGrowth: analytics.weeklyGrowth,
    monthlyGrowth: analytics.monthlyGrowth,
    dailySalesGrowth: analytics.dailySalesGrowth,
    weeklySalesGrowth: analytics.weeklySalesGrowth,
    monthlySalesGrowth: analytics.monthlySalesGrowth,
    conversionRate,
    cartConversionRate,
  };
};

export const getBulkProductAnalytics = async (productIds: string[]) => {
  if (!productIds.length) return {};
  const pids = productIds.map((id) => new Types.ObjectId(id));
  const analytics = await ProductAnalytics.find({ productId: { $in: pids } });

  const map: Record<string, any> = {};
  for (const a of analytics) {
    const pid = a.productId.toString();
    const totalUniqueCartUsers = a.totalUniqueCartUsers || 0;
    map[pid] = {
      totalUniqueViews: a.totalUniqueViews,
      totalUniqueCartUsers,
      currentCartCount: a.currentCartUsers.length,
      totalCartAdds: a.totalCartAdds,
      totalPurchases: a.totalPurchases,
      totalRevenue: a.totalRevenue,
      totalUnitsSold: a.totalUnitsSold,
      viewsToday: a.viewsToday,
      viewsThisWeek: a.viewsThisWeek,
      viewsThisMonth: a.viewsThisMonth,
      dailyGrowth: a.dailyGrowth,
      weeklyGrowth: a.weeklyGrowth,
      monthlyGrowth: a.monthlyGrowth,
      dailySalesGrowth: a.dailySalesGrowth,
      weeklySalesGrowth: a.weeklySalesGrowth,
      monthlySalesGrowth: a.monthlySalesGrowth,
      conversionRate: a.totalUniqueViews > 0
        ? ((a.totalPurchases / a.totalUniqueViews) * 100).toFixed(2)
        : null,
      cartConversionRate: totalUniqueCartUsers > 0
        ? ((a.totalPurchases / totalUniqueCartUsers) * 100).toFixed(2)
        : null,
    };
  }
  return map;
};
