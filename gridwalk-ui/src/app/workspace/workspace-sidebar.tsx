import React from 'react';
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { Database, Map } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface AppSidebarProps {
  userName?: string;
  userEmail?: string;
}

const navItems = [
  { icon: Map, label: 'Projects', href: '/workspace' },
  { icon: Database, label: 'Connections', href: '/workspace' },
];

export function AppSidebar({userName, userEmail, avatarUrl}: AppSidebarProps) {
  // Get first letter of name for avatar fallback
  const avatar = userName.charAt(0).toUpperCase();

  return (
    <Sidebar className="">
      <SidebarContent>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="px-4 py-6">
            <h1 className="text-xl font-bold">Workspace</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100"
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </a>
            ))}
          </nav>

          {/* User Profile */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{avatar}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
              </div>
            </div>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
