import { NextResponse } from "next/server";

export function middleware() {
  // Allow all requests to pass through
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/remote-file-s3-upload"],
};
