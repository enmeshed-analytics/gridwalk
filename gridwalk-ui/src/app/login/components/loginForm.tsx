"use client";

import React, { useState } from "react";
import { Lock, Mail, User, ArrowLeft } from "lucide-react";
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
import { loginAction, registerAction } from "./actions";
import { useRouter } from "next/navigation";

interface AuthFormData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

const resetPasswordAction = async (email: string): Promise<void> => {
  // TODO: Implement password reset logic
  console.log("Password reset requested for:", email);
  throw new Error("Password reset not yet implemented");
};

export default function AuthForm(): JSX.Element {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState<AuthFormData>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetSuccess, setIsResetSuccess] = useState(false);

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
    const { email, password, first_name, last_name } = formData;

    if (!email || !password || (!isLogin && (!first_name || !last_name))) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await loginAction({ email, password });
      } else {
        await registerAction({
          email,
          password,
          first_name: first_name!,
          last_name: last_name!,
        });
      }
      router.push("/workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    if (!resetEmail) {
      setError("Please enter your email address");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await resetPasswordAction(resetEmail);
      setIsResetSuccess(true);
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
      first_name: "",
      last_name: "",
    });
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setIsResetSuccess(false);
    setResetEmail("");
    setError("");
  };

  if (showForgotPassword) {
    return (
      <Card className="w-full backdrop-blur-sm bg-gray-300/20">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we will send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isResetSuccess ? (
            <div className="space-y-4">
              <Alert className="bg-green-50 text-green-800 border-green-200">
                <AlertDescription>
                  If an account exists with this email, you will receive a
                  password reset link shortly. Please check your email - and
                  junk folder.
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleBackToLogin}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="text-red-600 mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    type="email"
                    placeholder="Email"
                    className="pl-10"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending reset link..." : "Send reset link"}
              </Button>
              <Button
                variant="link"
                className="w-full"
                onClick={handleBackToLogin}
              >
                Back to Login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full backdrop-blur-sm bg-gray-300/20">
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
            <Alert variant="destructive" className="text-red-600 mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isLogin && (
            <>
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    type="text"
                    name="first_name"
                    placeholder="First Name"
                    className="pl-10"
                    value={formData.first_name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    type="text"
                    name="last_name"
                    placeholder="Last Name"
                    className="pl-10"
                    value={formData.last_name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </>
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
              <Button
                variant="link"
                className="text-sm"
                onClick={() => setShowForgotPassword(true)}
                type="button"
              >
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
