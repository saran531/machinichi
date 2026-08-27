import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Barcode,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  ImageIcon,
  Loader2,
  PackagePlus,
  PlusCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
  Check,
  AlertTriangle,
  ArrowUpDown,
  DollarSign,
  Package
} from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AdminLayout from "../components/AdminLayout";

const API = axios.create({ baseURL: "http://localhost:5000/api", withCredentials: true });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const perPageOptions = [10, 20, 50];

const emptyProductForm = {
  name: "", sku: "", hsnCode: "", brand: "", category: "", stock: "",
  mrpPrice: "", sellingPrice: "", description: "", image: "",
};

export default function Inventory({ onAdminLogout }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [isPerPageOpen, setIsPerPageOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyProductForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQty, setRestockQty] = useState("");
  const [deleteProduct, setDeleteProduct] = useState(null);

  const fetchProducts = async (page = currentPage) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page, limit: perPage });
      if (searchTerm) params.set("search", searchTerm);
      const { data } = await API.get(`/admin/inventory?${params}`);
      if (data.success) {
        setProducts(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load inventory");
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const { data } = await API.get("/categories");
      if (data.success) setCategories(data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchCategories(); }, []);
  
  // Debounce search term changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setCurrentPage(1);
      fetchProducts(1);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    fetchProducts();
  }, [currentPage, perPage]);

  const silentFetchRef = useRef(fetchProducts);
  silentFetchRef.current = fetchProducts;
  useEffect(() => {
    const interval = setInterval(() => silentFetchRef.current(currentPage), 15000);
    return () => clearInterval(interval);
  }, [currentPage, perPage]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyProductForm);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      sku: product.sku || "",
      hsnCode: product.hsnCode || "",
      brand: product.brand || "",
      category: product.category?._id || "",
      stock: product.quantity ?? "",
      mrpPrice: product.mrpPrice ?? "",
      sellingPrice: product.sellingPrice ?? "",
      description: product.description || "",
      image: product.images?.[0]?.url || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.sku.trim() || !form.category) {
      setFormError("Product Name, SKU, and Category are required");
      return;
    }
    setSaving(true); setFormError("");
    try {
      const catName = categories.find(c => c._id === form.category)?.name || "General";
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        hsnCode: form.hsnCode.trim() || "0000",
        brand: form.brand.trim() || "Machinichi",
        category: form.category,
        description: form.description.trim() || `${form.name.trim()} - Premium quality product`,
        mrpPrice: Number(form.mrpPrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        quantity: Number(form.stock) || 0,
        unitType: "Kilogram",
        images: form.image ? [{ url: form.image, alt: form.name, isPrimary: true, order: 0 }] : [],
        tags: [catName.toLowerCase()],
      };
      if (editingId) {
        await API.put(`/admin/products/${editingId}`, payload);
      } else {
        await API.post("/admin/products", payload);
      }
      setShowModal(false);
      fetchProducts(currentPage);
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save product");
    }
    setSaving(false);
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    const qty = Number(restockQty);
    if (!restockProduct || !qty || qty <= 0) return;
    try {
      const currentStock = restockProduct.quantity || 0;
      await API.patch(`/admin/products/${restockProduct._id}/inventory`, { quantity: currentStock + qty, note: `Restocked +${qty}` });
      setRestockProduct(null); setRestockQty("");
      fetchProducts(currentPage);
    } catch (err) { alert(err.response?.data?.message || "Restock failed"); }
  };

  const confirmDelete = async () => {
    if (!deleteProduct) return;
    try {
      await API.delete(`/admin/products/${deleteProduct._id}`);
      setDeleteProduct(null);
      fetchProducts(currentPage);
    } catch (err) { alert(err.response?.data?.message || "Delete failed"); }
  };

  const handleImageUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (reader.result) setForm(p => ({ ...p, image: reader.result })); };
    reader.readAsDataURL(file);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (categoryFilter && p.category?._id !== categoryFilter) return false;
      if (statusFilter === "low" && (p.quantity > 10 || p.isLowStock)) return false;
      if (statusFilter === "out" && p.quantity > 0) return false;
      return true;
    });
  }, [products, categoryFilter, statusFilter]);

  // Inventory Dashboard Analytics
  const metrics = useMemo(() => {
    const totalSKUs = products.length;
    const lowStockCount = products.filter(p => p.quantity <= 10 && p.quantity > 0).length;
    const outOfStockCount = products.filter(p => p.quantity === 0).length;
    const totalValuation = products.reduce((sum, p) => sum + (p.sellingPrice || 0) * (p.quantity || 0), 0);

    return { totalSKUs, lowStockCount, outOfStockCount, totalValuation };
  }, [products]);

  const safePage = Math.min(currentPage, totalPages);
  const showingStart = filteredProducts.length ? (safePage - 1) * perPage + 1 : 0;
  const showingEnd = Math.min(safePage * perPage, filteredProducts.length);

  return (
    <AdminLayout onAdminLogout={onAdminLogout}>
      <div className="min-h-screen bg-[#faf9f6] text-[#21150f] px-5 py-8 sm:px-8 lg:px-10">
        
        {/* Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-black tracking-tight text-[#3a1100] font-serif">Inventory Management</h1>
            <p className="mt-1.5 text-[13.5px] font-semibold text-[#796d66]">Monitor products and update real-time stock levels</p>
          </div>
          <button 
            onClick={openAddModal} 
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#fd761a] px-6 text-[13px] font-black text-white shadow-[0_4px_12px_rgba(253,118,26,0.15)] transition hover:bg-[#e86710] hover:-translate-y-0.5" 
            type="button"
          >
            <PlusCircle size={15} /> Add New Product
          </button>
        </header>

        {/* Analytics row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
          {[
            { label: "Total SKUs", val: metrics.totalSKUs, color: "text-[#3a1100] bg-white border-[#efe5dc]", icon: Package },
            { label: "Out of Stock", val: metrics.outOfStockCount, color: "text-rose-700 bg-rose-50/40 border-rose-100", icon: AlertTriangle },
            { label: "Low Stock Alert", val: metrics.lowStockCount, color: "text-amber-700 bg-amber-50/40 border-amber-100", icon: SlidersHorizontal },
            { label: "Valuation (Current Page)", val: `₹${metrics.totalValuation.toLocaleString("en-IN")}`, color: "text-emerald-700 bg-emerald-50/40 border-emerald-100", icon: DollarSign }
          ].map((m, i) => {
            const Icon = m.icon;
            return (
              <div key={i} className={`rounded-2xl border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.015)] ${m.color}`}>
                <div className="flex justify-between items-center opacity-80">
                  <span className="text-[11px] font-bold uppercase tracking-wider">{m.label}</span>
                  <Icon size={14} />
                </div>
                <p className="mt-2.5 text-[22px] font-black tracking-tight font-serif sm:text-[26px]">
                  {m.val}
                </p>
              </div>
            );
          })}
        </div>

        {/* Search, Filter bar */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#efe5dc] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.015)] sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
            <input 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              placeholder="Search by name, SKU..." 
              className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] pl-10 pr-4 text-[13px] text-[#211713] outline-none placeholder:text-[#9a8b82] transition focus:border-[#fd761a] focus:bg-white" 
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={categoryFilter} 
              onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }} 
              className="h-10 rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[12.5px] font-black text-[#5c514b] outline-none transition focus:border-[#fd761a]"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select 
              value={statusFilter} 
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} 
              className="h-10 rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[12.5px] font-black text-[#5c514b] outline-none transition focus:border-[#fd761a]"
            >
              <option value="">All Stock Status</option>
              <option value="low">Low Stock (≤10)</option>
              <option value="out">Out of Stock (0)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3.5 text-[13px] font-semibold text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => fetchProducts()} className="underline font-bold" type="button">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={30} className="animate-spin text-[#fd761a]" />
              <p className="text-[12.5px] font-bold text-[#796d66]">Fetching records...</p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-[#efe5dc] bg-white px-8 py-20 text-center shadow-sm">
            <Archive size={42} className="mx-auto text-[#c7bab0] mb-4" />
            <h3 className="text-[17px] font-black text-[#3a1100] font-serif">No products found</h3>
            <p className="mt-1 text-[13px] text-[#796d66]">No products matching the selected filters are in your database.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#efe5dc] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.015)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse">
                <thead className="bg-[#faf8f5] text-[10.5px] font-black uppercase tracking-wider text-[#9a8b82] border-b border-[#efe5dc]">
                  <tr>
                    <th className="px-5 py-4 w-16">Image</th>
                    <th className="px-5 py-4">Product Name</th>
                    <th className="px-5 py-4">SKU / Code</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Store Price</th>
                    <th className="px-5 py-4">Stock Level</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f5eee8] bg-white text-[13.5px]">
                  {filteredProducts.map((product) => {
                    const isOut = (product.quantity || 0) === 0;
                    const isLow = (product.quantity || 0) <= 10 && !isOut;

                    return (
                      <tr key={product._id} className="transition hover:bg-[#fffcf9]/40">
                        <td className="px-5 py-4">
                          <div className="h-12 w-12 rounded-lg border border-[#efe5dc] bg-[#faf7f4] overflow-hidden shrink-0">
                            {product.images?.[0]?.url ? (
                              <img src={product.images[0].url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon size={16} className="m-auto text-gray-300" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-[#3a1100]">{product.name}</p>
                          <p className="text-[11px] font-semibold text-[#9a8b82] mt-0.5">{product.brand || "Machinichi"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-[#796d66] bg-gray-50 border border-gray-100 rounded px-2 py-0.5 w-fit">
                            <Barcode size={11} /> {product.sku}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[#5c514b]">
                          {product.category?.name || "General"}
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-black text-[#211713]">₹{Number(product.sellingPrice || 0).toLocaleString("en-IN")}</span>
                          {product.mrpPrice > product.sellingPrice && (
                            <span className="ml-1.5 text-[11px] text-[#9a8b82] line-through">₹{Number(product.mrpPrice).toLocaleString("en-IN")}</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`font-black ${isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-emerald-700"}`}>
                              {product.quantity || 0}
                            </span>
                            <div className="h-1.5 w-20 rounded-full bg-[#f0e9e2] overflow-hidden hidden sm:block">
                              <div className={`h-full rounded-full ${isOut ? "bg-rose-500" : isLow ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(100, (product.quantity || 0) * 10)}%` }} />
                            </div>
                            {isOut && <span className="rounded bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase text-rose-700 border border-rose-100">Out</span>}
                            {isLow && <span className="rounded bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700 border border-amber-100">Low</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => openEditModal(product)} className="h-8 px-3 rounded-lg border border-[#cfc1b5] text-[11.5px] font-black text-[#5c514b] bg-white transition hover:border-[#fd761a] hover:text-[#fd761a]" type="button">
                              <Edit3 size={11} className="inline mr-1" /> Edit
                            </button>
                            <button onClick={() => setRestockProduct(product)} className="h-8 px-3 rounded-lg border border-[#cfc1b5] text-[11.5px] font-black text-[#5c514b] bg-white transition hover:border-emerald-600 hover:text-emerald-600" type="button">
                              <RefreshCw size={11} className="inline mr-1" /> Restock
                            </button>
                            <button onClick={() => setDeleteProduct(product)} className="h-8 px-3 rounded-lg border border-rose-100 text-[11.5px] font-black text-rose-600 bg-white transition hover:bg-rose-50 hover:border-rose-300" type="button">
                              <Trash2 size={11} className="inline mr-1" /> Delete
                            </button>
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
              <p className="text-[12px] font-bold text-[#796d66]">Showing {showingStart}–{showingEnd} of {total} SKUs</p>
              <div className="flex items-center gap-1.5">
                <button disabled={safePage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="h-9 w-9 rounded-lg border border-[#cfc1b5] bg-white disabled:opacity-40 flex items-center justify-center hover:border-[#fd761a]" type="button">
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    className={`h-9 min-w-[36px] rounded-lg text-[12.5px] font-black transition-all ${
                      safePage === p ? "bg-[#3a1100] text-white" : "border border-[#cfc1b5] bg-white text-[#5c514b] hover:border-[#fd761a]"
                    }`} type="button">
                    {p}
                  </button>
                ))}
                <button disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-9 w-9 rounded-lg border border-[#cfc1b5] bg-white disabled:opacity-40 flex items-center justify-center hover:border-[#fd761a]" type="button">
                  <ChevronRight size={15} />
                </button>
              </div>
            </footer>
          </div>
        )}

        {/* Modal: Add/Edit Product */}
        <AnimatePresence>
          {showModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#21150f]/50 py-8 px-4 backdrop-blur-[3px]"
              onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
            >
              <motion.form 
                initial={{ scale: 0.96, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 15 }}
                onSubmit={saveProduct} 
                className="w-full max-w-2xl rounded-2xl bg-white border border-[#efe5dc] shadow-2xl p-6 overflow-y-auto max-h-[90vh]"
              >
                <div className="flex items-center justify-between mb-5 border-b border-[#f5eee8] pb-4">
                  <h2 className="text-[18px] font-black text-[#3a1100] font-serif">{editingId ? "Edit Product Details" : "Add New SKU to Inventory"}</h2>
                  <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-lg border border-[#efe5dc] grid place-items-center text-gray-400 hover:text-gray-600 transition" type="button">
                    <X size={16} />
                  </button>
                </div>
                
                {formError && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[12.5px] font-bold text-rose-700">{formError}</div>}
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Product Name *</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">SKU Code *</label>
                    <input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Brand Name</label>
                    <input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Category *</label>
                    <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" required>
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">HSN Code</label>
                    <input value={form.hsnCode} onChange={e => setForm(p => ({ ...p, hsnCode: e.target.value }))} className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Stock Quantity *</label>
                    <input type="number" min="0" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">MRP (Maximum Retail Price) *</label>
                    <input type="number" min="0" step="0.01" value={form.mrpPrice} onChange={e => setForm(p => ({ ...p, mrpPrice: e.target.value }))} className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Selling Price *</label>
                    <input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={e => setForm(p => ({ ...p, sellingPrice: e.target.value }))} className="h-10 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Product Description</label>
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-3.5 py-2 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-wider text-[#9a8b82]">Product Image</label>
                    <div className="flex items-center gap-4">
                      {form.image && (
                        <div className="relative h-20 w-20 rounded-xl border border-[#efe5dc] overflow-hidden shadow-sm">
                          <img src={form.image} alt="" className="h-full w-full object-cover" />
                          <button onClick={() => setForm(p => ({ ...p, image: "" }))} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 grid place-items-center text-white" type="button">
                            <X size={10} />
                          </button>
                        </div>
                      )}
                      <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#cfc1b5] hover:border-[#fd761a] text-[#796d66] hover:text-[#fd761a] transition-all bg-[#faf8f5]">
                        <Upload size={18} />
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end gap-3 border-t border-[#f5eee8] pt-4">
                  <button onClick={() => setShowModal(false)} type="button" className="h-11 rounded-xl border border-[#efe5dc] bg-white px-5 text-[12px] font-black text-[#5c514b]">Cancel</button>
                  <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#3a1100] hover:bg-[#fd761a] px-6 text-[12px] font-black text-white transition disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {editingId ? "Save Changes" : "Create Product"}
                  </button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Restock Product */}
        <AnimatePresence>
          {restockProduct && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 grid place-items-center bg-[#21150f]/50 px-4 backdrop-blur-[3px]"
              onClick={e => { if (e.target === e.currentTarget) setRestockProduct(null); }}
            >
              <motion.form 
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onSubmit={handleRestock} 
                className="w-full max-w-md rounded-2xl bg-white border border-[#efe5dc] shadow-2xl p-6"
              >
                <h3 className="text-[17px] font-black text-[#3a1100] font-serif">Quick Restock</h3>
                <p className="text-[13px] text-[#796d66] mt-1.5 mb-4">
                  Adjust inventory for <strong>{restockProduct.name}</strong>.<br />
                  Current Quantity: <span className="font-bold text-[#3a1100]">{restockProduct.quantity || 0}</span> units
                </p>
                <input 
                  type="number" 
                  min="1" 
                  value={restockQty} 
                  onChange={e => setRestockQty(e.target.value)} 
                  placeholder="Enter positive stock increment quantity (e.g. 50)" 
                  className="h-11 w-full rounded-xl border border-[#e5d8cd] bg-[#fdfbf9] px-4 text-[13px] outline-none focus:border-[#fd761a] focus:bg-white" 
                  required 
                  autoFocus
                />
                <div className="mt-5 flex justify-end gap-2.5 border-t border-[#f5eee8] pt-4">
                  <button onClick={() => setRestockProduct(null)} type="button" className="h-10 rounded-xl border border-[#efe5dc] bg-white px-4 text-[12px] font-black text-[#5c514b]">Cancel</button>
                  <button type="submit" className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 text-[12px] font-black text-white shadow-sm transition">Add Stock</button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Delete Confirmation */}
        <AnimatePresence>
          {deleteProduct && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 grid place-items-center bg-[#21150f]/50 px-4 backdrop-blur-[3px]"
              onClick={e => { if (e.target === e.currentTarget) setDeleteProduct(null); }}
            >
              <motion.div 
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="w-full max-w-md rounded-2xl bg-white border border-[#efe5dc] shadow-2xl p-6"
              >
                <h3 className="text-[17px] font-black text-rose-600 font-serif">Remove Product?</h3>
                <p className="text-[13px] text-[#796d66] mt-2 mb-4 leading-relaxed">
                  Are you sure you want to delete <strong>{deleteProduct.name}</strong>? This will permanently erase the product from both inventory and catalog.
                </p>
                <div className="flex justify-end gap-2.5 border-t border-[#f5eee8] pt-4">
                  <button onClick={() => setDeleteProduct(null)} className="h-10 rounded-xl border border-[#efe5dc] bg-white px-4 text-[12px] font-black text-[#5c514b]" type="button">Cancel</button>
                  <button onClick={confirmDelete} className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 px-5 text-[12px] font-black text-white shadow-sm transition" type="button">Delete SKU</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AdminLayout>
  );
}
