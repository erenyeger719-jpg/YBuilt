import { useState, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import type { Settings } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HelpCircle, Plus, Trash2, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const WEEKDAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const EVENT_TYPES = [
  { id: "buildComplete", label: "Build Complete" },
  { id: "buildFail", label: "Build Failed" },
  { id: "publishComplete", label: "Publish Complete" },
  { id: "publishFail", label: "Publish Failed" },
  { id: "creditAlert", label: "Credit Alert" },
  { id: "billingAlert", label: "Billing Alert" },
  { id: "agentConfirmation", label: "Agent Confirmation" },
  { id: "securityAlert", label: "Security Alert" },
  { id: "systemStatus", label: "System Status" },
  { id: "teamInvite", label: "Team Invite" },
];

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "in-app", label: "In-App" },
  { value: "push", label: "Push" },
  { value: "sms", label: "SMS" },
];

export function NotificationsForm() {
  const { settings, loading, updateSection } = useSettings();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Local state for immediate UI updates - typed to match schema
  const [formData, setFormData] = useState<Settings['notifications']>({
    channels: {
      emailTransactional: true,
      emailMarketing: false,
      inApp: true,
      push: false,
      sms: false,
    },
    events: {
      buildComplete: true,
      buildFail: true,
      publishComplete: true,
      publishFail: true,
      creditAlert: true,
      billingAlert: true,
      agentConfirmation: true,
      securityAlert: true,
      systemStatus: true,
      teamInvite: true,
    },
    digest: {
      enabled: false,
      dailyTime: "08:00",
      weeklyDay: "monday",
      timezone: "UTC",
    },
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "08:00",
      timezone: "UTC",
    },
    delivery: "immediate",
    webhooks: [],
  });

  // Initialize from settings
  useEffect(() => {
    if (settings?.notifications) {
      setFormData(settings.notifications);
    }
  }, [settings]);

  const handleUpdate = async (updates: Partial<typeof formData>) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);

    // Auto-save
    setIsSaving(true);
    try {
      await updateSection("notifications", newData);
      toast({
        title: "Settings saved",
        description: "Notification preferences updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save notification settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChannelToggle = (channel: keyof typeof formData.channels, value: boolean) => {
    handleUpdate({ channels: { ...formData.channels, [channel]: value } });
  };

  const handleEventToggle = (event: keyof typeof formData.events, value: boolean) => {
    handleUpdate({ events: { ...formData.events, [event]: value } });
  };

  const handleDigestUpdate = (updates: Partial<typeof formData.digest>) => {
    handleUpdate({ digest: { ...formData.digest, ...updates } });
  };

  const handleQuietHoursUpdate = (updates: Partial<typeof formData.quietHours>) => {
    handleUpdate({ quietHours: { ...formData.quietHours, ...updates } });
  };

  const addWebhook = () => {
    const newWebhook = {
      id: `webhook-${Date.now()}`,
      url: "",
      events: [],
      enabled: true,
    };
    handleUpdate({ webhooks: [...formData.webhooks, newWebhook] });
  };

  const removeWebhook = (id: string) => {
    handleUpdate({ webhooks: formData.webhooks.filter(w => w.id !== id) });
  };

  const updateWebhook = (id: string, updates: Partial<typeof formData.webhooks[0]>) => {
    handleUpdate({
      webhooks: formData.webhooks.map(w => w.id === id ? { ...w, ...updates } : w)
    });
  };

  const sendTestNotification = async (channel: string) => {
    setIsSendingTest(true);
    try {
      const response = await apiRequest(
        "POST",
        "/api/users/demo/notifications/test",
        { channel, eventType: "buildComplete" }
      );
      const data = await response.json();
      
      toast({
        title: "Test notification sent",
        description: data.message || `Sent to ${channel}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold settings-text-light">Notifications</h2>
          <p className="text-muted-foreground mt-1">
            Manage how you receive notifications and alerts
          </p>
        </div>
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Notification Channels */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Channels</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Choose which channels can send you notifications</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-transactional">Transactional Email</Label>
              <p className="text-sm text-muted-foreground">Important account and system notifications</p>
            </div>
            <Switch
              id="email-transactional"
              data-testid="toggle-email-transactional"
              checked={formData.channels.emailTransactional}
              onCheckedChange={(checked) => handleChannelToggle("emailTransactional", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-marketing">Marketing Email</Label>
              <p className="text-sm text-muted-foreground">Updates, tips, and promotional content</p>
            </div>
            <Switch
              id="email-marketing"
              data-testid="toggle-email-marketing"
              checked={formData.channels.emailMarketing}
              onCheckedChange={(checked) => handleChannelToggle("emailMarketing", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app">In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">Show notifications within the application</p>
            </div>
            <Switch
              id="in-app"
              data-testid="toggle-in-app"
              checked={formData.channels.inApp}
              onCheckedChange={(checked) => handleChannelToggle("inApp", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Browser and mobile push notifications</p>
            </div>
            <Switch
              id="push"
              data-testid="toggle-push"
              checked={formData.channels.push}
              onCheckedChange={(checked) => handleChannelToggle("push", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sms">SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">Text message alerts for critical events</p>
            </div>
            <Switch
              id="sms"
              data-testid="toggle-sms"
              checked={formData.channels.sms}
              onCheckedChange={(checked) => handleChannelToggle("sms", checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Notification Events */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Events</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Select which events trigger notifications</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EVENT_TYPES.map((event) => (
            <div key={event.id} className="flex items-center justify-between">
              <Label htmlFor={event.id}>{event.label}</Label>
              <Switch
                id={event.id}
                data-testid={`toggle-event-${event.id}`}
                checked={formData.events[event.id as keyof typeof formData.events]}
                onCheckedChange={(checked) => handleEventToggle(event.id as keyof typeof formData.events, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Digest Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Digest</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Receive notifications in batched digests instead of immediately</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="digest-enabled">Enable Digest Mode</Label>
          <Switch
            id="digest-enabled"
            data-testid="toggle-digest-enabled"
            checked={formData.digest.enabled}
            onCheckedChange={(checked) => handleDigestUpdate({ enabled: checked })}
          />
        </div>

        {formData.digest.enabled && (
          <div className="space-y-3 pl-4 border-l-2">
            <div className="space-y-2">
              <Label htmlFor="digest-time">Daily Time</Label>
              <Input
                id="digest-time"
                data-testid="input-digest-time"
                type="time"
                value={formData.digest.dailyTime}
                onChange={(e) => handleDigestUpdate({ dailyTime: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="digest-weekday">Weekly Day</Label>
              <Select
                value={formData.digest.weeklyDay}
                onValueChange={(value) => handleDigestUpdate({ weeklyDay: value as typeof formData.digest.weeklyDay })}
              >
                <SelectTrigger id="digest-weekday" data-testid="select-digest-weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="digest-timezone">Timezone</Label>
              <Select
                value={formData.digest.timezone}
                onValueChange={(value) => handleDigestUpdate({ timezone: value })}
              >
                <SelectTrigger id="digest-timezone" data-testid="select-digest-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Quiet Hours */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Quiet Hours</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Mute notifications during specific hours</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="quiet-hours-enabled">Enable Quiet Hours</Label>
          <Switch
            id="quiet-hours-enabled"
            data-testid="toggle-quiet-hours-enabled"
            checked={formData.quietHours.enabled}
            onCheckedChange={(checked) => handleQuietHoursUpdate({ enabled: checked })}
          />
        </div>

        {formData.quietHours.enabled && (
          <div className="space-y-3 pl-4 border-l-2">
            <div className="space-y-2">
              <Label htmlFor="quiet-hours-start">Start Time</Label>
              <Input
                id="quiet-hours-start"
                data-testid="input-quiet-hours-start"
                type="time"
                value={formData.quietHours.start}
                onChange={(e) => handleQuietHoursUpdate({ start: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quiet-hours-end">End Time</Label>
              <Input
                id="quiet-hours-end"
                data-testid="input-quiet-hours-end"
                type="time"
                value={formData.quietHours.end}
                onChange={(e) => handleQuietHoursUpdate({ end: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quiet-hours-timezone">Timezone</Label>
              <Select
                value={formData.quietHours.timezone}
                onValueChange={(value) => handleQuietHoursUpdate({ timezone: value })}
              >
                <SelectTrigger id="quiet-hours-timezone" data-testid="select-quiet-hours-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Delivery Method */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Delivery Method</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Choose how quickly notifications are delivered</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <RadioGroup
          value={formData.delivery}
          onValueChange={(value) => handleUpdate({ delivery: value as typeof formData.delivery })}
          className="grid grid-cols-2 gap-4"
        >
          <div className="flex items-center space-x-2 border rounded-md p-3 hover-elevate active-elevate-2">
            <RadioGroupItem value="immediate" id="delivery-immediate" data-testid="radio-delivery-immediate" />
            <Label htmlFor="delivery-immediate" className="cursor-pointer flex-1">
              <div>Immediate</div>
              <p className="text-xs text-muted-foreground">Receive notifications instantly</p>
            </Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-md p-3 hover-elevate active-elevate-2">
            <RadioGroupItem value="batched" id="delivery-batched" data-testid="radio-delivery-batched" />
            <Label htmlFor="delivery-batched" className="cursor-pointer flex-1">
              <div>Batched</div>
              <p className="text-xs text-muted-foreground">Group notifications together</p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      {/* Webhooks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">Webhooks</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Configure webhook endpoints to receive notifications programmatically</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={addWebhook}
            data-testid="button-add-webhook"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Webhook
          </Button>
        </div>

        <div className="space-y-3">
          {formData.webhooks.map((webhook) => (
            <Card key={webhook.id} className="p-4" data-testid={`card-webhook-${webhook.id}`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`webhook-url-${webhook.id}`}>Webhook URL</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeWebhook(webhook.id)}
                    data-testid={`button-remove-webhook-${webhook.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Input
                  id={`webhook-url-${webhook.id}`}
                  data-testid={`input-webhook-url-${webhook.id}`}
                  type="url"
                  placeholder="https://api.example.com/webhook"
                  value={webhook.url}
                  onChange={(e) => updateWebhook(webhook.id, { url: e.target.value })}
                />

                <div className="space-y-2">
                  <Label htmlFor={`webhook-secret-${webhook.id}`}>Secret (optional)</Label>
                  <Input
                    id={`webhook-secret-${webhook.id}`}
                    data-testid={`input-webhook-secret-${webhook.id}`}
                    type="password"
                    placeholder="Webhook signing secret"
                    value={webhook.secret || ""}
                    onChange={(e) => updateWebhook(webhook.id, { secret: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {EVENT_TYPES.map((event) => (
                      <div key={event.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`webhook-${webhook.id}-event-${event.id}`}
                          data-testid={`checkbox-webhook-${webhook.id}-event-${event.id}`}
                          checked={webhook.events.includes(event.id)}
                          onChange={(e) => {
                            const newEvents = e.target.checked
                              ? [...webhook.events, event.id]
                              : webhook.events.filter(ev => ev !== event.id);
                            updateWebhook(webhook.id, { events: newEvents });
                          }}
                          className="rounded border-input"
                        />
                        <Label
                          htmlFor={`webhook-${webhook.id}-event-${event.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {event.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id={`webhook-enabled-${webhook.id}`}
                    data-testid={`toggle-webhook-enabled-${webhook.id}`}
                    checked={webhook.enabled}
                    onCheckedChange={(checked) => updateWebhook(webhook.id, { enabled: checked })}
                  />
                  <Label htmlFor={`webhook-enabled-${webhook.id}`}>Enabled</Label>
                </div>
              </div>
            </Card>
          ))}

          {formData.webhooks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No webhooks configured. Click "Add Webhook" to create one.
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Test Notification */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Test Notifications</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Send a test notification to verify your settings</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={isSendingTest}
                data-testid="button-test-notification"
              >
                {isSendingTest ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Test Notification
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {CHANNEL_OPTIONS.map((channel) => (
                <DropdownMenuItem
                  key={channel.value}
                  onClick={() => sendTestNotification(channel.value)}
                  data-testid={`menuitem-test-${channel.value}`}
                >
                  {channel.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-sm text-muted-foreground">
            Select a channel to send a test notification
          </p>
        </div>
      </div>
    </div>
  );
}
