import React, { useState } from "react";
import { Lock, Mail, User } from "lucide-react";
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

interface AuthFormData {
  email: string;
  password: string;
  name?: string;
}

interface AuthResponse {
  error?: string;
}

export default function AuthForm(): JSX.Element {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState<AuthFormData>({
    email: "",
    password: "",
    name: "",
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
    const { email, password, name } = formData;

    if (!email || !password || (!isLogin && !name)) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data: AuthResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `${isLogin ? "Login" : "Registration"} failed`,
        );
      }

      window.location.href = "/workspace";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setFormData({
      email: "",
      password: "",
      name: "",
    });
  };

  return (
    <Card className="w-full backdrop-blur-sm bg-gray-300">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">
          {isLogin ? "Welcome Back" : "Create Account"}
        </CardTitle>
        <CardDescription className="text-center">
          {isLogin
            ? "Enter your credentials to login"
            : "Fill in your details to register"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isLogin && (
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  className="pl-10"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>
            </div>
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

          {isLogin && (
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
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? isLogin
                ? "Signing in..."
                : "Creating account..."
              : isLogin
                ? "Sign in"
                : "Create account"}
          </Button>

          <div className="text-center text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Button variant="link" className="p-0" onClick={toggleAuthMode}>
              {isLogin ? "Sign up" : "Sign in"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
