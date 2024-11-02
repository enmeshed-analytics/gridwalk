import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function Workspace() {
  const projects = [
    {
      title: "Downtown District Mapping",
      description: "Detailed street-level mapping of the central business district",
      status: "In Progress",
    },
    {
      title: "Parks & Recreation Zones",
      description: "Comprehensive mapping of public recreational areas and green spaces",
      status: "Planning",
    },
    {
      title: "Historic Districts Survey",
      description: "Documentation and mapping of heritage sites and landmarks",
      status: "Not Started",
    }
  ];

  return (
    <div className="mt-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          Map Projects
        </h1>
        <p className="text-slate-600 text-lg font-medium">
          Geographic information systems and mapping initiatives
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, index) => (
          <Card key={index} className="group hover:shadow-lg transition-all duration-300">
            <div className="aspect-video w-full relative overflow-hidden">
              <img
                src="/map-placeholder.png"
                alt={`Map preview for ${project.title}`}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-2 right-2">
                <span className="bg-white/90 backdrop-blur-sm text-slate-700 px-3 py-1 rounded-full text-sm font-medium">
                  {project.status}
                </span>
              </div>
            </div>
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-bold text-slate-900 line-clamp-1">
                {project.title}
              </CardTitle>
              <CardDescription className="text-slate-600 font-medium line-clamp-2">
                {project.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
