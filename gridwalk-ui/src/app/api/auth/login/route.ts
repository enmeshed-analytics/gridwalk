export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Call external API
    const response = await fetch('http://localhost:3001/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    
    // Create cookie with the apiKey
    const cookies = new Headers();
    //cookies.append('Set-Cookie', `sid=${data.apiKey}; Path=/; HttpOnly; Secure; SameSite=Strict`);
    // TODO: Change to HttpOnly & Secure
    cookies.append('Set-Cookie', `sid=${data.apiKey}; Path=/; SameSite=Strict`);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: cookies,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Login failed. Please try again.' 
      }),
      { status: 401 }
    );
  }
}
