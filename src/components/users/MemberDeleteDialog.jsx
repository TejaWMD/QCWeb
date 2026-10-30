import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

// Confirmation dialog that removes a member and any of their outstanding invitations.
export default function MemberDeleteDialog({ user, onClose, onDeleted }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const remove = async () => {
    setBusy(true);
    try {
      await base44.entities.User.delete(user.id);
      await base44.entities.UserInvite.deleteMany({ email: user.email });
      toast({ title: "Member removed", description: `${user.email} no longer has access to the app.` });
      onClose();
      onDeleted?.();
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Delete failed";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
      setBusy(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this member?</AlertDialogTitle>
          <AlertDialogDescription>
            {user.email} will immediately lose access to the app and will be removed from the members list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              remove();
            }}
            disabled={busy}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {busy ? "Removing..." : "Remove member"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}