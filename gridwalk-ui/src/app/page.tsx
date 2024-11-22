"use client";
import {
  Database,
  Check,
  Star,
  Coins,
  Zap,
  Map,
  Activity,
  Users,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import GridBackground from "./login/components/gridBackground";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

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
                  Early Access Available During MVP Phase
                </span>
              </div>

              <h1 className="text-5xl font-bold tracking-tight text-gray-100 sm:text-7xl mb-6">
                Make Better Maps
                <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mt-2">
                  Tell Better Stories
                </span>
              </h1>
              <p className="mt-6 text-xl leading-8 text-gray-300 max-w-2xl mx-auto">
                GridWalk provides a collaborative environment to manage your
                location data and turn it into crystal-clear insights. Build
                beautiful maps, analyse patterns, and share discoveries with
                your team in minutes.
              </p>
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
                Everything You Need from a Modern Mapping Application
              </h2>
            </div>
            <div className="mx-auto mt-16 max-w-7xl">
              <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: Database,
                    title: "Workspace Management",
                    description:
                      "A space to manage your geospatial data projects efficiently - providing a workspace environment that drives collaboration.",
                    benefit: "Team collaboration",
                  },
                  {
                    icon: Activity,
                    title: "Flexible Data Integration",
                    description:
                      "Upload data from the UI or connect your own database allowing you to use your geospatial data instantly.",
                    benefit: "Instant connectivity",
                  },
                  {
                    icon: Users,
                    title: "Intuitive Workflows",
                    description:
                      "Intuitive workflows and UI to make sure you have more time to focus on your analysis and stakeholders.",
                    benefit: "Streamlined experience",
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
        <section className="py-32 overflow-x-auto">
          <div className="mx-auto max-w-[90rem] px-6">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <div className="inline-flex items-center rounded-full bg-blue-500/10 backdrop-blur-sm px-6 py-2 text-sm font-semibold text-blue-300 mb-6">
                <Coins className="h-4 w-4 mr-2" />
                Simple Pricing Plans
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Choose Your Plan
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-300">
                Flexible options for teams of all sizes
              </p>
            </div>

            <div className="flex gap-6 min-w-max px-4">
              {[
                {
                  name: "Free",
                  price: "0",
                  features: [
                    "1 user",
                    "1 workspace",
                    "5 projects",
                    "500MB storage",
                    "Basic features",
                  ],
                  popular: false,
                  colors: {
                    card: "from-emerald-600/20 to-teal-600/20",
                    ring: "ring-emerald-500/30",
                    badge: "bg-emerald-400/10 text-emerald-300",
                    button:
                      "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600",
                    check: "text-emerald-400",
                  },
                },
                {
                  name: "Solo",
                  price: "15",
                  features: [
                    "1 user",
                    "5 workspaces",
                    "Unlimited projects",
                    "5GB storage",
                    "Community support",
                  ],
                  popular: false,
                  colors: {
                    card: "from-blue-600/20 to-cyan-600/20",
                    ring: "ring-blue-500/30",
                    badge: "bg-blue-400/10 text-blue-300",
                    button:
                      "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600",
                    check: "text-blue-400",
                  },
                },
                {
                  name: "Team",
                  price: "50",
                  features: [
                    "15 users",
                    "15 workspaces",
                    "Unlimited projects",
                    "15GB storage",
                    "Priority support",
                    "Advanced features",
                  ],
                  popular: true,
                  colors: {
                    card: "from-purple-600/20 to-pink-600/20",
                    ring: "ring-purple-500/30",
                    badge: "bg-purple-400/10 text-purple-300",
                    button:
                      "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
                    check: "text-purple-400",
                  },
                },
                {
                  name: "Organisation",
                  price: "150",
                  features: [
                    "30 users",
                    "30 workspaces",
                    "Unlimited projects",
                    "20GB storage",
                    "24/7 support",
                    "Custom integrations",
                    "Advanced security",
                  ],
                  popular: false,
                  colors: {
                    card: "from-orange-600/20 to-red-600/20",
                    ring: "ring-orange-500/30",
                    badge: "bg-orange-400/10 text-orange-300",
                    button:
                      "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600",
                    check: "text-orange-400",
                  },
                },
              ].map((plan, index) => (
                <div
                  key={index}
                  className={`relative flex flex-col justify-between rounded-3xl p-8 xl:p-10 w-80
                    bg-gradient-to-b ${plan.colors.card} backdrop-blur-sm ${plan.colors.ring}
                    ring-1 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-x-4">
                      <h3 className="text-lg font-semibold leading-8 text-white">
                        {plan.name}
                      </h3>
                      {plan.popular && (
                        <p
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold leading-5 ${plan.colors.badge}`}
                        >
                          Most popular
                        </p>
                      )}
                    </div>
                    <p className="mt-6 flex items-baseline gap-x-1 text-white">
                      <span className="text-4xl font-bold tracking-tight">
                        ${plan.price}
                      </span>
                      <span className="text-sm font-semibold leading-6 text-gray-300">
                        /month
                      </span>
                    </p>
                    <ul
                      role="list"
                      className="mt-8 space-y-3 text-sm leading-6"
                    >
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-x-3">
                          <Check
                            className={`h-6 w-5 flex-none ${plan.colors.check}`}
                          />
                          <span className="text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <a
                    href={`mailto:hello@enmeshed.dev?subject=Interest in ${plan.name} Plan&body=Hi, I'm interested in learning more about the ${plan.name} plan for GridWalk.`}
                    className="mt-8 block"
                  >
                    <Button
                      className={`w-full rounded-xl h-12 text-white ${plan.colors.button}`}
                    >
                      Contact Us
                    </Button>
                  </a>
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
                {
                  name: "Contact",
                  href: "mailto:hello@enmeshed.dev",
                  icon: Mail,
                },
                { name: "Terms", href: "#" },
                { name: "Privacy", href: "#" },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-gray-400 hover:text-gray-300 transition-colors inline-flex items-center"
                >
                  {item.icon && <item.icon className="h-4 w-4 mr-1" />}
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
