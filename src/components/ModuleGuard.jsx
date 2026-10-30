import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import SignInGate from "@/components/SignInGate";
import { useAuth } from "@/lib/AuthContext";
import { MODULES, canAccess, moduleForPath } from "@/lib/permissions";

// Blocks the route when the signed-in member has not been assigned that module. The first
// time the block is met, the account is re-read from the server, so a module an
// administrator has just saved opens without signing in again. Anyone who is not signed in
// gets the sign-in screen instead of this notice.
export default function ModuleGuard() {
  const { user, checkUserAuth } = useAuth();
  const location = useLocation();
  const [rechecked, setRechecked] = useState(false);
  const moduleKey = moduleForPath(location.pathname);
  const blocked = !!moduleKey && !canAccess(user, moduleKey);

  useEffect(() => {
    if (!blocked || rechecked) return;
    setRechecked(true);
    checkUserAuth?.();
  }, [blocked, rechecked, checkUserAuth]);

  if (!user?.id) return <SignInGate />;

  if (!blocked) return <Outlet />;

  const allowed = MODULES.filter((m) => !m.adminOnly && canAccess(user, m.key));

  return (
    <div className="p-6">
      <div className="max-w-xl bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-800">Access restricted</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Your account has not been granted this module. Ask an administrator to grant it in User Management.
        </p>
        {allowed.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {allowed.map((m) => (
              <Link key={m.key} to={m.path} className="text-sm font-medium text-sky-600 hover:underline">
                {m.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No modules have been granted to your account yet.</p>
        )}
      </div>
    </div>
  );
}