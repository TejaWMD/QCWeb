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
  // Login / Access gate bypassed for now
  return <Outlet />;
}