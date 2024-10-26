'use client'
import React, { useState, useEffect } from 'react';
import { Lock, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FloatingSquare = ({ size, duration, delay, initialPosition }) => {
  return (
    <div
      className="absolute rounded-lg opacity-30"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(225deg, #3b82f6 0%, #1e40af 100%)',
        animation: `float ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        top: initialPosition.top,
        left: initialPosition.left,
      }}
    />
  );
};

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [squares, setSquares] = useState([]);

  useEffect(() => {
    // Generate random squares
    const newSquares = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      size: Math.random() * 60 + 20, // 20-80px
      duration: Math.random() * 10 + 15, // 15-25s
      delay: Math.random() * -20,
      initialPosition: {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
      },
    }));
    setSquares(newSquares);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    console.log('Login attempted with:', { email, password });
  };

  return (
    <>
      <title>Sign In | GridWalk</title>
      
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-gray-700 to-gray-500 overflow-hidden">
        {squares.map((square) => (
          <FloatingSquare key={square.id} {...square} />
        ))}
      </div>

      {/* Content */}
      <div className="relative grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family:var(--font-geist-sans)]">
        <header className="w-full max-w-md text-center row-start-1">
          <h1 className="text-5xl font-bold text-gray-200">
            GridWalk
          </h1>
        </header>
        
        <main className="flex flex-col gap-8 row-start-2 items-center w-full max-w-md">
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
                      placeholder="Email"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input
                      type="password"
                      placeholder="Password"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                    <span className="text-sm">Remember me</span>
                  </label>
                  <Button variant="link" className="text-sm">
                    Forgot password?
                  </Button>
                </div>
                <Button type="submit" className="w-full">
                  Sign in
                </Button>
                <div className="text-center text-sm">
                  Don't have an account?{' '}
                  <Button variant="link" className="p-0">
                    Sign up
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(50px, -30px) rotate(90deg);
          }
          50% {
            transform: translate(100px, 0) rotate(180deg);
          }
          75% {
            transform: translate(50px, 30px) rotate(270deg);
          }
        }
      `}</style>
    </>
  );
}
