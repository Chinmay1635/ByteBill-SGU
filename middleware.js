// middleware.js

import arcjet, { createMiddleware, detectBot, shield } from "@arcjet/next";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 1. Define protected routes (client-side pages)
const isProtectedPageRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/account(.*)",
  "/transaction(.*)",
  "/Prediction(.*)", // ✅ Protect Prediction page
]);

// 2. Define protected API routes
const isProtectedApiRoute = createRouteMatcher([
  "/api/predict(.*)", // ✅ Protect prediction API
]);

// 3. Arcjet configuration
const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE", "GO_HTTP"],
    }),
  ],
});

// 4. Clerk middleware logic
const clerk = clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Redirect unauthenticated users from protected pages
  if (!userId && isProtectedPageRoute(req)) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }

  // Block API access if not authenticated
  if (!userId && isProtectedApiRoute(req)) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return NextResponse.next();
});

// 5. Combine Arcjet + Clerk middleware
export default createMiddleware(aj, clerk);

// 6. Matcher configuration (protect all app + api routes, skip static files)
export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:ico|png|jpg|jpeg|svg|css|js|json|woff2?|ttf|map|txt|csv|xlsx?|zip)).*)",
    "/(api|trpc)(.*)", // ✅ Secure API routes
  ],
};
