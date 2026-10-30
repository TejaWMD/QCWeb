import React, { useState, useEffect, useMemo } from 'react';
import {
  Product,
  ProductInput,
  ProductSettings,
  Machine,
  Recipe,
} from '@/types/product';
import {
  productService,
  calculateProductDerivedFields,
  cleanBarcode,
} from '@/services/productService';
import {
  Plus,
  Search,
  Upload,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './PicProductEntry.css';

const BLANK_FORM: ProductInput = {
  product_code: '',
  product_name: '',
  brand: '',
  recipe_name: '',
  cooking_time_hr: 0,
  batch_output_kg: 0,
  carton_size: 0,
  net_weight_kg: 0,
  line_type: '',
  default_machine: '',
  batch_prefix: '',
  shelf_life_months: 12,
  barcode: '',
  carton_barcode: '',
  customer: 'GENERAL',
  status: 'Active',
  remarks: '',
};

export default function PicProductEntry() {
  const [products, setProducts] = useState<Product[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<ProductSettings>({
    key: 'product_master',
    brands: [],
    channels: [],
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductInput>(BLANK_FORM);
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importing, setImporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productList, machineList, recipeList, settingDoc] = await Promise.all([
        productService.getAllProducts().catch(() => []),
        productService.getMachines().catch(() => []),
        productService.getRecipes().catch(() => []),
        productService.getProductSettings().catch(() => ({
          key: 'product_master',
          brands: [],
          channels: [],
        })),
      ]);
      setProducts(productList);
      setMachines(machineList);
      setRecipes(recipeList);
      setSettings(settingDoc);
    } catch (err: any) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const s = search.toLowerCase().trim();
    return products.filter((p) => {
      if (p.deleted) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (!s) return true;
      return (
        p.product_code?.toLowerCase().includes(s) ||
        p.product_name?.toLowerCase().includes(s) ||
        p.brand?.toLowerCase().includes(s) ||
        p.barcode?.includes(s) ||
        p.carton_barcode?.includes(s)
      );
    });
  }, [products, search, statusFilter]);

  // Derived calculations for the active form
  const derivedCalculations = useMemo(() => {
    return calculateProductDerivedFields(formData);
  }, [
    formData.carton_size,
    formData.net_weight_kg,
    formData.batch_output_kg,
    formData.shelf_life_months,
    formData.cooking_time_hr,
  ]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData(BLANK_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      product_code: p.product_code,
      product_name: p.product_name,
      brand: p.brand || '',
      recipe_name: p.recipe_name || '',
      cooking_time_hr: p.cooking_time_hr || 0,
      batch_output_kg: p.batch_output_kg || 0,
      carton_size: p.carton_size || 0,
      net_weight_kg: p.net_weight_kg || 0,
      line_type: p.line_type || '',
      default_machine: p.default_machine || '',
      batch_prefix: p.batch_prefix || '',
      shelf_life_months: p.shelf_life_months || 12,
      barcode: p.barcode || '',
      carton_barcode: p.carton_barcode || '',
      customer: p.customer || 'GENERAL',
      status: p.status || 'Active',
      remarks: p.remarks || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormChange = (field: keyof ProductInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.product_code.trim()) {
      setFormError('Item Code is required.');
      return;
    }
    if (!formData.product_name.trim()) {
      setFormError('Carton Description is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate uniqueness against Supabase
      const barcodes = [formData.barcode, formData.carton_barcode].filter(Boolean) as string[];
      const validation = await productService.validateProductUnique(
        formData.product_code,
        barcodes,
        editingProduct?.id
      );

      if (!validation.valid) {
        setFormError(validation.message || 'Validation failed.');
        setIsSubmitting(false);
        return;
      }

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, formData);
      } else {
        await productService.createProduct(formData);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product in database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    const nextStatus = product.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await productService.updateProduct(product.id, { status: nextStatus });
      await loadData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to delete ${product.product_code}?`)) return;
    try {
      await productService.softDeleteProduct(product.id, 'PIC');
      await loadData();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  // Bulk Excel/CSV upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus('Reading spreadsheet file...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        setImportStatus('Spreadsheet is empty or could not be read.');
        setImporting(false);
        return;
      }

      setImportStatus(`Processing ${rawRows.length} rows...`);

      // Map rows loosely to product properties
      const mappedProducts: ProductInput[] = rawRows
        .map((r) => {
          const code = r['Item Code'] || r['Product Code'] || r['code'] || r['product_code'];
          const desc = r['Carton Description'] || r['Description'] || r['product_name'] || r['Product Name'];
          if (!code || !desc) return null;

          return {
            product_code: String(code).trim().toUpperCase(),
            product_name: String(desc).trim(),
            brand: String(r['Brand'] || r['brand'] || '').trim(),
            recipe_name: String(r['Recipe Name'] || r['recipe_name'] || '').trim(),
            cooking_time_hr: Number(r['Cooking Time (hr)'] || r['cooking_time_hr']) || 0,
            batch_output_kg: Number(r['Batch Output (kg)'] || r['batch_output_kg']) || 0,
            carton_size: Number(r['Pcs per Carton'] || r['carton_size']) || 0,
            net_weight_kg: Number(r['Net Weight per Pc (kg)'] || r['net_weight_kg']) || 0,
            line_type: String(r['Line Type'] || r['line_type'] || '').trim(),
            default_machine: String(r['Default Machine'] || r['default_machine'] || '').trim(),
            batch_prefix: String(r['Batch Code'] || r['batch_prefix'] || '').trim(),
            shelf_life_months: Number(r['Shelf Life (Months)'] || r['shelf_life_months']) || 12,
            barcode: cleanBarcode(String(r['SKU Barcode'] || r['barcode'] || '')),
            carton_barcode: cleanBarcode(String(r['Carton Barcode'] || r['carton_barcode'] || '')),
            customer: String(r['Customer'] || r['customer'] || 'GENERAL').trim().toUpperCase(),
            status: 'Active',
            remarks: String(r['Remarks'] || r['remarks'] || ''),
          } as ProductInput;
        })
        .filter(Boolean) as ProductInput[];

      if (mappedProducts.length === 0) {
        setImportStatus('No valid product rows found with Item Code & Description.');
        setImporting(false);
        return;
      }

      setImportStatus(`Saving ${mappedProducts.length} products to Supabase...`);
      const res = await productService.bulkUpsertProducts(mappedProducts);
      setImportStatus(`Success! Imported and updated ${res.count} products into Supabase.`);
      await loadData();
    } catch (err: any) {
      console.error('Import error:', err);
      setImportStatus(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  const totalActive = products.filter((p) => !p.deleted && p.status === 'Active').length;
  const totalInactive = products.filter((p) => !p.deleted && p.status === 'Inactive').length;

  return (
    <div className="pic-container">
      {/* Top Header */}
      <div className="pic-header">
        <div className="pic-title-group">
          <h1>
            PIC Product Management
            <span className="pic-title-badge">Supabase Live</span>
          </h1>
          <p>Direct entry, real-time formula calculations, and instant database updates</p>
        </div>
        <div className="pic-actions">
          <button className="pic-btn-primary" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <button className="pic-btn-secondary" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="w-4 h-4" /> Bulk Excel Import
          </button>
          <button className="pic-btn-secondary" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="pic-stats-grid">
        <div className="pic-stat-card">
          <div>
            <div className="pic-stat-label">Total Products</div>
            <div className="pic-stat-value">{products.filter((p) => !p.deleted).length}</div>
          </div>
          <FileSpreadsheet className="w-8 h-8 text-cyan-400 opacity-60" />
        </div>
        <div className="pic-stat-card">
          <div>
            <div className="pic-stat-label">Active on Floor</div>
            <div className="pic-stat-value" style={{ color: '#10b981' }}>
              {totalActive}
            </div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-60" />
        </div>
        <div className="pic-stat-card">
          <div>
            <div className="pic-stat-label">Inactive / Archived</div>
            <div className="pic-stat-value" style={{ color: '#94a3b8' }}>
              {totalInactive}
            </div>
          </div>
          <AlertTriangle className="w-8 h-8 text-slate-400 opacity-60" />
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="pic-toolbar">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '10px' }} />
          <input
            type="text"
            className="pic-search-input"
            style={{ paddingLeft: '32px' }}
            placeholder="Search by code, description, brand, barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#a0aec0', fontWeight: 600 }}>STATUS:</span>
          {(['All', 'Active', 'Inactive'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={statusFilter === st ? 'pic-btn-primary' : 'pic-btn-secondary'}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="pic-table-card">
        <div className="pic-table-wrapper">
          <table className="pic-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Carton Description</th>
                <th>Brand</th>
                <th>Pcs / Ctn</th>
                <th>Net Wt (kg)</th>
                <th>Net Filling (kg)</th>
                <th>Ctns / Batch</th>
                <th>Line / Machine</th>
                <th>Barcodes (SKU / Carton)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: '#a0aec0' }}>
                    {loading ? 'Loading products from Supabase...' : 'No products found. Click "+ Add Product" or "Bulk Excel Import" above.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: '#00e5ff' }}>{p.product_code}</td>
                    <td style={{ maxWidth: '240px', wordBreak: 'break-word' }}>{p.product_name}</td>
                    <td>{p.brand || '—'}</td>
                    <td>{p.carton_size || '—'}</td>
                    <td>{p.net_weight_kg ? `${p.net_weight_kg} kg` : '—'}</td>
                    <td style={{ color: '#00e5ff', fontWeight: 600 }}>
                      {p.net_filling_kg ? `${p.net_filling_kg} kg` : '—'}
                    </td>
                    <td style={{ color: '#38bdf8', fontWeight: 600 }}>{p.cartons_per_batch || '—'}</td>
                    <td>{p.default_machine || p.line_type || '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {p.barcode && <div>SKU: {p.barcode}</div>}
                      {p.carton_barcode && <div>CTN: {p.carton_barcode}</div>}
                      {!p.barcode && !p.carton_barcode && '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(p)}
                        className={p.status === 'Active' ? 'pic-status-active' : 'pic-status-inactive'}
                        style={{ border: 'none', cursor: 'pointer' }}
                        title="Click to toggle status"
                      >
                        {p.status || 'Active'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="pic-btn-secondary"
                        style={{ padding: '0.35rem 0.5rem', marginRight: '0.5rem' }}
                        title="Edit Product"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="pic-btn-danger"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Entry / Edit Dialog */}
      {isModalOpen && (
        <div className="pic-modal-overlay">
          <div className="pic-modal-content">
            <div className="pic-modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                {editingProduct ? `Edit ${editingProduct.product_code}` : 'Add New Product to Supabase'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
              <div className="pic-modal-body">
                {formError && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#fca5a5',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    {formError}
                  </div>
                )}

                {/* Section 1: Basic Identifiers */}
                <div className="pic-form-grid">
                  <div className="pic-field-group">
                    <label className="pic-field-label">Item Code (Unique) *</label>
                    <input
                      type="text"
                      className="pic-field-input"
                      placeholder="e.g. PRD-KCP-001"
                      value={formData.product_code}
                      onChange={(e) => handleFormChange('product_code', e.target.value)}
                      required
                    />
                  </div>
                  <div className="pic-field-group">
                    <label className="pic-field-label">Carton Description *</label>
                    <input
                      type="text"
                      className="pic-field-input"
                      placeholder="e.g. Kicap Manis 340g (24 pcs)"
                      value={formData.product_name}
                      onChange={(e) => handleFormChange('product_name', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="pic-form-grid">
                  <div className="pic-field-group">
                    <label className="pic-field-label">Brand</label>
                    <input
                      type="text"
                      className="pic-field-input"
                      placeholder="e.g. Brand A"
                      value={formData.brand}
                      onChange={(e) => handleFormChange('brand', e.target.value)}
                    />
                  </div>
                  <div className="pic-field-group">
                    <label className="pic-field-label">Customer / Channel</label>
                    <input
                      type="text"
                      className="pic-field-input"
                      placeholder="e.g. GENERAL, OEM"
                      value={formData.customer}
                      onChange={(e) => handleFormChange('customer', e.target.value)}
                    />
                  </div>
                </div>

                {/* Section 2: Weight & Carton Specifications (Triggers Auto-Calculation) */}
                <div className="pic-form-grid pic-form-grid-3">
                  <div className="pic-field-group">
                    <label className="pic-field-label">Pcs Per Carton *</label>
                    <input
                      type="number"
                      step="any"
                      className="pic-field-input"
                      placeholder="e.g. 24"
                      value={formData.carton_size || ''}
                      onChange={(e) => handleFormChange('carton_size', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="pic-field-group">
                    <label className="pic-field-label">Net Wt Per Pc (kg) *</label>
                    <input
                      type="number"
                      step="any"
                      className="pic-field-input"
                      placeholder="e.g. 0.340"
                      value={formData.net_weight_kg || ''}
                      onChange={(e) => handleFormChange('net_weight_kg', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="pic-field-group">
                    <label className="pic-field-label">Batch Output (kg)</label>
                    <input
                      type="number"
                      step="any"
                      className="pic-field-input"
                      placeholder="e.g. 1000"
                      value={formData.batch_output_kg || ''}
                      onChange={(e) => handleFormChange('batch_output_kg', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* LIVE AUTOMATIC CALCULATION PANEL */}
                <div className="pic-calc-box">
                  <div className="pic-calc-item">
                    <span className="pic-calc-label">Net Filling (kg/Carton)</span>
                    <span className="pic-calc-val">{derivedCalculations.net_filling_kg} kg</span>
                  </div>
                  <div className="pic-calc-item">
                    <span className="pic-calc-label">Cartons Per Batch</span>
                    <span className="pic-calc-val">{derivedCalculations.cartons_per_batch}</span>
                  </div>
                  <div className="pic-calc-item">
                    <span className="pic-calc-label">Target Net Wt (g)</span>
                    <span className="pic-calc-val">{derivedCalculations.target_net_weight_g} g</span>
                  </div>
                  <div className="pic-calc-item">
                    <span className="pic-calc-label">Cook Time (Minutes)</span>
                    <span className="pic-calc-val">{derivedCalculations.cooking_time_min} mins</span>
                  </div>
                </div>

                {/* Section 3: Recipe & Processing Parameters */}
                <div className="pic-form-grid pic-form-grid-3">
                  <div className="pic-field-group">
                    <label className="pic-field-label">Recipe Name</label>
                    <input
                      type="text"
                      className="pic-field-input"
                      placeholder="e.g. Standard Kicap Recipe"
                      value={formData.recipe_name}
                      onChange={(e) => handleFormChange('recipe_name', e.target.value)}
                    />
                  </div>
                  <div className="pic-field-group">
                    <label className="pic-field-label">Cooking Time (hr)</label>
                    <input
                      type="number"
                      step="any"
                      className="pic-field-input"
                      placeholder="e.g. 1.5"
                      value={formData.cooking_time_hr || ''}
                      onChange={(e) => handleFormChange('cooking_time_hr', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="pic-field-group">
                    <label className="pic-field-label">Batch Code Prefix</label>
                    <input
                      type="text"
                      className="pic-field-input"
                      placeholder="e.g. KCP"
                      maxLength={5}
                      value={formData.batch_prefix}
                      onChange={(e) => handleFormChange('batch_prefix', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                {/* Section 4: Machine, Line & Barcodes */}
                <div className="pic-form-grid">
                  <div className="pic-field-group">
                    <label className="pic-field-label">Default Machine</label>
                    <input
                      type="text"
                      className="pic-field-input"
                      placeholder="e.g. Line 1 Filler"
                      value={formData.default_machine}
                      onChange={(e) => handleFormChange('default_machine', e.target.value)}
                    />
                  </div>
                  <div className="pic-field-group">
                    <label className="pic-field-label">Shelf Life (Months)</label>
                    <input
                      type="number"
                      className="pic-field-input"
                      placeholder="e.g. 12"
                      value={formData.shelf_life_months || ''}
                      onChange={(e) => handleFormChange('shelf_life_months', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="pic-form-grid">
                  <div className="pic-field-group">
                    <label className="pic-field-label">SKU Barcode (Piece)</label>
                    <input
                      type="text"
                      className="pic-field-input"
                      placeholder="Scanned piece barcode"
                      value={formData.barcode}
                      onChange={(e) => handleFormChange('barcode', e.target.value)}
                    />
                  </div>
                  <div className="pic-field-group">
                    <label className="pic-field-label">Carton Barcode (Box)</label>
                    <input
                      type="text"
                      className="pic-field-input"
                      placeholder="Scanned outer box barcode"
                      value={formData.carton_barcode}
                      onChange={(e) => handleFormChange('carton_barcode', e.target.value)}
                    />
                  </div>
                </div>

                <div className="pic-field-group">
                  <label className="pic-field-label">Remarks / Special Notes</label>
                  <input
                    type="text"
                    className="pic-field-input"
                    placeholder="Any manufacturing or packaging remarks..."
                    value={formData.remarks}
                    onChange={(e) => handleFormChange('remarks', e.target.value)}
                  />
                </div>
              </div>

              <div className="pic-modal-footer">
                <button
                  type="button"
                  className="pic-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pic-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving to Supabase...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Excel / CSV Import Modal */}
      {isImportModalOpen && (
        <div className="pic-modal-overlay">
          <div className="pic-modal-content" style={{ maxWidth: '540px' }}>
            <div className="pic-modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                Bulk Excel / CSV Datasheet Import
              </h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pic-modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
              <div
                style={{
                  border: '2px dashed #2d3748',
                  borderRadius: '0.5rem',
                  padding: '2rem',
                  background: 'rgba(0, 229, 255, 0.02)',
                }}
              >
                <Upload className="w-12 h-12 text-cyan-400 mx-auto mb-3 opacity-80" />
                <p style={{ color: '#ffffff', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Select or drop your Product Datasheet (.xlsx, .xls, .csv)
                </p>
                <p style={{ fontSize: '0.8rem', color: '#a0aec0', marginBottom: '1.5rem' }}>
                  Auto-calculates net filling, cartons per batch, and upserts directly into Supabase.
                </p>
                <input
                  type="file"
                  id="excelUploadInput"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={importing}
                />
                <label
                  htmlFor="excelUploadInput"
                  className="pic-btn-primary"
                  style={{ cursor: importing ? 'wait' : 'pointer' }}
                >
                  {importing ? 'Processing File...' : 'Choose Spreadsheet File'}
                </label>
              </div>

              {importStatus && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.75rem',
                    background: '#0d121f',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    color: '#00e5ff',
                    border: '1px solid #1e2740',
                  }}
                >
                  {importStatus}
                </div>
              )}
            </div>
            <div className="pic-modal-footer">
              <button
                className="pic-btn-secondary"
                onClick={() => setIsImportModalOpen(false)}
                disabled={importing}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
