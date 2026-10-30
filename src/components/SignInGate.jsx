import React from "react";
import Login from "@/pages/Login";

// Shown to anyone who is not signed in: the app's own sign-in screen, so a visitor is
// never met with an access notice.
export default function SignInGate() {
  return <Login />;
}