import React, { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import SignInGate from "@/components/SignInGate";
import { Hourglass, ShieldAlert, UserX, RefreshCw, LogOut } from "lucide-react";

const SCREENS = {
  awaiting_approval: {
    icon: Hourglass,
    tone: "bg-amber-100 text-amber-600",
    title: "Awaiting approval",
    body: "Your invitation has been received. You will be able to open the dashboard once an administrator approves your access. This page checks automatically every few seconds.",
  },
  suspended: {
    icon: ShieldAlert,
    tone: "bg-rose-100 text-rose-600",
    title: "Access suspended",
    body: "An administrator has suspended your access to this app. Please contact an administrator if you believe this is a mistake.",
  },
  not_registered: {
    icon: UserX,
    tone: "bg-slate-100 text-slate-600",
    title: "This email is not registered",
    body: "Please use the email your invitation was sent to.",
  },
};

// Anyone who is not signed in sees the sign-in screen. For the signed-in account the
// access check runs once per session: the invitation for the address is applied, the
// modules assigned to the account decide what opens, and an address that was never
// invited is told to use the invited address. While blocked the check repeats, so an
// approval or a change made in User Management takes effect without a manual reload.
export default function AccessGate() {
  const { user, logout, checkUserAuth } = useAuth();
  const [access, setAccess] = useState("checking");
  const attempted = useRef(false);

  const check = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("getUserAccess", {});
      const data = res?.data || {};
      setAccess(data.access || "granted");
      // The first load after an invitation applies the modules carried by it — pull the
      // updated account so the navigation and the page guards use them straight away.
      if (data.applied) await checkUserAuth?.();
    } catch {
      // Never lock somebody out because of a transient failure.
      setAccess("granted");
    }
  }, [checkUserAuth]);

  useEffect(() => {
    if (!user?.id || attempted.current) return;
    attempted.current = true;
    check();
  }, [user?.id, check]);

  useEffect(() => {
    if (!["awaiting_approval", "suspended", "not_registered"].includes(access)) return;
    const timer = setInterval(check, 20000);
    return () => clearInterval(timer);
  }, [access, check]);

  if (!user?.id) return <SignInGate />;

  if (access === "checking") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const screen = SCREENS[access];
  if (screen) {
    const Icon = screen.icon;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl border border-slate-200 text-center">
          <div className={`inline-flex items-center justify-center w-14 h-14 mb-5 rounded-full ${screen.tone}`}>
            <Icon className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-3">{screen.title}</h1>
          <p className="text-sm text-slate-500 mb-6">{screen.body}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={check}>
              <RefreshCw className="w-4 h-4 mr-1" /> Check again
            </Button>
            <Button variant="ghost" onClick={() => logout()}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}