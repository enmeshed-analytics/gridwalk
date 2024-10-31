export async function GET(request) {
  try {
    // Get the cookies from the request
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      throw new Error('No cookies present');
    }

    // Parse cookies string to get sid value
    const sidCookie = cookies.split(';')
      .find(cookie => cookie.trim().startsWith('sid='));
    
    if (!sidCookie) {
      throw new Error('Session ID cookie not found');
    }

    // Extract the sid value
    const sidValue = sidCookie.split('=')[1].trim();

    // Make the profile request with the sid as bearer token
    const response = await fetch('http://localhost:3001/profile', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sidValue}`
      }
    });

    if (!response.ok) {
      throw new Error('Profile retrieval failed');
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Profile retrieval failed.' 
      }),
      { status: 401 }
    );
  }
}
