import { getProfile, getWorkspaces } from './actions'
import { Sidebar } from './sidebar'

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profileData = await getProfile()
  const workspaceData = await getWorkspaces()
  
  // Get initials from profile data
  const initials = `${profileData.first_name?.[0] || ''}${profileData.last_name?.[0] || ''}`.toUpperCase()

  return (
    <div className="flex h-screen">
      <Sidebar profileData={profileData} workspaceData={workspaceData} />
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile header with spacer and profile circle */}
        <div className="flex items-center justify-end px-4 h-16 md:h-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400 text-sm font-medium">
            {initials}
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
