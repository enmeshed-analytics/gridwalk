// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Only run this middleware for the login page
  if (request.nextUrl.pathname === '/login') {
    const sessionId = request.cookies.get('sid')

    // If no session cookie exists, allow access to login page
    if (!sessionId) {
      return NextResponse.next()
    }

    try {
      const apiHost = process.env.GRIDWALK_API
      if (!apiHost) {
        throw new Error('GRIDWALK_API environment variable is not set')
      }

      const response = await fetch(`${apiHost}/profile`, {
        headers: {
          'Authorization': `Bearer ${sessionId.value}`
        }
      })

      // If authenticated, redirect to workspace
      if (response.ok) {
        return NextResponse.redirect(new URL('/workspace', request.url))
      }

      // If not authenticated, allow access to login page
      return NextResponse.next()
      
    } catch (error) {
      console.error('Error checking auth status:', error)
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

// Configure the middleware to only run on the login page
export const config = {
  matcher: '/login'
}
