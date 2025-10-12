import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Users, BookOpen, Github, Twitter, Youtube } from "lucide-react";

export default function Community() {
  const [, navigate] = useLocation();

  const communityLinks = [
    {
      icon: MessageSquare,
      title: "Discord Community",
      description: "Join our Discord server to chat with other users and get help",
      url: "https://discord.gg/ybuilt",
      buttonText: "Join Discord",
    },
    {
      icon: Users,
      title: "Community Forum",
      description: "Discuss ideas, share projects, and get feedback from the community",
      url: "https://community.ybuilt.com",
      buttonText: "Visit Forum",
    },
    {
      icon: BookOpen,
      title: "Blog & Tutorials",
      description: "Read the latest updates, tutorials, and best practices",
      url: "https://blog.ybuilt.com",
      buttonText: "Read Blog",
    },
    {
      icon: Github,
      title: "GitHub",
      description: "Explore our open-source projects and contribute to the platform",
      url: "https://github.com/ybuilt",
      buttonText: "View GitHub",
    },
    {
      icon: Twitter,
      title: "Twitter/X",
      description: "Follow us for updates, tips, and community highlights",
      url: "https://twitter.com/ybuilt",
      buttonText: "Follow Us",
    },
    {
      icon: Youtube,
      title: "YouTube Channel",
      description: "Watch video tutorials and learn from our community showcase",
      url: "https://youtube.com/@ybuilt",
      buttonText: "Subscribe",
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="page-community">
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
          <h1 className="text-4xl font-bold mb-2">Community</h1>
          <p className="text-muted-foreground">
            Join the Ybuilt community and connect with creators worldwide
          </p>
        </div>

        {/* Community Cards */}
        <div className="space-y-4">
          {communityLinks.map((link, index) => (
            <Card key={index} className="hover-elevate" data-testid={`card-community-${index}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-md bg-primary/10">
                      <link.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{link.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {link.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => window.open(link.url, "_blank")}
                    data-testid={`button-community-${index}`}
                    aria-label={link.buttonText}
                  >
                    {link.buttonText}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Community Guidelines */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Community Guidelines</CardTitle>
            <CardDescription>
              Help us maintain a positive and inclusive environment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Be respectful and kind to all community members</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Share knowledge and help others learn</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>No spam, self-promotion, or off-topic content</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Report abuse or violations to our moderation team</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
