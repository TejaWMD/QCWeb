// Product Master Type Definitions

export interface PackagingPerCarton {
  item_id?: string;
  item_code: string;
  item_name: string;
  unit: string;
  quantity: number;
}

export interface CartonSku {
  description?: string;
  item_code?: string;
  barcode?: string;
  units_per_carton?: number;
}

export interface CustomField {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  product_code: string;
  product_name: string;
  product_name_original?: string;
  brand?: string;
  recipe_name?: string;
  recipe_id?: string | null;
  cooking_time_hr?: number;
  cooking_time_min?: number;
  batch_output_kg?: number;
  carton_size?: number; // Pcs per carton
  net_weight_kg?: number; // Weight per pc in kg
  net_filling_kg?: number; // carton_size * net_weight_kg
  cartons_per_batch?: number; // batch_output_kg / net_filling_kg
  standard_batch_cartons?: number; // rounded cartons_per_batch
  target_net_weight_g?: number; // net_weight_kg * 1000
  line_type?: string;
  default_machine?: string;
  batch_prefix?: string;
  shelf_life_months?: number;
  shelf_life_days?: number;
  barcode?: string;
  carton_barcode?: string;
  customer?: string;
  status?: 'Active' | 'Pending' | 'Inactive';
  active?: boolean;
  hidden?: boolean;
  remarks?: string;
  notes?: string;
  packaging_per_carton?: PackagingPerCarton[];
  carton_skus?: CartonSku[];
  custom_fields?: CustomField[];
  deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export interface ProductSettings {
  id?: string;
  key: string;
  brands: { name: string; active?: boolean }[];
  channels: { name: string; active?: boolean }[];
  mapping?: Record<string, string> | null;
  mapping_signature?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface Machine {
  id: string;
  name: string;
  location?: string;
  capacity_cph?: number;
  status: 'Active' | 'Under Maintenance';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Recipe {
  id: string;
  recipe_name: string;
  product_code?: string;
  product_name?: string;
  version?: number;
  status: 'Active' | 'Superseded';
  batch_output_kg?: number;
  cooking_time_hr?: number;
  batch_cartons?: number;
  standard_yield_pct?: number;
  ingredients?: Array<{
    material_id?: string;
    item_code?: string;
    material_name?: string;
    unit?: string;
    quantity_per_batch?: number;
  }>;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PackagingItem {
  id: string;
  item_code: string;
  name: string;
  category?: string;
  unit?: string;
  current_stock?: number;
  safety_stock?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}
