'use client'
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu, LogOut } from "lucide-react"
import { ProfileData, Workspaces, logout } from "./actions"
import { useRouter } from 'next/navigation'

interface SidebarProps {
  profileData: ProfileData;
  workspaceData: Workspaces;
}

const LogoutButton = () => {
  const router = useRouter()
  
  const handleLogout = async () => {
    try {
      // Call the server action and let it handle the redirect
      await logout()
    } catch (error) {
      // If there's an error, fall back to client-side navigation
      console.error('Logout error:', error)
      router.push('/')
    }
  }
  
  return (
    <Button 
      variant="ghost" 
      className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
      onClick={handleLogout}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  )
}

const SidebarContent = ({ profileData, workspaceData }: {profileData: ProfileData, workspaceData: Workspaces}) => (
  <div className="h-full flex flex-col">
    <div className="p-4 text-xl font-semibold">
      Workspaces
    </div>
    
    <ScrollArea className="flex-1 px-2">
      <div className="space-y-2">
        {workspaceData.map((workspace) => (
          <Link
            key={workspace.id}
            href={`/workspace/${workspace.id}`}
            className="block w-full text-left p-3 rounded-lg dark:bg-gray-700 bg-gray-100 dark:bg-gray-800 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            {workspace.name}
          </Link>
        ))}
      </div>
    </ScrollArea>
    
    <div className="p-4 border-t">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{profileData.first_name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{profileData.email}</p>
        </div>
        <LogoutButton />
      </div>
    </div>
  </div>
);

export default SidebarContent;

export function Sidebar({ profileData, workspaceData }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <aside className="w-64 border-r h-full">
          <SidebarContent profileData={profileData} workspaceData={workspaceData} />
        </aside>
      </div>
      {/* Mobile sidebar */}
      <div className="block md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" size="icon" className="absolute bg-blue-600/60 top-4 left-4">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent profileData={profileData} workspaceData={workspaceData} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
