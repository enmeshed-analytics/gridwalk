"use client";
import { Database, Star, Map, Activity, Users, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import GridBackground from "./login/components/gridBackground";
import { useRouter } from "next/navigation";
import RegisterInterestForm from "./registerInterest";

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
                <Star className="h-5 w-5 text-yellow-400 mr-2" />
                <span className="text-blue-200 font-medium">
                  Register for Early Access at the Bottom of the Page
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

        {/* Register Interest Form */}
        <RegisterInterestForm />

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
