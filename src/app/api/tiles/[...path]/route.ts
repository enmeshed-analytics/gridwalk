// File: app/api/tileProxy/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  const tileServerUrl = process.env.TILE_SERVER_URL || 'http://localhost:8080';
  const url = new URL(request.url);
  const layers = url.searchParams.get('layers');
  const path = params.path.join('/');

  const tileUrl = `${tileServerUrl}/${layers}/${path}`;

  console.log('Proxying GET request to:', tileUrl);

  try {
    const response = await fetch(tileUrl, {
      method: 'GET',
      headers: request.headers,
    });

    if (!response.ok) {
      throw new Error(`Tile server responded with status: ${response.status}`);
    }

    const data = await response.arrayBuffer();
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error proxying to tile server:', error);
    return NextResponse.json(
      { error: 'Error proxying to tile server' }, 
      { status: 500 }
    );
  }
}
