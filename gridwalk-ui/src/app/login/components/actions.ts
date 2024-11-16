'use server'

import { cookies } from 'next/headers';

interface LoginResponse {
  apiKey: string;
  error?: string;
}

export async function loginAction(formData: { email: string; password: string }) {
  const response = await fetch(`${process.env.GRIDWALK_API}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const res = await response.text();
    throw new Error(res || 'Login failed');
  }

  const data: LoginResponse = await response.json();

  // Set the cookie
  const cookieStore = await cookies();
  cookieStore.set({
    name: 'sid',
    value: data.apiKey,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // TODO: Change after testing
    httpOnly: false,
    sameSite: 'lax',
    // maxAge: 60 * 60 * 24 * 7, // 1 week
    // domain: 'your-domain.com',
  });

  return data;
}

export async function registerAction(formData: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}) {
  const response = await fetch(`${process.env.GRIDWALK_API}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  return data;
}
