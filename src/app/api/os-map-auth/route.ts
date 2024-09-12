import { NextResponse } from 'next/server';

export const runtime = 'edge';

// TODO: Update when auth implemented
export async function POST(): Promise<NextResponse> {
  const projectAPIKey = process.env.OS_PROJECT_API_KEY;
  const projectAPISecret = process.env.OS_PROJECT_API_SECRET;

  if (!projectAPIKey || !projectAPISecret) {
    return NextResponse.json(
      { message: 'API key or secret not configured' },
      { status: 500 }
    );
  }

  try {
    // Encode API key and secret for basic auth
    const authString = btoa(`${projectAPIKey}:${projectAPISecret}`);

    // Make request to OAuth 2 endpoint
    const response = await fetch('https://api.os.uk/oauth2/token/v1', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });


    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();


    // Return the access token and other details
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { message: 'Error generating token', error: (error as Error).message },
      { status: 500 }
    );
  }
}
