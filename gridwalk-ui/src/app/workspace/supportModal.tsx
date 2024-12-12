'use client'
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Mail, X, ChevronRight, Book } from 'lucide-react';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SupportOption = {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
};

const HelpSupportModal: React.FC<HelpSupportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleEmailSupport = () => {
    const subject = encodeURIComponent('Support Request: Help Needed');
    const body = encodeURIComponent(`
Hello GridWalk team,
I need help with:
[Please describe your issue here]

How urgent is this issue:
[low, medium, high]

System Details:
- Browser: ${navigator.userAgent}
- URL: ${window.location.href}
- Time: ${new Date().toISOString()}

Best regards,
[Your name]
    `.trim());
    window.location.href = `mailto:hello@enmeshed.dev?subject=${subject}&body=${body}`;
  };

  const handleGithubSupport = () => {
    window.open('https://github.com/enmeshed-analytics/gridwalk', '_blank');
  };


  const supportOptions: SupportOption[] = [
    {
      title: 'Email Support',
      description: 'Send us an email and we\'ll get back to you within 24 hours.',
      icon: <Mail className="h-5 w-5 text-blue-500" />,
      action: handleEmailSupport
    },
    {
      title: 'Documentation',
      description: 'Check out the GridWalk Documentation for more info.',
      icon: <Book className="h-5 w-5 text-purple-500" />,
      action: handleGithubSupport
    }
  ];

  return (
    <div className="fixed bottom-0 right-0 p-6 pt-0 z-50">
      <div className="mb-20 w-[320px] animate-in slide-in-from-bottom-24 duration-300">
        <Card className="bg-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-black font-bold">Help & Support 👋 </CardTitle>
            <button
              onClick={onClose}
              className="rounded-full p-1 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {supportOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={option.action}
                  title={`Get ${option.title} support`} 
                  className="w-full p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 rounded-full bg-gray-100 group-hover:bg-white transition-colors">
                      {option.icon}
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium text-gray-900">{option.title}</h3>
                      <p className="text-sm text-gray-500">{option.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export { HelpSupportModal };