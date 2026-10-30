import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Download, Plus, Settings, Trash2, Upload } from "lucide-react";
import ProductTable from "@/components/productmaster/ProductTable";
import CompletenessTab from "@/components/productmaster/CompletenessTab";
import ImportsTab from "@/components/productmaster/ImportsTab";
import ProductDatasheetDialog from "@/components/productmaster/ProductDatasheetDialog";
import ProductImportWizard from "@/components/productmaster/ProductImportWizard";
import MasterSettingsDialog from "@/components/productmaster/MasterSettingsDialog";
import RecentlyDeletedProducts from "@/components/productmaster/RecentlyDeletedProducts";
import {
  activeNames, canManageProducts, downloadBlankTemplate, loadProductSettings, productCompleteness, productStatus,
} from "@/lib/productMaster";
import { deleteProduct, setProductStatus, usageSummary } from "@/lib/productLifecycle";
import { loadRecipes } from "@/lib/recipeMaster";
import { loadMachines, loadPackagingItems } from "@/lib/planning";
import { primaryButton, subtleButton } from "@/components/planning/styles";

import { productService } from "@/services/productService";

const initialTab = () => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return ["products", "completeness", "imports", "deleted"].includes(tab) ? tab : "products";
};

export default function ProductMaster() {
  const { user } = useAuth();
  const { toast } = useToast();
  const admin = canManageProducts(user);
  const [tab, setTab] = useState(initialTab());
  const [products, setProducts] = useState([]); // deleted ones included
  const [machines, setMachines] = useState([]);
  const [packagingItems, setPackagingItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [settings, setSettings] = useState({ id: "", brands: [], channels: [], mapping: null, mapping_signature: "" });
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, product: null });
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    const [productRows, machineRows, itemRows, recipeRows, settingsDoc, importRows] = await Promise.all([
      productService.getAllProducts().catch(() => []),
      loadMachines(),
      loadPackagingItems(),
      loadRecipes(),
      loadProductSettings(),
      Promise.resolve([]),
    ]);
    setProducts(Array.isArray(productRows) ? productRows : []);
    setMachines(machineRows);
    setPackagingItems(itemRows);
    setRecipes(recipeRows);
    setSettings(settingsDoc);
    setImports(Array.isArray(importRows) ? importRows : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const live = products.filter((p) => !p.deleted);
  const deleted = products.filter((p) => p.deleted);
  const brands = activeNames(settings.brands);
  const customers = activeNames(settings.channels);
  const incomplete = live.filter((p) => productCompleteness(p).incomplete).length;

  const closeDialog = () => setDialog({ open: false, product: null });

  const toggleStatus = async (product) => {
    const next = productStatus(product) === "Active" ? "Inactive" : "Active";
    setBusyId(product.id);
    try {
      await setProductStatus({ product, status: next, user });
      toast({ title: `${product.product_code} ${next.toLowerCase()}`, description: next === "Active" ? "Offered in dropdowns and scans again." : "Kept on old records, hidden from new ones." });
      await load();
    } finally {
      setBusyId("");
    }
  };

  const remove = async (product) => {
    setBusyId(product.id);
    try {
      const result = await deleteProduct({ product, user });
      if (result.blocked) {
        toast({
          title: "Product is in use",
          description: `Used in ${usageSummary(result.usage)} — set it to Inactive instead.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Moved to Recently Deleted", description: `${product.product_code} can be restored at any time.` });
        await load();
      }
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Product Master</h2>
          <p className="text-[#a0aec0] text-sm mt-1">
            The single source of truth for every product: Item Code, carton description, recipe, line type, calculated filling and cartons per batch.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadBlankTemplate} className={subtleButton}>
            <Download className="w-4 h-4 mr-1.5" /> Blank template
          </Button>
          {admin && (
            <>
              <Button variant="outline" onClick={() => setSettingsOpen(true)} className={subtleButton}>
                <Settings className="w-4 h-4 mr-1.5" /> Settings
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)} className={subtleButton}>
                <Upload className="w-4 h-4 mr-1.5" /> Import file
              </Button>
              <Button onClick={() => setDialog({ open: true, product: null })} className={primaryButton}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Product
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-[#0e131d] border border-[#1e2740] flex-wrap h-auto">
            <TabsTrigger value="products">Datasheet ({live.length})</TabsTrigger>
            <TabsTrigger value="completeness">Data completeness{incomplete ? ` (${incomplete})` : ""}</TabsTrigger>
            {admin && <TabsTrigger value="imports">Import history</TabsTrigger>}
            {admin && <TabsTrigger value="deleted"><Trash2 className="w-3.5 h-3.5 mr-1.5" /> Recently deleted ({deleted.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="products" className="mt-3">
            <ProductTable
              products={live}
              brands={brands}
              customers={customers}
              canEdit={admin && !busyId}
              onEdit={(product) => setDialog({ open: true, product })}
              onToggleStatus={toggleStatus}
              onDelete={remove}
            />
          </TabsContent>

          <TabsContent value="completeness" className="mt-3">
            <CompletenessTab products={live} brands={brands} user={user} onReload={load} />
          </TabsContent>

          {admin && (
            <TabsContent value="imports" className="mt-3">
              <ImportsTab imports={imports} user={user} onReload={load} />
            </TabsContent>
          )}

          {admin && (
            <TabsContent value="deleted" className="mt-3">
              <RecentlyDeletedProducts products={deleted} user={user} onReload={load} />
            </TabsContent>
          )}
        </Tabs>
      )}

      <ProductDatasheetDialog
        open={dialog.open}
        onClose={closeDialog}
        product={dialog.product}
        products={products}
        machines={machines}
        brands={brands}
        customers={customers}
        recipes={recipes}
        packagingItems={packagingItems}
        onSaved={async () => { closeDialog(); await load(); }}
      />

      <ProductImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        products={products}
        recipes={recipes}
        settings={settings}
        onSaved={load}
      />

      <MasterSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSaved={load}
      />
    </div>
  );
}