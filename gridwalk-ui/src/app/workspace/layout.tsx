'use client'
import React, { useEffect, useState } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./workspace-sidebar";
import { Menu } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [profileData, setProfileData] = useState({
    first_name: '',
    email: 'jane@company.com', // fallback default
    avatar_url: '/path/to/avatar.jpg' // fallback default
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/profile');
        
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        
        const data = await response.json();
        setProfileData({
          first_name: data.first_name,
          email: data.email || profileData.email,
          avatar_url: data.avatar_url || profileData.avatar_url
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError(error instanceof Error ? error.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, []); // Empty dependency array means this runs once on mount

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar
          userName={profileData.first_name}
          userEmail={profileData.email}
          avatarUrl={profileData.avatar_url}
        />
        <main className="flex-1 px-4 overflow-auto bg-gray-50">
          <div className="p-4">
            <SidebarTrigger className="lg:hidden">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            {isLoading ? (
              <div>Loading profile...</div>
            ) : error ? (
              <div>Error: {error}</div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
