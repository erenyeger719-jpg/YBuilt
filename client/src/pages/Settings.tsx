import { useEffect } from "react";
import { Route, Switch, useLocation, Redirect } from "wouter";
import Header from "@/components/Header";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Import settings forms
import Profile from "@/pages/settings/Profile";
import Account from "@/pages/settings/Account";
import { AppearanceForm } from "@/components/SettingsForm/AppearanceForm";
import { NotificationsForm } from "@/components/SettingsForm/NotificationsForm";
import { WorkspaceForm } from "@/components/SettingsForm/WorkspaceForm";
import { EditorForm } from "@/components/SettingsForm/EditorForm";
import { AIForm } from "@/components/SettingsForm/AIForm";
import { OrganizationForm } from "@/components/SettingsForm/OrganizationForm";
import { SecurityForm } from "@/components/SettingsForm/SecurityForm";
import { IntegrationsForm } from "@/components/SettingsForm/IntegrationsForm";
import { BillingForm } from "@/components/SettingsForm/BillingForm";
import { TeamForm } from "@/components/SettingsForm/TeamForm";
import { ExportData } from "@/components/SettingsForm/ExportData";

export default function Settings() {
  const { toast } = useToast();
  const [location] = useLocation();

  // Force Settings theme on mount
  useEffect(() => {
    document.body.dataset.forceTheme = "settings";
    return () => {
      delete document.body.dataset.forceTheme;
    };
  }, []);

  const handleRestoreDefaults = () => {
    toast({
      title: "Settings restored",
      description: "All settings have been reset to defaults",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="settings-root min-h-screen">
        {/* Settings content */}
        <div className="relative z-10 flex max-w-7xl mx-auto">
          {/* Sidebar */}
          <SettingsSidebar />

          {/* Main content */}
          <main className="flex-1 p-8 pt-24">
            <div className="max-w-3xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold mb-2 settings-text-light">Settings</h1>
                  <p className="text-muted-foreground">
                    Manage your account and workspace preferences
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreDefaults}
                  data-testid="button-restore-defaults"
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore Defaults
                </Button>
              </div>

              {/* Settings forms */}
              <div className="card-glass rounded-lg p-6">
                <div className="gloss-sheen" />
                <div className="relative z-10">
                  <Switch>
                    <Route path="/settings/profile" component={Profile} />
                    <Route path="/settings/account" component={Account} />
                    <Route path="/settings/appearance" component={AppearanceForm} />
                    <Route path="/settings/notifications" component={NotificationsForm} />
                    <Route path="/settings/workspace" component={WorkspaceForm} />
                    <Route path="/settings/editor" component={EditorForm} />
                    <Route path="/settings/ai" component={AIForm} />
                    <Route path="/settings/organization" component={OrganizationForm} />
                    <Route path="/settings/security" component={SecurityForm} />
                    <Route path="/settings/integrations" component={IntegrationsForm} />
                    <Route path="/settings/billing" component={BillingForm} />
                    <Route path="/settings/team" component={TeamForm} />
                    <Route path="/settings/export" component={ExportData} />
                    <Route path="/settings">
                      <Redirect to="/settings/profile" />
                    </Route>
                  </Switch>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
