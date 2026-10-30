import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RackSettingsCard from "@/components/warehouse/RackSettingsCard";
import UnitSettingsCard from "@/components/warehouse/UnitSettingsCard";

// Warehouse settings (Admin and Warehouse Supervisor only): rack list and the
// units of measure offered when receiving goods.
export default function WarehouseSettingsDialog({ open, onClose, updatedBy }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Warehouse settings</DialogTitle>
          <DialogDescription className="text-[#a0aec0] text-sm">
            Racks and units of measure used by the goods receiving form.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="racks">
          <TabsList className="bg-[#0e131d] border border-[#1e2740]">
            <TabsTrigger value="racks">Racks</TabsTrigger>
            <TabsTrigger value="units">Units of measure</TabsTrigger>
          </TabsList>
          <TabsContent value="racks" className="mt-3">
            <RackSettingsCard />
          </TabsContent>
          <TabsContent value="units" className="mt-3">
            <UnitSettingsCard updatedBy={updatedBy} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}