import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Archive, ArrowUpDown, BadgeCheck, BadgeInfo, BarChart3, Bookmark, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, Edit3, Eye, EyeOff, GripVertical, ImageIcon,
  Link2, Loader2, Globe, Package, Plus, Save, Search, Settings, ShoppingCart, Star,
  Trash2, Upload, Video, X, AlertTriangle, Copy, ExternalLink, FileText, RefreshCw, Grip,
  Clock, TrendingUp, DollarSign, Activity, Heart, Users, MoreVertical, Leaf, CheckSquare, Square
} from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import AdminLayout from "../components/AdminLayout";

const API = axios.create({ baseURL: "http://localhost:5000/api", withCredentials: true });
API.interceptors.request.use((c) => { 
  const t = localStorage.getItem("accessToken"); 
  if (t) c.headers.Authorization = `Bearer ${t}`; 
  return c; 
});

const TABS = [
  { key: "all", label: "All Products", icon: Package },
  { key: "published", label: "Published", icon: CheckCircle2 },
  { key: "unlisted", label: "Draft / Unlisted", icon: EyeOff },
  { key: "archived", label: "Archived", icon: Archive },
];

const BADGE_OPTIONS = [
  "Best Seller", "Trending", "New Arrival", "Most Popular",
  "Limited Offer", "Flash Sale", "Featured", "Recommended",
];

const VARIANT_ATTRIBUTES = [
  { key: "color", label: "Color", type: "text", placeholder: "e.g. Red" },
  { key: "size", label: "Size", type: "text", placeholder: "e.g. M" },
  { key: "weight", label: "Weight", type: "text", placeholder: "e.g. 500g" },
  { key: "storage", label: "Storage", type: "text", placeholder: "e.g. 128GB" },
  { key: "ram", label: "RAM", type: "text", placeholder: "e.g. 8GB" },
  { key: "packSize", label: "Pack Size", type: "text", placeholder: "e.g. Pack of 2" },
  { key: "material", label: "Material", type: "text", placeholder: "e.g. Cotton" },
  { key: "volume", label: "Volume", type: "text", placeholder: "e.g. 1L" },
];

const MARKETPLACE_FIELDS = [
  "amazon", "flipkart", "meesho", "myntra", "ajio", "snapdeal", "jiomart", "ownWebsite",
];

const REQUIRED_FOR_PUBLISH = [
  { field: "name", label: "Product Name" },
  { field: "category", label: "Category" },
  { field: "brand", label: "Brand" },
  { field: "description", label: "Description" },
  { field: "sellingPrice", label: "Price" },
  { field: "mrpPrice", label: "MRP" },
  { field: "images", label: "At least one image" },
  { field: "sku", label: "SKU" },
  { field: "hsnCode", label: "HSN Code" },
];

const INR = (v) => v ? `₹${Number(v).toLocaleString("en-IN")}` : "—";
function genKey() { return Math.random().toString(36).slice(2, 10); }

