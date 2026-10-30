import { supabase } from '@/api/supabaseClient';
import { Product, ProductInput, ProductSettings, Machine, Recipe, PackagingItem } from '@/types/product';

export const num = (v: any): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const round1 = (v: any): number => Math.round(num(v) * 10) / 10;
export const cleanText = (v: any): string => (v ?? '').toString().trim();
export const upper = (v: any): string => cleanText(v).toUpperCase();

// Barcodes lose leading asterisk and are stored as clean string
export const cleanBarcode = (val: string): string => cleanText(val).replace(/^\*+/, '').trim();
export const barcodeKey = (val: string): string => cleanBarcode(val).replace(/^0/, '');

// Calculate derived fields according to factory datasheet logic
export const calculateProductDerivedFields = (p: Partial<ProductInput>) => {
  const cartonSize = num(p.carton_size);
  const netWeightKg = num(p.net_weight_kg);
  const batchOutputKg = num(p.batch_output_kg);
  const shelfLifeMonths = num(p.shelf_life_months);
  const cookingTimeHr = num(p.cooking_time_hr);

  const netFillingKg = Math.round(cartonSize * netWeightKg * 1000) / 1000;
  const cartonsPerBatch = netFillingKg > 0 ? round1(batchOutputKg / netFillingKg) : 0;

  return {
    net_filling_kg: netFillingKg,
    cartons_per_batch: cartonsPerBatch,
    standard_batch_cartons: Math.round(cartonsPerBatch),
    target_net_weight_g: Math.round(netWeightKg * 1000 * 1000) / 1000,
    shelf_life_days: shelfLifeMonths ? shelfLifeMonths * 30 : 0,
    cooking_time_min: Math.round(cookingTimeHr * 60),
  };
};

