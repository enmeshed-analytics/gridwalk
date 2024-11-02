import { NextRequest, NextResponse } from "next/server";

interface RegistrationRequestBody {
  email: string;
  password: string;
  name: string;
}

interface BackendRegistrationPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

interface LoginResponse {
  apiKey: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as RegistrationRequestBody;
    const { email, password, name } = body;

    // Name parsing with type safety
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    // Register user
    const registerPayload: BackendRegistrationPayload = {
      email,
      password,
      first_name: firstName,
      last_name: lastName,
    };

    const response = await fetch("http://localhost:3001/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerPayload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(errorData || "Registration failed");
    }

    // Auto-login after registration
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

    const loginData = (await loginResponse.json()) as LoginResponse;

    // Create success response with cookie
    return NextResponse.json({ success: true } as ApiResponse, {
      status: 200,
      headers: {
        "Set-Cookie": `sid=${loginData.apiKey}; Path=/; SameSite=Strict`,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Registration failed. Please try again.",
      } as ApiResponse,
      { status: 400 },
    );
  }
}
