import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "outage";
  message?: string;
}

interface StatusResponse {
  ok: boolean;
  summary: string;
  services: ServiceStatus[];
  timestamp?: string;
}

export default function Status() {
  const [, navigate] = useLocation();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch status data with auto-refresh
  const { data, isLoading, refetch } = useQuery<StatusResponse>({
    queryKey: ["/api/status"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  useEffect(() => {
    setLastUpdated(new Date());
  }, [data]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle2 className="h-5 w-5 text-green-500" data-testid={`icon-status-operational`} />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-amber-500" data-testid={`icon-status-degraded`} />;
      case "outage":
        return <XCircle className="h-5 w-5 text-red-500" data-testid={`icon-status-outage`} />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-500";
      case "degraded":
        return "bg-amber-500";
      case "outage":
        return "bg-red-500";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-status">
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
          <h1 className="text-4xl font-bold mb-2">System Status</h1>
          <p className="text-muted-foreground">
            Current operational status of all Ybuilt services
          </p>
        </div>

        {/* Overall Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {data?.ok ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                )}
                <div>
                  <CardTitle data-testid="text-status-summary">
                    {data?.summary || "Loading status..."}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading}
                data-testid="button-refresh"
                aria-label="Refresh status"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Services Status */}
        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>
              Individual service status and health monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-muted/30 rounded-md animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {data?.services?.map((service, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-md border bg-card hover-elevate"
                    data-testid={`service-${service.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`h-3 w-3 rounded-full ${getStatusColor(service.status)}`}
                        data-testid={`indicator-${service.name.toLowerCase().replace(/\s+/g, "-")}`}
                      />
                      <div className="flex-1">
                        <div className="font-medium" data-testid={`text-service-name-${index}`}>
                          {service.name}
                        </div>
                        {service.message && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {service.message}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(service.status)}
                      <span className="text-sm capitalize text-muted-foreground">
                        {service.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-refresh Notice */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          Status automatically refreshes every 30 seconds
        </p>
      </div>
    </div>
  );
}
