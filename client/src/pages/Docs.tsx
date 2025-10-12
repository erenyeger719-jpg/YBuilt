import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, Code, Zap, Settings, Rocket, Shield } from "lucide-react";

export default function Docs() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background" data-testid="page-docs">
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
          <h1 className="text-4xl font-bold mb-2">Documentation</h1>
          <p className="text-muted-foreground">
            Learn how to build amazing websites with Ybuilt
          </p>
        </div>

        {/* Documentation Tabs */}
        <Tabs defaultValue="getting-started" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="getting-started" data-testid="tab-getting-started">
              Getting Started
            </TabsTrigger>
            <TabsTrigger value="api" data-testid="tab-api">
              API
            </TabsTrigger>
            <TabsTrigger value="features" data-testid="tab-features">
              Features
            </TabsTrigger>
            <TabsTrigger value="deployment" data-testid="tab-deployment">
              Deployment
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">
              Integrations
            </TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">
              Security
            </TabsTrigger>
          </TabsList>

          {/* Getting Started */}
          <TabsContent value="getting-started" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Getting Started</CardTitle>
                    <CardDescription className="mt-1">
                      Learn the basics of building with Ybuilt
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Quick Start</h2>
                  <p className="text-muted-foreground mb-3">
                    Create your first website in minutes with our AI-powered builder.
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Describe your website idea in the prompt</li>
                    <li>Let AI generate your initial design</li>
                    <li>Customize with our visual editor</li>
                    <li>Publish to the web instantly</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Documentation */}
          <TabsContent value="api" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Code className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>API Reference</CardTitle>
                    <CardDescription className="mt-1">
                      Complete API documentation for developers
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">REST API</h2>
                  <p className="text-muted-foreground mb-3">
                    Access Ybuilt features programmatically through our REST API.
                  </p>
                  <div className="bg-muted/30 rounded-md p-4 font-mono text-sm">
                    <div className="text-muted-foreground">POST /api/workspace/create</div>
                    <div className="text-muted-foreground mt-2">GET /api/workspace/:id</div>
                    <div className="text-muted-foreground mt-2">PUT /api/workspace/:id/files</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features */}
          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Platform Features</CardTitle>
                    <CardDescription className="mt-1">
                      Explore powerful features and capabilities
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 rounded-md border bg-card">
                    <h3 className="font-semibold mb-1">AI-Powered Generation</h3>
                    <p className="text-sm text-muted-foreground">
                      Build websites from text descriptions using advanced AI
                    </p>
                  </div>
                  <div className="p-3 rounded-md border bg-card">
                    <h3 className="font-semibold mb-1">Real-time Preview</h3>
                    <p className="text-sm text-muted-foreground">
                      See changes instantly with live preview
                    </p>
                  </div>
                  <div className="p-3 rounded-md border bg-card">
                    <h3 className="font-semibold mb-1">Version Control</h3>
                    <p className="text-sm text-muted-foreground">
                      Track changes and manage multiple versions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deployment */}
          <TabsContent value="deployment" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Rocket className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Deployment Guide</CardTitle>
                    <CardDescription className="mt-1">
                      Publish your website to production
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Publishing Steps</h2>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Click the Publish button in your workspace</li>
                    <li>Configure your domain settings</li>
                    <li>Review deployment settings</li>
                    <li>Deploy to production</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Integrations</CardTitle>
                    <CardDescription className="mt-1">
                      Connect with your favorite tools and services
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 rounded-md border bg-card">
                    <h3 className="font-semibold mb-1">Payment Processing</h3>
                    <p className="text-sm text-muted-foreground">
                      Integrate Stripe, PayPal, and more
                    </p>
                  </div>
                  <div className="p-3 rounded-md border bg-card">
                    <h3 className="font-semibold mb-1">Analytics</h3>
                    <p className="text-sm text-muted-foreground">
                      Track visitors with Google Analytics
                    </p>
                  </div>
                  <div className="p-3 rounded-md border bg-card">
                    <h3 className="font-semibold mb-1">Email Services</h3>
                    <p className="text-sm text-muted-foreground">
                      Send emails with SendGrid or Mailgun
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Security & Privacy</CardTitle>
                    <CardDescription className="mt-1">
                      Learn about our security practices
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Data Protection</h2>
                  <p className="text-muted-foreground mb-3">
                    Your data is encrypted at rest and in transit using industry-standard protocols.
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                    <li>End-to-end encryption</li>
                    <li>Regular security audits</li>
                    <li>SOC 2 Type II certified</li>
                    <li>GDPR compliant</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
