import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ItemForm from "@/components/warehouse/ItemForm";

// Quick "add new item" shortcut offered when an unknown item code is typed in.
export default function QuickAddItemDialog({ request, units, onClose, onCreated }) {
  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Add new item</DialogTitle>
          <DialogDescription className="text-[#a0aec0] text-sm">
            New code from the receiving form. It will be available for future receipts.
          </DialogDescription>
        </DialogHeader>
        {request && (
          <ItemForm
            initial={{ item_code: request.item_code, description: request.product_description }}
            units={units}
            onSaved={(item) => { onCreated?.(item, request.lineId); onClose(); }}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}