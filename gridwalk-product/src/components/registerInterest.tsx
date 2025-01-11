"use client";

import React, { useRef, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormStatus } from "react-dom";
import { sendEmail } from "@/app/actions";

// Create the submit button
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl"
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        "Register Interest"
      )}
    </Button>
  );
}

export default function RegisterInterestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({
    type: null,
    message: "",
  });

  async function clientAction(formData: FormData) {
    try {
      await sendEmail(formData);
      setStatus({
        type: "success",
        message: "Thank you for your interest. We'll be in touch soon!",
      });
      formRef.current?.reset();
      setTimeout(() => {
        setStatus({
          type: null,
          message: "",
        });
      }, 1500);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to send message. Please try again.",
      });
    }
  }

  return (
    <section className="py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <div className="inline-flex items-center rounded-full bg-blue-500/10 backdrop-blur-sm px-6 py-2 text-sm font-semibold text-blue-300 mb-6">
            <Mail className="h-4 w-4 mr-2" />
            Register Interest
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Join Our Private Beta
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            Be among the first to experience GridWalk and help shape its future!
          </p>
        </div>

        <div className="mx-auto max-w-xl">
          <form ref={formRef} action={clientAction} className="space-y-6">
            <div className="space-y-4">
              <Input
                type="text"
                name="name"
                placeholder="Your Name"
                required
                className="w-full h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-400"
              />
              <Input
                type="email"
                name="email"
                placeholder="Your Email"
                required
                className="w-full h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-400"
              />
              <input type="hidden" name="planName" value="Early Access" />
            </div>

            <SubmitButton />

            {status.type && (
              <div
                className={`p-4 rounded-lg text-center ${
                  status.type === "success"
                    ? "bg-green-500/20 text-green-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                {status.message}
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
