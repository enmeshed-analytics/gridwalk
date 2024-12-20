import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProfileData } from "./actions";
import { Button } from "@/components/ui/button";
import { User, Mail, Settings } from "lucide-react";

interface ProfileModalProps {
  profileData: ProfileData;
}

const ProfileModal = ({ profileData }: ProfileModalProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="flex items-center space-x-2 pl-0 py-4 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">
                {profileData.first_name[0]}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {profileData.first_name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {profileData.email}
            </p>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-2xl font-semibold text-white">
                {profileData.first_name[0]}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <User className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{profileData.first_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Mail className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{profileData.email}</p>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button className="flex-1">
              <Settings className="h-4 w-4 mr-2" />
              Account Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
