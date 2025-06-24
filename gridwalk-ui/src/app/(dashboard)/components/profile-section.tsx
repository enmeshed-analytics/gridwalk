"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProfileData, logout } from "../actions";
import ProfileModal from "./profile-modal";

interface ClientProfileSectionProps {
  profileData: ProfileData;
}

export function ClientProfileSection({ profileData }: ClientProfileSectionProps) {
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/");
    }
  };
  
  return (
    <>
      <ProfileModal profileData={profileData} />
      <Button
        variant="ghost"
        className="w-full justify-start text-blue-500 hover:text-white hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </>
  );
}
