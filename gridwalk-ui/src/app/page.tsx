"use client";
import {
  Database,
  Check,
  Star,
  Lock,
  Zap,
  Map,
  Activity,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";
import GridBackground from "./login/components/gridBackground";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitted(true);
    setTimeout(() => {
      setEmail("");
      setIsSubmitted(false);
    }, 3000);
  };

  const handleLoginRedirect = () => {
    router.push("/login");
  };

  return (
    <div className="relative min-h-screen font-[family:var(--font-geist-sans)]">
      {/* 3D Animated Background */}
      <GridBackground />

      <nav className="absolute top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between py-4">
            {/* Logo/Brand */}
            <div className="text-xl font-bold text-white">GridWalk</div>

            {/* Login Button */}
            <Button
              onClick={handleLoginRedirect}
              className="h-11 px-6 text-white bg-blue-500 hover:bg-blue-600 shadow-lg hover:shadow-blue-500/25 hover:shadow-2xl transition-all rounded-xl"
            >
              Login
            </Button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="relative">
        {/* Hero Section */}
        <header className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
            <div className="text-center">
              {/* Pre-launch Banner */}
              <div className="mb-8 inline-flex items-center bg-blue-500/10 backdrop-blur-sm rounded-full px-6 py-2">
                <Star className="h-5 w-5 text-blue-400 mr-2" />
                <span className="text-blue-200 font-medium">
                  Early Access Available
                </span>
                <div className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">
                  50% OFF
                </div>
              </div>

              <h1 className="text-5xl font-bold tracking-tight text-gray-100 sm:text-7xl mb-6">
                Make Your Maps
                <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mt-2">
                  Tell Better Stories
                </span>
              </h1>
              <p className="mt-6 text-xl leading-8 text-gray-300 max-w-2xl mx-auto">
                GridWalk transforms complex location data into crystal-clear
                insights. Build beautiful maps, analyze patterns, and share
                discoveries with your team in minutes.
              </p>

              {/* CTA Section */}
              <div className="mt-12 flex flex-col items-center gap-4">
                <form
                  onSubmit={handleSubmit}
                  className="flex w-full max-w-md gap-x-4"
                >
                  <div className="flex-1 relative">
                    <Input
                      type="email"
                      placeholder="Enter your work email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 h-14 text-md pl-5 pr-12 rounded-xl bg-white/10 backdrop-blur-sm border-blue-300/20 text-white placeholder:text-gray-400"
                      required
                    />
                    {isSubmitted && (
                      <div className="absolute right-0 top-0 bottom-0 flex items-center pr-3">
                        <Check className="h-6 w-6 text-green-400" />
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="h-14 px-8 text-lg bg-blue-500 hover:bg-blue-600 shadow-lg hover:shadow-blue-500/25 hover:shadow-2xl transition-all rounded-xl"
                  >
                    Get Early Access
                  </Button>
                </form>

                {/* Social Proof */}
                <div className="flex flex-col items-center mt-8 space-y-4">
                  <div className="flex -space-x-2">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 border-2 border-gray-900"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-300">
                    <span className="font-semibold text-white">180+ teams</span>{" "}
                    already on the waitlist
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Features Section */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center rounded-full bg-blue-500/10 backdrop-blur-sm px-6 py-2 text-sm font-semibold text-blue-300 mb-6">
                <Map className="h-4 w-4 mr-2" />
                Powerful Features
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Everything You Need for Modern Mapping
              </h2>
            </div>
            <div className="mx-auto mt-16 max-w-7xl">
              <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: Activity,
                    title: "Real-time Analysis",
                    description:
                      "Watch your data come alive with instant updates and dynamic visualizations.",
                    benefit: "Live data processing",
                  },
                  {
                    icon: Database,
                    title: "Universal Compatibility",
                    description:
                      "Import from any source: CSV, GeoJSON, Shapefiles, or connect your database directly.",
                    benefit: "Works with your stack",
                  },
                  {
                    icon: Users,
                    title: "Team Collaboration",
                    description:
                      "Built for teams with real-time editing, version control, and granular permissions.",
                    benefit: "True multiplayer",
                  },
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="group relative flex flex-col items-start p-8 rounded-2xl transition-all duration-300 hover:shadow-2xl cursor-pointer bg-white/5 backdrop-blur-sm hover:bg-white/10"
                  >
                    <div className="rounded-2xl bg-gradient-to-tr from-blue-500 to-blue-400 p-3 ring-8 ring-blue-500/10">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mt-6 text-xl font-semibold text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-gray-300">{feature.description}</p>
                    <div className="mt-4 inline-flex items-center text-sm font-medium text-blue-400">
                      <Zap className="h-4 w-4 mr-1" />
                      {feature.benefit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-32">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <div className="inline-flex items-center rounded-full bg-green-500/10 backdrop-blur-sm px-6 py-2 text-sm font-semibold text-green-400 mb-6">
                <Lock className="h-4 w-4 mr-2" />
                Lock In Launch Pricing
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Early Adopter Pricing
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-300">
                Join now to secure lifetime discounted pricing
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-3">
              {[
                {
                  name: "Starter",
                  price: "49",
                  originalPrice: "99",
                  features: [
                    "10GB storage",
                    "Up to 5 team members",
                    "Real-time analytics",
                    "Community support",
                  ],
                  popular: false,
                  discount: "50% OFF",
                },
                {
                  name: "Professional",
                  price: "99",
                  originalPrice: "199",
                  features: [
                    "50GB storage",
                    "Unlimited team members",
                    "Advanced analytics",
                    "Priority support",
                    "Custom styling",
                  ],
                  popular: true,
                  discount: "50% OFF",
                },
                {
                  name: "Enterprise",
                  price: "Custom",
                  features: [
                    "Unlimited storage",
                    "Custom deployment",
                    "24/7 support",
                    "SLA guarantees",
                    "Advanced security",
                  ],
                  popular: false,
                },
              ].map((plan, index) => (
                <div
                  key={index}
                  className={`relative flex flex-col justify-between rounded-3xl p-8 xl:p-10 ${
                    index === 1
                      ? "bg-blue-600/20 backdrop-blur-sm ring-blue-500/30"
                      : "bg-white/5 backdrop-blur-sm ring-white/10"
                  } ring-1 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl`}
                >
                  {plan.discount && (
                    <div className="absolute -top-4 -right-4 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                      {plan.discount}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between gap-x-4">
                      <h3 className="text-lg font-semibold leading-8 text-white">
                        {plan.name}
                      </h3>
                      {plan.popular && (
                        <p className="rounded-full bg-blue-400/10 px-2.5 py-1 text-xs font-semibold leading-5 text-blue-300">
                          Most popular
                        </p>
                      )}
                    </div>
                    <p className="mt-6 flex items-baseline gap-x-1 text-white">
                      {plan.price !== "Custom" ? (
                        <>
                          <span className="text-4xl font-bold tracking-tight">
                            ${plan.price}
                          </span>
                          <span className="text-sm font-semibold leading-6 text-gray-300">
                            /month
                          </span>
                          {plan.originalPrice && (
                            <span className="ml-2 text-sm line-through text-gray-500">
                              ${plan.originalPrice}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-4xl font-bold tracking-tight">
                          Custom
                        </span>
                      )}
                    </p>
                    <ul
                      role="list"
                      className="mt-8 space-y-3 text-sm leading-6"
                    >
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-x-3">
                          <Check className="h-6 w-5 flex-none text-blue-400" />
                          <span className="text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    className={`mt-8 w-full rounded-xl h-12 ${
                      index === 1
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    Get Started
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12">
          <div className="mx-auto max-w-7xl px-6 md:flex md:items-center md:justify-between">
            <div className="flex justify-center space-x-6 md:order-2">
              {[
                { name: "Terms", href: "#" },
                { name: "Privacy", href: "#" },
                { name: "Contact", href: "#" },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {item.name}
                </a>
              ))}
            </div>
            <div className="mt-8 md:mt-0 md:order-1">
              <p className="text-center text-sm text-gray-400">
                &copy; {new Date().getFullYear()} GridWalk. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
