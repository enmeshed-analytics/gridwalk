import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // Allow all requests to pass through
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/tiles/:path*", "/api/remote-file-s3-upload"],
};
