import { NextRequest, NextResponse } from "next/server";

interface LoginRequestBody {
  email: string;
  password: string;
}

interface LoginResponseData {
  apiKey: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as LoginRequestBody;
    const { email, password } = body;

    const response = await fetch("http://localhost:3001/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const data = (await response.json()) as LoginResponseData;

    return NextResponse.json({ success: true } as ApiResponse, {
      status: 200,
      headers: {
        // TODO: Enable these flags in production
        // "Set-Cookie": `sid=${data.apiKey}; Path=/; HttpOnly; Secure; SameSite=Strict`
        "Set-Cookie": `sid=${data.apiKey}; Path=/; SameSite=Strict`,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Login failed. Please try again.",
      } as ApiResponse,
      { status: 401 },
    );
  }
}
