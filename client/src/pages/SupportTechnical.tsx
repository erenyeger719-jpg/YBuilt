import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code, Bug, Zap, Globe, HelpCircle } from "lucide-react";
import GetHelpModal from "@/components/GetHelpModal";

export default function SupportTechnical() {
  const [, navigate] = useLocation();
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const technicalTopics = [
    {
      icon: Code,
      title: "Build Issues",
      description: "Troubleshoot build errors and compilation problems",
    },
    {
      icon: Bug,
      title: "Bug Reports",
      description: "Report bugs and unexpected behavior",
    },
    {
      icon: Zap,
      title: "Performance",
      description: "Get help with performance and optimization",
    },
    {
      icon: Globe,
      title: "Deployment",
      description: "Resolve deployment and publishing issues",
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="page-support-technical">
      <div className="max-w-4xl mx-auto p-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="mb-6 gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Technical Support</h1>
          <p className="text-muted-foreground">
            Get help with technical issues and troubleshooting
          </p>
        </div>

        {/* Topics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {technicalTopics.map((topic, index) => (
            <Card key={index} className="hover-elevate cursor-pointer" data-testid={`card-topic-${index}`}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <topic.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{topic.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {topic.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Get Help Card */}
        <Card>
          <CardHeader>
            <CardTitle>Need Additional Help?</CardTitle>
            <CardDescription>
              Our technical team is here to help resolve your issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setHelpModalOpen(true)}
              data-testid="button-get-help"
              className="gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              Contact Technical Support
            </Button>
          </CardContent>
        </Card>

        {/* Help Modal */}
        <GetHelpModal open={helpModalOpen} onOpenChange={setHelpModalOpen} />
      </div>
    </div>
  );
}
