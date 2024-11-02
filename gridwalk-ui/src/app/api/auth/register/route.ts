export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    const [firstName, ...lastNameParts] = name.trim().split(" ");
    const lastName = lastNameParts.join(" ") || ""; // Handle case where no last name provided

    // Call external API
    const response = await fetch("http://localhost:3001/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(errorData || "Registration failed");
    }

    // After successful registration, automatically log them in
    const loginResponse = await fetch("http://localhost:3001/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResponse.ok) {
      throw new Error("Auto-login after registration failed");
    }

    const loginData = await loginResponse.json();

    // Create cookie with the apiKey
    const cookies = new Headers();
    // TODO: Change to HttpOnly & Secure in production
    cookies.append(
      "Set-Cookie",
      `sid=${loginData.apiKey}; Path=/; SameSite=Strict`,
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: cookies,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Registration failed. Please try again.",
      }),
      { status: 400 },
    );
  }
}