export default function ProductListing({ onAdminLogout, favoriteProducts = new Set() }) {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const highlightParam = searchParams.get("highlight") || "";
  const initialLoadRef = useRef(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [listingForm, setListingForm] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showListingModal, setShowListingModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [draggedVariant, setDraggedVariant] = useState(null);
  const [analyticsMap, setAnalyticsMap] = useState({});
  const [viewUsersModal, setViewUsersModal] = useState(null);
  const limit = 20;

  const fetchProducts = async (p = page, skipSearch = false) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: p, limit, sort: sortBy, order: sortOrder });
      if (tab !== "all") params.set("publishStatus", tab);
      if (search && !skipSearch) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      const { data } = await API.get(`/admin/products?${params}`);
      if (data.success) {
        setProducts(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
        const ids = (data.data || []).map((p) => p._id).filter(Boolean);
        if (ids.length > 0) {
          try {
            const { data: analyticsData } = await API.get(`/analytics/products?ids=${ids.join(",")}`);
            if (analyticsData.success) setAnalyticsMap(analyticsData.data || {});
          } catch { /* analytics unavailable */ }
        }
      }
    } catch (e) { setError(e.response?.data?.message || "Failed to load products"); }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const { data } = await API.get("/categories");
      if (data.success) setCategories(data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchCategories(); }, []);
  
  // Debounce search input
  useEffect(() => {
    const skipSearch = initialLoadRef.current && highlightParam;
    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchProducts(1, skipSearch);
      if (skipSearch) initialLoadRef.current = false;
    }, skipSearch ? 0 : 450);
    return () => clearTimeout(delayDebounceFn);
  }, [search, tab, categoryFilter, sortBy, sortOrder]);

  useEffect(() => { fetchProducts(); }, [page]);

  useEffect(() => {
    const onFocus = () => { fetchProducts(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const silentFetchRef = useRef(fetchProducts);
  silentFetchRef.current = fetchProducts;
  useEffect(() => {
    const interval = setInterval(() => silentFetchRef.current(page), 15000);
    return () => clearInterval(interval);
  }, [page]);

  const openListingModal = async (product) => {
    setValidationErrors([]); setSuccessMsg(""); setShowPreview(false);
    setEditingProduct(product);
    setListingForm({
      name: product.name || "", brand: product.brand || "",
      category: product.category?._id || product.category || "",
      subcategory: "",
      description: product.description || "", shortDescription: product.shortDescription || "",
      sku: product.sku || "", hsnCode: product.hsnCode || "",
      sellingPrice: product.sellingPrice || "", mrpPrice: product.mrpPrice || "",
      costPrice: product.costPrice || "", offerPrice: "",
      discountPercent: product.discountPercent || 0, gstRate: product.gstRate || 5,
      tags: product.tags?.join(", ") || "",
      metaTitle: product.seo?.metaTitle || "",
      metaDescription: product.seo?.metaDescription || "",
      metaKeywords: product.seo?.metaKeywords?.join(", ") || "",
      slug: product.slug || "",
      weight: product.weight || "", deliveryTime: "", shippingClass: "",
      dimensions: product.dimensions || { height: "", width: "", length: "" },
      warranty: product.warranty?.period || "", warrantyDesc: product.warranty?.description || "",
      returnPolicy: product.returnPolicy?.isReturnable !== false,
      returnPeriod: product.returnPeriod || product.returnPolicy?.returnPeriodDays || 7,
      replacementPolicy: false,
      badges: product.badges || [],
      isFeatured: product.isFeatured || false,
      publishStatus: product.publishStatus || "unlisted",
      marketplaceLinks: product.marketplaceLinks || {},
      variants: product.variants?.map(v => ({
        ...v, _key: genKey(),
        attributes: v.attributes || {},
        images: v.images || [],
        offerPrice: v.offerPrice || "",
      })) || [],
      images: product.images?.map(i => ({ ...i, _key: genKey() })) || [],
      videos: product.videos || [],
    });
    setShowListingModal(true);
  };

  const updateForm = (field, value) => setListingForm(p => ({ ...p, [field]: value }));

  const checkPublishReady = () => {
    const errors = [];
    REQUIRED_FOR_PUBLISH.forEach(({ field, label }) => {
      const val = listingForm[field];
      if (!val || (Array.isArray(val) && val.length === 0)) errors.push(label);
    });
    if (!listingForm.hsnCode) errors.push("HSN Code");
    if (!listingForm.gstRate) errors.push("GST Rate");
    if (listingForm.variants?.length > 0) {
      const hasActive = listingForm.variants.some(v => v.sellingPrice && v.mrpPrice);
      if (!hasActive) errors.push("At least one variant with complete pricing");
    }
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const publishProduct = async () => {
    if (!checkPublishReady()) return;
    setSaving(true); setSuccessMsg("");
    try {
      const links = Object.fromEntries(Object.entries(listingForm.marketplaceLinks).filter(([, v]) => v));
      await API.post(`/admin/products/${editingProduct._id}/list`, {
        marketplaceLinks: Object.keys(links).length ? links : undefined,
      });
      const updates = {
        name: listingForm.name, brand: listingForm.brand,
        description: listingForm.description, shortDescription: listingForm.shortDescription,
        sellingPrice: Number(listingForm.sellingPrice), mrpPrice: Number(listingForm.mrpPrice),
        costPrice: Number(listingForm.costPrice || 0), gstRate: Number(listingForm.gstRate),
        weight: listingForm.weight ? Number(listingForm.weight) : undefined,
        dimensions: listingForm.dimensions?.height ? listingForm.dimensions : undefined,
        warranty: listingForm.warranty ? { period: listingForm.warranty, description: listingForm.warrantyDesc } : undefined,
        returnPolicy: { isReturnable: listingForm.returnPolicy, returnPeriodDays: Number(listingForm.returnPeriod) },
        tags: listingForm.tags.split(",").map(t => t.trim()).filter(Boolean),
        badges: listingForm.badges, isFeatured: listingForm.isFeatured,
        seo: {
          metaTitle: listingForm.metaTitle, metaDescription: listingForm.metaDescription,
          metaKeywords: listingForm.metaKeywords.split(",").map(t => t.trim()).filter(Boolean)
        },
        images: listingForm.images.map((img, i) => ({ ...img, order: i, isPrimary: i === 0 })),
        videos: listingForm.videos,
        variants: listingForm.variants.map(v => ({
          size: v.size, color: v.color, attributes: v.attributes,
          sku: v.sku, barcode: v.barcode,
          mrpPrice: Number(v.mrpPrice), sellingPrice: Number(v.sellingPrice),
          costPrice: Number(v.costPrice || 0), quantity: Number(v.quantity || 0),
          isAvailable: v.status !== "inactive", images: v.images || [],
        })),
      };
      await API.put(`/admin/products/${editingProduct._id}`, updates);
      setSuccessMsg("Product published and is now live in the store!");
      setShowListingModal(false);
      fetchProducts(page);
    } catch (e) {
      setValidationErrors([e.response?.data?.message || "Publishing failed"]);
    }
    setSaving(false);
  };

  const saveDraft = async () => {
    setSaving(true); setSuccessMsg("");
    try {
      const updates = {
        name: listingForm.name, brand: listingForm.brand,
        description: listingForm.description, shortDescription: listingForm.shortDescription,
        sellingPrice: Number(listingForm.sellingPrice), mrpPrice: Number(listingForm.mrpPrice),
        costPrice: Number(listingForm.costPrice || 0), gstRate: Number(listingForm.gstRate),
        weight: listingForm.weight ? Number(listingForm.weight) : undefined,
        dimensions: listingForm.dimensions?.height ? listingForm.dimensions : undefined,
        warranty: listingForm.warranty ? { period: listingForm.warranty, description: listingForm.warrantyDesc } : undefined,
        returnPolicy: { isReturnable: listingForm.returnPolicy, returnPeriodDays: Number(listingForm.returnPeriod) },
        tags: listingForm.tags.split(",").map(t => t.trim()).filter(Boolean),
        badges: listingForm.badges, isFeatured: listingForm.isFeatured,
        seo: {
          metaTitle: listingForm.metaTitle, metaDescription: listingForm.metaDescription,
          metaKeywords: listingForm.metaKeywords.split(",").map(t => t.trim()).filter(Boolean)
        },
        images: listingForm.images.map((img, i) => ({ ...img, order: i, isPrimary: i === 0 })),
        videos: listingForm.videos,
        variants: listingForm.variants.map(v => ({
          size: v.size, color: v.color, attributes: v.attributes,
          sku: v.sku, barcode: v.barcode,
          mrpPrice: Number(v.mrpPrice), sellingPrice: Number(v.sellingPrice),
          costPrice: Number(v.costPrice || 0), quantity: Number(v.quantity || 0),
          isAvailable: v.status !== "inactive", images: v.images || [],
        })),
      };
      await API.put(`/admin/products/${editingProduct._id}`, updates);
      setSuccessMsg("Draft saved successfully");
      setShowListingModal(false);
      fetchProducts(page);
    } catch (e) {
      setValidationErrors([e.response?.data?.message || "Save failed"]);
    }
    setSaving(false);
  };

  const archiveProduct = async (productId) => {
    try {
      await API.post(`/admin/products/${productId}/unlist`, { status: "archived" });
      fetchProducts(page);
    } catch (e) { setError(e.response?.data?.message || "Failed to archive"); }
  };

  const unlistProduct = async (productId) => {
    try {
      await API.post(`/admin/products/${productId}/unlist`, { status: "unlisted" });
      fetchProducts(page);
    } catch (e) { setError(e.response?.data?.message || "Failed to unlist"); }
  };

  const bulkAction = async (action) => {
    setSaving(true);
    for (const id of selected) {
      try {
        if (action === "publish") await API.post(`/admin/products/${id}/list`, {});
        else if (action === "unlist") await API.post(`/admin/products/${id}/unlist`, { status: "unlisted" });
        else if (action === "archive") await API.post(`/admin/products/${id}/unlist`, { status: "archived" });
        else if (action === "delete") await API.delete(`/admin/products/${id}`);
      } catch { /* continue */ }
    }
    setSelected([]); setSaving(false);
    fetchProducts(page);
  };

  const toggleSelect = (id) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const addVariant = () => {
    setListingForm(p => ({
      ...p, variants: [...p.variants, {
        _key: genKey(), color: "", size: "", weight: "", storage: "", ram: "",
        packSize: "", material: "", volume: "", attributes: {},
        sku: "", barcode: "", sellingPrice: "", mrpPrice: "", costPrice: "",
        offerPrice: "", quantity: "", status: "active", images: [],
      }],
    }));
  };

  const duplicateVariant = (index) => {
    const original = listingForm.variants[index];
    setListingForm(p => {
      const variants = [...p.variants];
      variants.splice(index + 1, 0, {
        ...original, _key: genKey(), sku: "",
      });
      return { ...p, variants };
    });
  };

  const removeVariant = (key) => {
    setListingForm(p => ({ ...p, variants: p.variants.filter(v => v._key !== key) }));
  };

  const updateVariant = (key, field, value) => {
    setListingForm(p => ({
      ...p, variants: p.variants.map(v => v._key === key ? { ...v, [field]: value } : v),
    }));
  };

  const addImage = (url) => {
    setListingForm(p => ({
      ...p, images: [...p.images, { url, _key: genKey(), alt: "" }],
    }));
  };

  const removeImage = (key) => {
    setListingForm(p => ({ ...p, images: p.images.filter(i => i._key !== key) }));
  };

  const setPrimaryImage = (key) => {
    setListingForm(p => {
      const images = [...p.images];
      const idx = images.findIndex(i => i._key === key);
      if (idx > 0) {
        const [img] = images.splice(idx, 1);
        images.unshift(img);
      }
      return { ...p, images };
    });
  };

  const getPublishStatus = (p) => {
    if (p.isDeleted) return { label: "Deleted", color: "text-red-600 bg-red-50" };
    if (p.publishStatus === "published") return { label: "Published", color: "text-green-700 bg-green-50 border border-green-200" };
    if (p.publishStatus === "archived") return { label: "Archived", color: "text-gray-600 bg-gray-100 border border-gray-200" };
    return { label: "Draft", color: "text-amber-700 bg-amber-50 border border-amber-200" };
  };

  // Filters
  const filteredProducts = useMemo(() => {
    let fp = products;
    if (stockFilter === "low") fp = fp.filter(p => p.quantity <= (p.lowStockThreshold || 10) && p.quantity > 0);
    else if (stockFilter === "out") fp = fp.filter(p => p.quantity <= 0);
    else if (stockFilter === "featured") fp = fp.filter(p => p.isFeatured);
    if (brandFilter) fp = fp.filter(p => p.brand?.toLowerCase().includes(brandFilter.toLowerCase()));
    return fp;
  }, [products, stockFilter, brandFilter]);

  return (
    <AdminLayout onAdminLogout={onAdminLogout}>
      <div className="min-h-screen bg-[#faf9f6] text-[#21150f] px-5 py-8 sm:px-8 lg:px-10">
        
        {successMsg && (
          <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3.5 text-[13px] font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> {successMsg}
          </div>
        )}

        {/* Top Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-black tracking-tight text-[#3a1100] font-serif">Product Listing Catalog</h1>
            <p className="mt-1.5 text-[13.5px] font-semibold text-[#796d66]">Publish products, set marketplaces, and configure SEO details</p>
          </div>
          
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white border border-[#efe5dc] p-2 shadow-sm">
              <span className="text-[11.5px] font-black text-[#796d66] px-2">{selected.length} Selected</span>
              <button onClick={() => bulkAction("publish")} disabled={saving} className="inline-flex h-9 items-center gap-1 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[11px] font-black text-white transition disabled:opacity-50"><Check size={13} /> Publish</button>
              <button onClick={() => bulkAction("unlist")} disabled={saving} className="inline-flex h-9 items-center gap-1 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-[11px] font-black text-white transition disabled:opacity-50"><EyeOff size={13} /> Unlist</button>
              <button onClick={() => bulkAction("archive")} disabled={saving} className="inline-flex h-9 items-center gap-1 px-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-[11px] font-black text-white transition disabled:opacity-50"><Archive size={13} /> Archive</button>
              <button onClick={() => bulkAction("delete")} disabled={saving} className="inline-flex h-9 items-center gap-1 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-[11px] font-black text-white transition disabled:opacity-50"><Trash2 size={13} /> Delete</button>
              <button onClick={() => setSelected([])} className="h-9 px-3 rounded-lg border border-[#cfc1b5] text-[11.5px] font-black text-[#796d66] hover:bg-gray-50 transition">Cancel</button>
            </div>
          )}
        </header>

        {/* Tab Pills & Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap gap-1.5 bg-[#f3ece5]/60 p-1 rounded-xl border border-[#efe5dc] w-fit">
            {TABS.map(t => (
              <button 
                key={t.key} 
                onClick={() => setTab(t.key)}
                className={`flex h-10 items-center gap-2 rounded-lg px-4 text-[12.5px] font-black transition-all ${
                  tab === t.key 
                    ? "bg-[#3a1100] text-white shadow-sm" 
                    : "text-[#5c514b] hover:text-[#3a1100] hover:bg-[#fffcf9]"
                }`} 
                type="button"
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white border border-[#efe5dc] p-3 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search catalog by name, brand, HSN..." 
                className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] pl-10 pr-4 text-[13px] text-[#211713] outline-none placeholder:text-[#9a8b82] transition focus:border-[#fd761a] focus:bg-white" 
              />
            </div>
            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)} 
              className="h-10 rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3 text-[12.5px] font-black text-[#5c514b]"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select 
              value={stockFilter} 
              onChange={e => setStockFilter(e.target.value)} 
              className="h-10 rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3 text-[12.5px] font-black text-[#5c514b]"
            >
              <option value="">All Attributes</option>
              <option value="featured">Featured Catalog</option>
              <option value="low">Low Inventory Alert</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Listing Feed */}
        {loading ? (
          <div className="flex items-center justify-center py-28">
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={32} className="animate-spin text-[#fd761a]" />
              <p className="text-[13px] font-bold text-[#796d66]">Retrieving listings...</p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-[#efe5dc] bg-white px-8 py-20 text-center shadow-sm">
            <Package size={42} className="mx-auto text-[#c7bab0] mb-4" />
            <h3 className="text-[17px] font-black text-[#3a1100] font-serif">No products found</h3>
            <p className="mt-1 text-[13px] text-[#796d66]">Try updating search keywords or category filters.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#efe5dc] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left border-collapse">
                <thead className="bg-[#faf8f5] text-[10.5px] font-black uppercase tracking-wider text-[#9a8b82] border-b border-[#efe5dc]">
                  <tr>
                    <th className="px-5 py-4 w-12 text-center">
                      <button 
                        onClick={() => {
                          const allIds = filteredProducts.map(p => p._id);
                          setSelected(prev => prev.length === allIds.length ? [] : allIds);
                        }}
                        className="text-gray-400 hover:text-[#3a1100]"
                      >
                        {selected.length === filteredProducts.length ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="px-5 py-4 w-16">Image</th>
                    <th className="px-5 py-4">Product Details</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Base Price</th>
                    <th className="px-5 py-4">Variants</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-center">Analytics</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f5eee8] bg-white text-[13px]">
                  {filteredProducts.map((p) => {
                    const isSel = selected.includes(p._id);
                    const isHighlighted = highlightParam
                      && (p.name || "").toLowerCase().includes(highlightParam.toLowerCase());
                    const statusBadge = getPublishStatus(p);
                    const views = analyticsMap[p._id]?.views || 0;
                    const sales = analyticsMap[p._id]?.sales || 0;

                    return (
                      <tr key={p._id} className={`transition hover:bg-[#fffcf9]/40 ${isSel ? "bg-orange-50/20" : ""}${isHighlighted ? " bg-[#fff3e6]" : ""}`}>
                        <td className="px-5 py-4 text-center">
                          <button 
                            onClick={() => toggleSelect(p._id)}
                            className="text-gray-400 hover:text-[#3a1100]"
                          >
                            {isSel ? (
                              <CheckSquare size={16} className="text-[#fd761a]" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="h-12 w-12 rounded-lg border border-[#efe5dc] bg-[#faf7f4] overflow-hidden shrink-0">
                            {p.images?.[0]?.url ? (
                              <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon size={16} className="m-auto text-gray-300" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-[#3a1100]">{p.name}</p>
                          <p className="text-[11px] font-semibold text-[#9a8b82] mt-0.5">{p.brand} · SKU: {p.sku || "—"}</p>
                        </td>
                        <td className="px-5 py-4 text-[#5c514b]">{p.category?.name || "General"}</td>
                        <td className="px-5 py-4 font-bold text-[#211713]">{INR(p.sellingPrice)}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded bg-[#f3ece5] px-2 py-0.5 text-[11px] font-black text-[#5c514b]">
                            {p.variants?.length || 0} variants
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-3 text-[11.5px] font-bold text-[#796d66]">
                            <span className="flex items-center gap-1" title="Store views"><Eye size={12} /> {views}</span>
                            <span className="flex items-center gap-1" title="Sales Count"><ShoppingCart size={12} /> {sales}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button 
                              onClick={() => openListingModal(p)} 
                              className="h-8 px-3 rounded-lg border border-[#cfc1b5] text-[11.5px] font-black text-[#5c514b] bg-white transition hover:border-[#fd761a] hover:text-[#fd761a]"
                              type="button"
                            >
                              <Edit3 size={11} className="inline mr-1" /> Configure
                            </button>
                            {p.publishStatus === "published" ? (
                              <button 
                                onClick={() => unlistProduct(p._id)} 
                                className="h-8 px-3 rounded-lg border border-[#cfc1b5] text-[11.5px] font-black text-amber-700 bg-white transition hover:bg-amber-50"
                                type="button"
                              >
                                Unlist
                              </button>
                            ) : (
                              <button 
                                onClick={() => openListingModal(p)} 
                                className="h-8 px-3 rounded-lg bg-[#3a1100] text-[11.5px] font-black text-white hover:bg-[#fd761a]"
                                type="button"
                              >
                                Publish
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer / Pagination */}
            <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#f5eee8] px-5 py-4 bg-[#faf8f5]">
              <p className="text-[12.5px] font-bold text-[#796d66]">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} listings</p>
              <div className="flex items-center gap-1.5">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-9 w-9 rounded-lg border border-[#cfc1b5] bg-white disabled:opacity-40 flex items-center justify-center hover:border-[#fd761a] transition" type="button">
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`h-9 min-w-[36px] rounded-lg text-[12.5px] font-black transition-all ${
                      page === p ? "bg-[#3a1100] text-white" : "border border-[#cfc1b5] bg-white text-[#5c514b] hover:border-[#fd761a]"
                    }`} type="button">
                    {p}
                  </button>
                ))}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-9 w-9 rounded-lg border border-[#cfc1b5] bg-white disabled:opacity-40 flex items-center justify-center hover:border-[#fd761a] transition" type="button">
                  <ChevronRight size={15} />
                </button>
              </div>
            </footer>
          </div>
        )}

        {/* Catalog Modals */}
        <AnimatePresence>
          {showListingModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#21150f]/50 py-6 px-4 backdrop-blur-[3px]"
            >
              <motion.div 
                initial={{ scale: 0.96, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 15 }}
                className="w-full max-w-4xl rounded-2xl bg-white border border-[#efe5dc] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
              >
                
                {/* Modal Title bar */}
                <header className="flex items-center justify-between border-b border-[#f5eee8] bg-[#faf7f4] px-6 py-4 shrink-0">
                  <div>
                    <h2 className="text-[17px] font-black text-[#3a1100] font-serif">Configure Storefront Product</h2>
                    <p className="text-[11px] font-bold text-[#9a8b82] uppercase mt-0.5">ID: {editingProduct?._id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowPreview(!showPreview)} 
                      className={`h-8 px-3 rounded-lg text-[11.5px] font-black border transition ${
                        showPreview ? "border-[#fd761a] text-[#fd761a] bg-orange-50/30" : "border-[#cfc1b5] text-[#5c514b] hover:bg-gray-50"
                      }`}
                    >
                      {showPreview ? "Hide Preview" : "Live SEO Preview"}
                    </button>
                    <button onClick={() => setShowListingModal(false)} className="h-8 w-8 rounded-lg border border-[#efe5dc] grid place-items-center text-gray-400 hover:text-gray-600 transition" type="button">
                      <X size={16} />
                    </button>
                  </div>
                </header>

                {/* Validation Warnings */}
                {validationErrors.length > 0 && (
                  <div className="bg-rose-50 border-b border-rose-100 px-6 py-3.5 text-[12.5px] font-bold text-rose-700 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1"><AlertTriangle size={14} /> Missing criteria:</span>
                    {validationErrors.map((err, i) => (
                      <span key={i} className="bg-rose-100/50 px-2 py-0.5 rounded text-[11.5px]">{err}</span>
                    ))}
                  </div>
                )}

                {/* Modal Body Container */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#faf9f6]/40">
                  
                  {/* Google SEO Live Preview Block */}
                  {showPreview && (
                    <motion.section 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: "auto", opacity: 1 }} 
                      className="rounded-xl border border-blue-100 bg-blue-50/30 p-5 overflow-hidden"
                    >
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-blue-900 mb-3 flex items-center gap-1.5"><Globe size={13} /> Google Search Preview</h4>
                      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-1 font-sans">
                        <p className="text-[12px] text-gray-500 truncate">https://machinichi.com/product/{listingForm.slug || editingProduct?.slug || "sample-slug"}</p>
                        <p className="text-[17px] font-medium text-[#1a0dab] hover:underline cursor-pointer truncate">{listingForm.metaTitle || listingForm.name || "Machinichi Organic Title"}</p>
                        <p className="text-[13px] text-[#4d5156] leading-relaxed line-clamp-2">{listingForm.metaDescription || listingForm.description || "Fresh and stone-ground organic product details..."}</p>
                      </div>
                    </motion.section>
                  )}

                  {/* SECTION: GENERAL FIELDS */}
                  <div className="bg-white rounded-xl border border-[#efe5dc] p-5 space-y-4">
                    <h3 className="text-[14px] font-black text-[#3a1100] border-b border-[#faf7f4] pb-2 flex items-center gap-2">
                      <Bookmark size={15} className="text-[#fd761a]" /> General Information
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">Product Title *</label>
                        <input value={listingForm.name} onChange={e => updateForm("name", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" required />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">Brand Name *</label>
                        <input value={listingForm.brand} onChange={e => updateForm("brand", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" required />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">Category *</label>
                        <select value={listingForm.category} onChange={e => updateForm("category", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" required>
                          <option value="">Select Category</option>
                          {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">SKU Reference *</label>
                        <input value={listingForm.sku} onChange={e => updateForm("sku", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" required />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">Description *</label>
                        <textarea value={listingForm.description} onChange={e => updateForm("description", e.target.value)} rows={3} className="w-full rounded-xl border border-[#e5d8cd] px-3.5 py-2 text-[13px] outline-none focus:border-[#fd761a]" required />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">Short Summary Description</label>
                        <input value={listingForm.shortDescription} onChange={e => updateForm("shortDescription", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" />
                      </div>
                    </div>
                  </div>

                  {/* SECTION: PRICING & INVENTORY */}
                  <div className="bg-white rounded-xl border border-[#efe5dc] p-5 space-y-4">
                    <h3 className="text-[14px] font-black text-[#3a1100] border-b border-[#faf7f4] pb-2 flex items-center gap-2">
                      <DollarSign size={15} className="text-[#fd761a]" /> Catalog Pricing & Taxation
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">MRP *</label>
                        <input type="number" value={listingForm.mrpPrice} onChange={e => updateForm("mrpPrice", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" required />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">Selling Price *</label>
                        <input type="number" value={listingForm.sellingPrice} onChange={e => updateForm("sellingPrice", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" required />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">GST Rate (%) *</label>
                        <select value={listingForm.gstRate} onChange={e => updateForm("gstRate", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]">
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">HSN Code *</label>
                        <input value={listingForm.hsnCode} onChange={e => updateForm("hsnCode", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" required />
                      </div>
                    </div>
                  </div>

                  {/* SECTION: SEO METADATA */}
                  <div className="bg-white rounded-xl border border-[#efe5dc] p-5 space-y-4">
                    <h3 className="text-[14px] font-black text-[#3a1100] border-b border-[#faf7f4] pb-2 flex items-center gap-2">
                      <Globe size={15} className="text-[#fd761a]" /> SEO & Slug Settings
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">SEO Slug Path</label>
                        <input value={listingForm.slug} onChange={e => updateForm("slug", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" placeholder="product-slug-path" />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">SEO Meta Title</label>
                        <input value={listingForm.metaTitle} onChange={e => updateForm("metaTitle", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">SEO Meta Description</label>
                        <textarea value={listingForm.metaDescription} onChange={e => updateForm("metaDescription", e.target.value)} rows={2} className="w-full rounded-xl border border-[#e5d8cd] px-3.5 py-2 text-[13px] outline-none focus:border-[#fd761a]" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82] mb-1.5">SEO Meta Keywords (comma separated)</label>
                        <input value={listingForm.metaKeywords} onChange={e => updateForm("metaKeywords", e.target.value)} className="h-10 w-full rounded-xl border border-[#e5d8cd] px-3.5 text-[13px] outline-none focus:border-[#fd761a]" placeholder="organic, fresh, atta" />
                      </div>
                    </div>
                  </div>

                  {/* SECTION: IMAGES & MEDIA */}
                  <div className="bg-white rounded-xl border border-[#efe5dc] p-5 space-y-4">
                    <h3 className="text-[14px] font-black text-[#3a1100] border-b border-[#faf7f4] pb-2 flex items-center gap-2">
                      <ImageIcon size={15} className="text-[#fd761a]" /> Primary & Secondary Media
                    </h3>
                    <div className="flex flex-wrap gap-4 items-center">
                      {listingForm.images?.map((img, i) => (
                        <div key={img._key || i} className="relative h-24 w-24 rounded-xl border border-[#efe5dc] overflow-hidden group shadow-sm bg-gray-50">
                          <img src={img.url} alt="" className="h-full w-full object-cover" />
                          {i === 0 && <span className="absolute left-1 top-1 bg-emerald-600 text-white text-[8px] font-black uppercase px-1 py-0.5 rounded">Primary</span>}
                          <button onClick={() => removeImage(img._key)} className="absolute top-1 right-1 h-5 w-5 bg-black/60 rounded-full grid place-items-center text-white opacity-0 group-hover:opacity-100 transition"><X size={10} /></button>
                          {i > 0 && <button onClick={() => setPrimaryImage(img._key)} className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[9px] font-black py-0.5 rounded opacity-0 group-hover:opacity-100 transition" type="button">Set Primary</button>}
                        </div>
                      ))}
                      <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#cfc1b5] hover:border-[#fd761a] text-[#796d66] hover:text-[#fd761a] transition bg-[#faf8f5]">
                        <Upload size={20} />
                        <input type="file" className="hidden" onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const reader = new FileReader();
                            reader.onload = () => { if (reader.result) addImage(reader.result); };
                            reader.readAsDataURL(f);
                          }
                          e.target.value = "";
                        }} />
                      </label>
                    </div>
                  </div>

                  {/* SECTION: PRODUCT VARIANTS */}
                  <div className="bg-white rounded-xl border border-[#efe5dc] p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-[#faf7f4] pb-2">
                      <h3 className="text-[14px] font-black text-[#3a1100] flex items-center gap-2">
                        <Settings size={15} className="text-[#fd761a]" /> Variant Manager
                      </h3>
                      <button onClick={addVariant} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#cfc1b5] bg-white px-3 text-[11px] font-black text-[#5c514b] hover:border-[#fd761a] hover:text-[#fd761a] transition" type="button">
                        <Plus size={12} /> Add Variant
                      </button>
                    </div>

                    <div className="space-y-4">
                      {listingForm.variants?.map((v, index) => (
                        <div key={v._key || index} className="rounded-xl border border-[#efe5dc] bg-[#faf8f5]/40 p-4 relative space-y-3">
                          <button onClick={() => removeVariant(v._key)} className="absolute top-3 right-3 text-[#9a8b82] hover:text-rose-600 transition"><X size={15} /></button>
                          
                          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 pt-1">
                            <div>
                              <label className="block text-[9.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Color</label>
                              <input value={v.color || ""} onChange={e => updateVariant(v._key, "color", e.target.value)} className="h-9 w-full rounded-lg border border-[#e5d8cd] px-2.5 text-[12px] bg-white" placeholder="e.g. Amber" />
                            </div>
                            <div>
                              <label className="block text-[9.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Size</label>
                              <input value={v.size || ""} onChange={e => updateVariant(v._key, "size", e.target.value)} className="h-9 w-full rounded-lg border border-[#e5d8cd] px-2.5 text-[12px] bg-white" placeholder="e.g. 500g" />
                            </div>
                            <div>
                              <label className="block text-[9.5px] font-bold uppercase tracking-wider text-[#9a8b82]">SKU Code</label>
                              <input value={v.sku || ""} onChange={e => updateVariant(v._key, "sku", e.target.value)} className="h-9 w-full rounded-lg border border-[#e5d8cd] px-2.5 text-[12px] bg-white" />
                            </div>
                            <div>
                              <label className="block text-[9.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Quantity</label>
                              <input type="number" value={v.quantity || 0} onChange={e => updateVariant(v._key, "quantity", e.target.value)} className="h-9 w-full rounded-lg border border-[#e5d8cd] px-2.5 text-[12px] bg-white" />
                            </div>
                            <div>
                              <label className="block text-[9.5px] font-bold uppercase tracking-wider text-[#9a8b82]">MRP *</label>
                              <input type="number" value={v.mrpPrice || ""} onChange={e => updateVariant(v._key, "mrpPrice", e.target.value)} className="h-9 w-full rounded-lg border border-[#e5d8cd] px-2.5 text-[12px] bg-white" />
                            </div>
                            <div>
                              <label className="block text-[9.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Selling Price *</label>
                              <input type="number" value={v.sellingPrice || ""} onChange={e => updateVariant(v._key, "sellingPrice", e.target.value)} className="h-9 w-full rounded-lg border border-[#e5d8cd] px-2.5 text-[12px] bg-white" />
                            </div>
                            <div>
                              <label className="block text-[9.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Cost Price</label>
                              <input type="number" value={v.costPrice || ""} onChange={e => updateVariant(v._key, "costPrice", e.target.value)} className="h-9 w-full rounded-lg border border-[#e5d8cd] px-2.5 text-[12px] bg-white" />
                            </div>
                            <div className="flex items-end justify-between">
                              <button onClick={() => duplicateVariant(index)} className="h-9 px-3 rounded-lg border border-[#cfc1b5] text-[11.5px] font-black text-[#5c514b] bg-white hover:bg-gray-50 transition" type="button">Duplicate</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION: MARKETPLACE LINKS */}
                  <div className="bg-white rounded-xl border border-[#efe5dc] p-5 space-y-4">
                    <h3 className="text-[14px] font-black text-[#3a1100] border-b border-[#faf7f4] pb-2 flex items-center gap-2">
                      <Link2 size={15} className="text-[#fd761a]" /> Marketplace Integrations
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {MARKETPLACE_FIELDS.map((m) => (
                        <div key={m} className="flex flex-col gap-1.5 p-3 rounded-xl border border-[#efe5dc] bg-[#faf8f5]/40">
                          <label className="text-[10.5px] font-bold uppercase tracking-wider text-[#796d66] capitalize">{m} Link</label>
                          <input 
                            value={listingForm.marketplaceLinks?.[m] || ""} 
                            onChange={e => {
                              const val = e.target.value;
                              setListingForm(prev => ({
                                ...prev,
                                marketplaceLinks: { ...prev.marketplaceLinks, [m]: val }
                              }));
                            }} 
                            className="h-9 w-full rounded-lg border border-[#e5d8cd] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#fd761a]" 
                            placeholder={`https://${m}.com/...`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Modal actions Footer */}
                <footer className="border-t border-[#f5eee8] bg-[#faf7f4] px-6 py-4 flex justify-between items-center shrink-0">
                  <div className="flex gap-2">
                    <button 
                      onClick={saveDraft} 
                      disabled={saving} 
                      className="inline-flex h-11 items-center gap-1 px-4 rounded-xl border border-[#efe5dc] bg-white text-[12px] font-black text-[#5c514b] hover:bg-gray-50"
                    >
                      <Save size={13} /> Save Draft
                    </button>
                  </div>
                  <div className="flex gap-2.5">
                    <button onClick={() => setShowListingModal(false)} className="h-11 px-5 rounded-xl border border-[#efe5dc] bg-white text-[12px] font-black text-[#5c514b]" type="button">Cancel</button>
                    <button 
                      onClick={publishProduct} 
                      disabled={saving} 
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#3a1100] hover:bg-[#fd761a] px-6 text-[12px] font-black text-white transition disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Publish Live
                    </button>
                  </div>
                </footer>

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AdminLayout>
  );
}
