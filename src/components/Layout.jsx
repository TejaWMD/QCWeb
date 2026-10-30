import React from "react";
import { Outlet } from "react-router-dom";
import { Factory, Eye } from "lucide-react";
import FactorySidebar from "@/components/factoryops/FactorySidebar";
import { useAuth } from "@/lib/AuthContext";
import { VIEW_AS_ROLES } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Layout() {
  const { user, viewAsRole, setViewAsRole } = useAuth();
  const isAdmin = user?.role === "admin";
  const activeRole = VIEW_AS_ROLES.find((r) => r.key === viewAsRole);

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <header className="px-5 py-3 bg-[#0e131d] border-b border-[#131926]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#00e5ff]/10 flex items-center justify-center shrink-0">
            <Factory className="w-5 h-5 text-[#00e5ff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white text-lg font-semibold tracking-wide">WMG Factory Optmz.</h1>
            </div>
            <p className="text-[#a0aec0] text-xs">Integrated Production, Quality &amp; Food Safety OS</p>
          </div>
          {isAdmin && (
            <div className="ml-auto flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#a0aec0] shrink-0" />
              <Select value={viewAsRole || "none"} onValueChange={(v) => setViewAsRole(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 w-[200px] bg-[#0e131d] border-[#1e2740] text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">View as… (Admin)</SelectItem>
                  {VIEW_AS_ROLES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>
      {activeRole && (
        <div className="bg-[#ff9f43]/15 border-b border-[#ff9f43]/40 px-5 py-2.5 flex flex-wrap items-center gap-3">
          <Eye className="w-4 h-4 text-[#ff9f43] shrink-0" />
          <p className="text-sm text-[#ff9f43] font-medium">
            Viewing as {activeRole.label} — your actions are logged in the Audit Trail as “Admin (demo as {activeRole.label})”.
          </p>
          <Button size="sm" onClick={() => setViewAsRole("")} className="ml-auto h-7 bg-[#ff9f43] hover:bg-[#f58a1f] text-[#0a0e17]">
            Exit
          </Button>
        </div>
      )}
      <div className="flex">
        <FactorySidebar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>);
}