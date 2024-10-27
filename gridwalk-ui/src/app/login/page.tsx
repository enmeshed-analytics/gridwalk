"use client";
import React from "react";
import LoginForm from "./components/loginForm";
import GridBackground from "./components/gridBackground";
import { Logo } from "./components/logo";

export default function LoginPage(): JSX.Element {
  return (
    <>
      <title>Sign In | GridWalk</title>

      {/* Animated Background */}
      <GridBackground />

      {/* Content */}
      <div className="relative grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family:var(--font-geist-sans)]">
        <header className="w-full max-w-md text-center row-start-1">
          <Logo />
        </header>

        <main className="flex flex-col gap-8 row-start-2 items-center w-full max-w-md">
          <LoginForm />
        </main>
      </div>
    </>
  );
}