export const productService = {
  // Fetch active products
  async getActiveProducts(): Promise<Product[]> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('deleted', false)
        .order('product_code', { ascending: true });

      if (error) {
        console.warn('Error fetching active products:', error.message);
        return [];
      }
      return (data || []) as Product[];
    } catch (err: any) {
      console.warn('Network error loading active products:', err?.message || err);
      return [];
    }
  },

  // Fetch all products (including deleted)
  async getAllProducts(): Promise<Product[]> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('product_code', { ascending: true });

      if (error) {
        console.warn('Error fetching all products:', error.message);
        return [];
      }
      return (data || []) as Product[];
    } catch (err: any) {
      console.warn('Network error loading products:', err?.message || err);
      return [];
    }
  },

  // Fetch a single product by ID
  async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching product by ID:', error);
      return null;
    }
    return data as Product;
  },

  // Check if item code or barcode clashes with existing records
  async validateProductUnique(
    productCode: string,
    barcodes: string[],
    excludeId?: string
  ): Promise<{ valid: boolean; message?: string }> {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_code, product_name, barcode, carton_barcode')
      .eq('deleted', false);

    if (error) throw error;
    const existing = (data || []).filter((p) => p.id !== excludeId);

    // Check item code uniqueness
    const codeClash = existing.find(
      (p) => upper(p.product_code) === upper(productCode)
    );
    if (codeClash) {
      return {
        valid: false,
        message: `Item Code "${productCode}" is already in use by ${codeClash.product_name}.`,
      };
    }

    // Check barcode uniqueness
    const cleanBarcodes = barcodes.filter(Boolean).map(barcodeKey);
    if (cleanBarcodes.length > 0) {
      const barcodeClash = existing.find((p) => {
        const pCodes = [p.barcode, p.carton_barcode].filter(Boolean).map(barcodeKey);
        return pCodes.some((code) => cleanBarcodes.includes(code));
      });
      if (barcodeClash) {
        return {
          valid: false,
          message: `Barcode is already in use by ${barcodeClash.product_code} (${barcodeClash.product_name}).`,
        };
      }
    }

    return { valid: true };
  },

  // Insert a new product
  async createProduct(input: ProductInput): Promise<Product> {
    const derived = calculateProductDerivedFields(input);
    const payload = {
      ...input,
      ...derived,
      product_code: upper(input.product_code),
      product_name: cleanText(input.product_name),
      barcode: input.barcode ? cleanBarcode(input.barcode) : '',
      carton_barcode: input.carton_barcode ? cleanBarcode(input.carton_barcode) : '',
      customer: upper(input.customer) || 'GENERAL',
      status: input.status || 'Active',
      active: (input.status || 'Active') !== 'Inactive',
      deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error inserting product:', error);
      throw error;
    }

    if (payload.default_machine) {
      this.ensureMachine(payload.default_machine).catch(() => {});
    }
    if (payload.recipe_name) {
      this.ensureRecipe({
        recipe_name: payload.recipe_name,
        cooking_time_hr: payload.cooking_time_hr,
        batch_output_kg: payload.batch_output_kg,
        product_code: payload.product_code,
        product_name: payload.product_name,
      }).catch(() => {});
    }
    if (payload.brand) {
      this.ensureBrand(payload.brand).catch(() => {});
    }
    if (payload.customer) {
      this.ensureCustomer(payload.customer).catch(() => {});
    }

    return data as Product;
  },

  // Update an existing product
  async updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
    const derived = calculateProductDerivedFields(input);
    const payload: any = {
      ...input,
      ...derived,
      updated_at: new Date().toISOString(),
    };
    if (input.product_code) payload.product_code = upper(input.product_code);
    if (input.product_name) payload.product_name = cleanText(input.product_name);
    if (input.barcode !== undefined) payload.barcode = cleanBarcode(input.barcode);
    if (input.carton_barcode !== undefined) payload.carton_barcode = cleanBarcode(input.carton_barcode);
    if (input.customer !== undefined) payload.customer = upper(input.customer) || 'GENERAL';
    if (input.status !== undefined) {
      payload.status = input.status;
      payload.active = input.status !== 'Inactive';
    }

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      throw error;
    }

    if (payload.default_machine) {
      this.ensureMachine(payload.default_machine).catch(() => {});
    }
    if (payload.recipe_name) {
      this.ensureRecipe({
        recipe_name: payload.recipe_name,
        cooking_time_hr: payload.cooking_time_hr,
        batch_output_kg: payload.batch_output_kg,
        product_code: payload.product_code,
        product_name: payload.product_name,
      }).catch(() => {});
    }
    if (payload.brand) {
      this.ensureBrand(payload.brand).catch(() => {});
    }
    if (payload.customer) {
      this.ensureCustomer(payload.customer).catch(() => {});
    }

    return data as Product;
  },

  // Soft delete product
  async softDeleteProduct(id: string, deletedBy: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({
        deleted: true,
        active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  // Restore soft-deleted product
  async restoreProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({
        deleted: false,
        active: true,
        status: 'Active',
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error restoring product:', error);
      throw error;
    }
  },

  // Permanent hard delete
  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error permanently deleting product:', error);
      throw error;
    }
  },

  // Bulk upsert products (used by Excel / CSV import)
  async bulkUpsertProducts(products: ProductInput[]): Promise<{ count: number }> {
    const prepared = products.map((p) => {
      const derived = calculateProductDerivedFields(p);
      return {
        ...p,
        ...derived,
        product_code: upper(p.product_code),
        product_name: cleanText(p.product_name),
        barcode: p.barcode ? cleanBarcode(p.barcode) : '',
        carton_barcode: p.carton_barcode ? cleanBarcode(p.carton_barcode) : '',
        customer: upper(p.customer) || 'GENERAL',
        status: p.status || 'Active',
        active: (p.status || 'Active') !== 'Inactive',
        deleted: false,
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('products')
      .upsert(prepared, { onConflict: 'product_code' })
      .select('id');

    if (error) {
      console.error('Error in bulk upsert products:', error);
      throw error;
    }

    const uniqueMachines = [...new Set(products.map((p) => p.default_machine).filter(Boolean))] as string[];
    uniqueMachines.forEach((m) => this.ensureMachine(m).catch(() => {}));

    const uniqueBrands = [...new Set(products.map((p) => p.brand).filter(Boolean))] as string[];
    uniqueBrands.forEach((b) => this.ensureBrand(b).catch(() => {}));

    const uniqueCustomers = [...new Set(products.map((p) => p.customer).filter(Boolean))] as string[];
    uniqueCustomers.forEach((c) => this.ensureCustomer(c).catch(() => {}));

    products.forEach((p) => {
      if (p.recipe_name) {
        this.ensureRecipe({
          recipe_name: p.recipe_name,
          cooking_time_hr: p.cooking_time_hr,
          batch_output_kg: p.batch_output_kg,
          product_code: p.product_code,
          product_name: p.product_name,
        }).catch(() => {});
      }
    });

    return { count: data?.length || 0 };
  },

  // Product Settings (Brands, Channels, Import Mappings)
  async getProductSettings(): Promise<ProductSettings> {
    const { data, error } = await supabase
      .from('product_settings')
      .select('*')
      .eq('key', 'product_master')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching product settings:', error);
    }

    return (
      (data as ProductSettings) || {
        key: 'product_master',
        brands: [],
        channels: [],
        mapping: null,
        mapping_signature: '',
      }
    );
  },

  async saveProductSettings(settings: Partial<ProductSettings>): Promise<void> {
    const { error } = await supabase.from('product_settings').upsert({
      key: 'product_master',
      brands: settings.brands || [],
      channels: settings.channels || [],
      mapping: settings.mapping || null,
      mapping_signature: settings.mapping_signature || '',
      updated_at: new Date().toISOString(),
      updated_by: settings.updated_by || '',
    }, { onConflict: 'key' });

    if (error) {
      console.error('Error saving product settings:', error);
      throw error;
    }
  },

  // Supporting entities
  async getMachines(): Promise<Machine[]> {
    const { data, error } = await supabase
      .from('machines')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Could not load machines from Supabase:', error.message);
      return [];
    }
    return (data || []) as Machine[];
  },

  async getRecipes(): Promise<Recipe[]> {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('recipe_name', { ascending: true });

    if (error) {
      console.warn('Could not load recipes from Supabase:', error.message);
      return [];
    }
    return (data || []) as Recipe[];
  },

  async getPackagingItems(): Promise<PackagingItem[]> {
    const { data, error } = await supabase
      .from('packaging_items')
      .select('*')
      .eq('active', true)
      .order('item_code', { ascending: true });

    if (error) {
      console.warn('Could not load packaging items from Supabase:', error.message);
      return [];
    }
    return (data || []) as PackagingItem[];
  },

  async ensureMachine(name: string): Promise<void> {
    const trimmed = cleanText(name);
    if (!trimmed) return;
    const { data } = await supabase.from('machines').select('id').eq('name', trimmed).limit(1);
    if (!data || data.length === 0) {
      await supabase.from('machines').insert({
        name: trimmed,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  },

  async ensureRecipe(recipe: { recipe_name: string; cooking_time_hr?: number; batch_output_kg?: number; product_code?: string; product_name?: string }): Promise<void> {
    const trimmed = cleanText(recipe.recipe_name);
    if (!trimmed) return;
    const { data } = await supabase.from('recipes').select('id').eq('recipe_name', trimmed).limit(1);
    if (!data || data.length === 0) {
      await supabase.from('recipes').insert({
        recipe_name: trimmed,
        cooking_time_hr: num(recipe.cooking_time_hr),
        batch_output_kg: num(recipe.batch_output_kg),
        product_code: recipe.product_code || '',
        product_name: recipe.product_name || '',
        version: 1,
        status: 'Active',
        standard_yield_pct: 100,
        ingredients: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  },

  async ensureBrand(brandName: string): Promise<void> {
    const trimmed = cleanText(brandName);
    if (!trimmed) return;
    const settings = await this.getProductSettings();
    const existing = settings.brands || [];
    if (!existing.some((b) => upper(b.name) === upper(trimmed))) {
      await this.saveProductSettings({
        brands: [...existing, { name: trimmed, active: true }],
      });
    }
  },

  async ensureCustomer(customerName: string): Promise<void> {
    const trimmed = cleanText(customerName);
    if (!trimmed) return;
    const settings = await this.getProductSettings();
    const existing = settings.channels || [];
    if (!existing.some((c) => upper(c.name) === upper(trimmed))) {
      await this.saveProductSettings({
        channels: [...existing, { name: trimmed.toUpperCase(), active: true }],
      });
    }
  },
};
