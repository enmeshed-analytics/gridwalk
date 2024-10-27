"use client";
import React, { useState } from "react";
import { Lock, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginResponse {
  error?: string;
}

export default function LoginForm(): JSX.Element {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    const { email, password } = formData;

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      window.location.href = "/project";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred during login",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full backdrop-blur-sm bg-white/90">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Welcome</CardTitle>
        <CardDescription className="text-center">
          Enter your email and password to login
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                type="email"
                name="email"
                placeholder="Email"
                className="pl-10"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                type="password"
                name="password"
                placeholder="Password"
                className="pl-10"
                value={formData.password}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">Remember me</span>
            </label>
            <Button variant="link" className="text-sm">
              Forgot password?
            </Button>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>

          <div className="text-center text-sm">
            Don't have an account?{" "}
            <Button variant="link" className="p-0">
              Sign up
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
