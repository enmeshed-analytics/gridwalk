import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// TODO: This is a mock implementation. Replace with actual database queries.
const mockConnections = [
  { id: '1', name: 'Connection 1' },
  { id: '2', name: 'Connection 2' },
  { id: '3', name: 'Connection 3' },
];

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  // Convert mockConnections to a JSON string
  const jsonResponse = JSON.stringify(mockConnections);

  // Create a new NextResponse with the JSON data
  return new NextResponse(jsonResponse, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
