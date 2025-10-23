import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Link as WouterLink } from "wouter";
import {
  Mail,
  Lock,
  Globe,
  Bell,
  Download,
  CreditCard,
  Gift,
  Shield,
  Key,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  Link2,
  Palette,
  Check,
  ExternalLink,
  Server,
  AlertTriangle,
} from "lucide-react";
import { SiGithub, SiGoogle, SiFacebook, SiApple } from "react-icons/si";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const emailSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
});

const sshKeySchema = z.object({
  name: z.string().min(1, "Name is required"),
  key: z.string()
    .min(1, "SSH key is required")
    .refine((key) => key.startsWith("ssh-rsa") || key.startsWith("ssh-ed25519"), {
      message: "Invalid SSH key format (must start with ssh-rsa or ssh-ed25519)",
    }),
});

const secretSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[A-Z_]+$/, "Must be uppercase with underscores"),
  value: z.string().min(1, "Value is required"),
});

const domainSchema = z.object({
  domain: z.string()
    .min(1, "Domain is required")
    .regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, "Invalid domain format"),
});

export default function Account() {
  const { toast } = useToast();
  const [userId] = useState("demo");

  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [addSshKeyOpen, setAddSshKeyOpen] = useState(false);
  const [addSecretOpen, setAddSecretOpen] = useState(false);
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<{
    type: "ssh" | "secret" | "domain" | "role";
    id: string;
  } | null>(null);

  const [exportProgress, setExportProgress] = useState<number | null>(null);

  // Fetch user data
  const { data: userData } = useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
  });

  // Fetch billing data
  const { data: billingData } = useQuery({
    queryKey: ["/api/users", userId, "billing"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/billing`);
      if (!response.ok) throw new Error("Failed to fetch billing");
      return response.json();
    },
  });

  // Fetch SSH keys
  const { data: sshKeys } = useQuery({
    queryKey: ["/api/users", userId, "ssh-keys"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/ssh-keys`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch secrets
  const { data: secrets } = useQuery({
    queryKey: ["/api/users", userId, "secrets"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/secrets`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch integrations
  const { data: integrations } = useQuery({
    queryKey: ["/api/users", userId, "integrations"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/integrations`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch domains
  const { data: domains } = useQuery({
    queryKey: ["/api/users", userId, "domains"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/domains`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const user = userData?.user || {};
  const billing = billingData || {};

  // Forms
  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "" },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const sshKeyForm = useForm({
    resolver: zodResolver(sshKeySchema),
    defaultValues: { name: "", key: "" },
  });

  const secretForm = useForm({
    resolver: zodResolver(secretSchema),
    defaultValues: { name: "", value: "" },
  });

  const domainForm = useForm({
    resolver: zodResolver(domainSchema),
    defaultValues: { domain: "" },
  });

  // Mutations
  const changeEmailMutation = useMutation({
    mutationFn: async (data: { newEmail: string }) => {
      return apiRequest("POST", `/api/users/${userId}/email/change`, data);
    },
    onSuccess: () => {
      toast({ title: "Verification email sent", description: "Check your inbox to confirm" });
      setChangeEmailOpen(false);
      emailForm.reset();
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordSchema>) => {
      return apiRequest("POST", `/api/users/${userId}/password/change`, data);
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated" });
      setChangePasswordOpen(false);
      passwordForm.reset();
    },
  });

  const updateRegionMutation = useMutation({
    mutationFn: async (region: string) => {
      return apiRequest("PATCH", `/api/users/${userId}/region`, { region });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      toast({ title: "Region updated", description: "Server location has been changed" });
      setRegionDialogOpen(false);
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: { transactional?: boolean; marketing?: boolean }) => {
      return apiRequest("PATCH", `/api/users/${userId}/notifications`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      toast({ title: "Saved", description: "Notification preferences updated" });
    },
  });

  const exportAppsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/users/${userId}/export-apps`);
    },
    onSuccess: async (response) => {
      setExportProgress(100);
      const data = await response.json();
      setTimeout(() => {
        toast({
          title: "Export ready",
          description: (
            <a href={data.downloadUrl} className="underline" download>
              Download your apps
            </a>
          ),
        });
        setExportProgress(null);
      }, 500);
    },
  });

  const addSshKeyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof sshKeySchema>) => {
      return apiRequest("POST", `/api/users/${userId}/ssh-keys`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "ssh-keys"] });
      toast({ title: "SSH key added" });
      setAddSshKeyOpen(false);
      sshKeyForm.reset();
    },
  });

  const deleteSshKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}/ssh-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "ssh-keys"] });
      toast({ title: "SSH key deleted" });
      setDeleteDialogOpen(null);
    },
  });

  const addSecretMutation = useMutation({
    mutationFn: async (data: z.infer<typeof secretSchema>) => {
      return apiRequest("POST", `/api/users/${userId}/secrets`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "secrets"] });
      toast({ title: "Secret added" });
      setAddSecretOpen(false);
      secretForm.reset();
    },
  });

  const deleteSecretMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("DELETE", `/api/users/${userId}/secrets/${name}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "secrets"] });
      toast({ title: "Secret deleted" });
      setDeleteDialogOpen(null);
    },
  });

  const connectServiceMutation = useMutation({
    mutationFn: async (provider: string) => {
      return apiRequest("POST", `/api/users/${userId}/integrations/${provider}/connect`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "integrations"] });
      toast({ title: "Service connected" });
    },
  });

  const disconnectServiceMutation = useMutation({
    mutationFn: async (provider: string) => {
      return apiRequest("DELETE", `/api/users/${userId}/integrations/${provider}/disconnect`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "integrations"] });
      toast({ title: "Service disconnected" });
    },
  });

  const addDomainMutation = useMutation({
    mutationFn: async (data: z.infer<typeof domainSchema>) => {
      return apiRequest("POST", `/api/users/${userId}/domains`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "domains"] });
      toast({ title: "Domain added" });
      setAddDomainOpen(false);
      domainForm.reset();
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}/domains/${domainId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "domains"] });
      toast({ title: "Domain deleted" });
      setDeleteDialogOpen(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { role: string; action: "add" | "remove" }) => {
      return apiRequest("POST", `/api/users/${userId}/roles`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      toast({ title: "Role updated" });
      setDeleteDialogOpen(null);
    },
  });

  const handleExportApps = () => {
    setExportProgress(0);
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev === null) return null;
        if (prev >= 90) {
          clearInterval(interval);
          exportAppsMutation.mutate();
          return 90;
        }
        return prev + 10;
      });
    }, 200);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const toggleSecretReveal = (name: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const regions = [
    { value: "us-east", label: "US East" },
    { value: "eu-west", label: "EU West" },
    { value: "asia-pacific", label: "Asia Pacific" },
  ];

  const providers = [
    { id: "github", name: "GitHub", icon: SiGithub },
    { id: "google", name: "Google", icon: SiGoogle },
    { id: "facebook", name: "Facebook", icon: SiFacebook },
    { id: "apple", name: "Apple", icon: SiApple },
  ];

  const mockThemes = [
    { id: "dark-pro", name: "Dark Pro", official: true, installed: true },
    { id: "light-minimal", name: "Light Minimal", official: true, installed: false },
    { id: "ocean-blue", name: "Ocean Blue", official: false, installed: true },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Email & Password */}
        <motion.div variants={item}>
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle>Email & Password</CardTitle>
                  <CardDescription>Manage your login credentials</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <p className="text-sm font-medium">{user.email || "demo@ybuilt.com"}</p>
                </div>
                <Dialog open={changeEmailOpen} onOpenChange={setChangeEmailOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-change-email">
                      Change Email
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Email</DialogTitle>
                      <DialogDescription>
                        Enter your new email address. We'll send a verification link.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="new-email">New Email</Label>
                        <Input
                          id="new-email"
                          type="email"
                          data-testid="input-new-email"
                          {...emailForm.register("newEmail")}
                        />
                        {emailForm.formState.errors.newEmail && (
                          <p className="text-sm text-destructive mt-1">
                            {emailForm.formState.errors.newEmail.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={emailForm.handleSubmit((data) => changeEmailMutation.mutate(data))}
                        disabled={changeEmailMutation.isPending}
                      >
                        Send Verification
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Password</Label>
                <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Lock className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>
                        Password must be at least 8 characters with uppercase, lowercase, and number.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input
                          id="current-password"
                          type="password"
                          data-testid="input-current-password"
                          {...passwordForm.register("currentPassword")}
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          data-testid="input-new-password"
                          {...passwordForm.register("newPassword")}
                        />
                        {passwordForm.formState.errors.newPassword && (
                          <p className="text-sm text-destructive mt-1">
                            {passwordForm.formState.errors.newPassword.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          {...passwordForm.register("confirmPassword")}
                        />
                        {passwordForm.formState.errors.confirmPassword && (
                          <p className="text-sm text-destructive mt-1">
                            {passwordForm.formState.errors.confirmPassword.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        data-testid="button-save-password"
                        onClick={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))}
                        disabled={changePasswordMutation.isPending}
                      >
                        Save Password
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2. Server Location */}
        <motion.div variants={item}>
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle>Server Location</CardTitle>
                  <CardDescription>Choose your deployment region</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="region">Current Region</Label>
                <Select
                  value={user.region || "us-east"}
                  onValueChange={(value) => {
                    setSelectedRegion(value);
                    setRegionDialogOpen(true);
                  }}
                >
                  <SelectTrigger id="region" data-testid="select-region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <AlertDialog open={regionDialogOpen} onOpenChange={setRegionDialogOpen}>
                <AlertDialogContent data-testid="dialog-confirm-region">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Change Server Region?</AlertDialogTitle>
                    <AlertDialogDescription>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                        <span>
                          This will affect your deployments and may cause downtime. Are you sure?
                        </span>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => selectedRegion && updateRegionMutation.mutate(selectedRegion)}
                    >
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3. Notifications */}
        <motion.div variants={item}>
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Manage email preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="transactional">Transactional Emails</Label>
                  <p className="text-sm text-muted-foreground">Account updates, security alerts</p>
                </div>
                <Switch
                  id="transactional"
                  data-testid="switch-transactional"
                  checked={user.notificationSettings?.transactional ?? true}
                  onCheckedChange={(checked) =>
                    updateNotificationsMutation.mutate({ transactional: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="marketing">Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">Product updates, newsletters</p>
                </div>
                <Switch
                  id="marketing"
                  data-testid="switch-marketing"
                  checked={user.notificationSettings?.marketing ?? false}
                  onCheckedChange={(checked) =>
                    updateNotificationsMutation.mutate({ marketing: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 4. Export Apps */}
        <motion.div variants={item}>
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle>Export Apps</CardTitle>
                  <CardDescription>Download all your projects</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleExportApps}
                disabled={exportProgress !== null}
                data-testid="button-export-apps"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Export All Projects
              </Button>
              {exportProgress !== null && (
                <div className="space-y-2">
                  <Progress value={exportProgress} />
                  <p className="text-sm text-center text-muted-foreground" data-testid="text-export-status">
                    {exportProgress < 100 ? `Exporting... ${exportProgress}%` : "Ready to download"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 5. Billing & Plan */}
      <motion.div variants={item}>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle>Billing & Plan</CardTitle>
                <CardDescription>Manage your subscription and usage</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Current Plan</Label>
                <p className="text-lg font-semibold" data-testid="text-current-plan">
                  {billing.plan || "Replit Core"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Next Payment</Label>
                <p className="text-lg font-semibold">
                  {billing.nextBillingDate || "Jan 15, 2026"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Amount</Label>
                <p className="text-lg font-semibold">{billing.amount || "$20/mo"}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <WouterLink href="/billing/plans">
                <Button variant="outline" data-testid="button-change-plan">
                  Change Plan
                </Button>
              </WouterLink>
              <Button variant="outline" data-testid="button-manage-payment">
                Manage Payment Method
              </Button>
            </div>

            <div className="space-y-3">
              <Label>Usage Alert Threshold (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  defaultValue={[80]}
                  max={100}
                  step={5}
                  className="flex-1"
                  data-testid="input-usage-alert"
                />
                <Input type="number" value="80" className="w-20" readOnly />
              </div>
              <p className="text-sm text-muted-foreground">
                Get notified when you reach this percentage of your plan limits
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 6. Referrals & Credits */}
      <motion.div variants={item}>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle>Referrals & Credits</CardTitle>
                <CardDescription>Invite friends and earn rewards</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Your Referral Link</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={`https://ybuilt.app/ref/${user.referralCode || "DEMO123"}`}
                  readOnly
                />
                <Button
                  variant="outline"
                  size="icon"
                  data-testid="button-copy-referral"
                  onClick={() =>
                    copyToClipboard(`https://ybuilt.app/ref/${user.referralCode || "DEMO123"}`)
                  }
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Credits Earned</p>
                <p className="text-2xl font-bold" data-testid="text-referral-credits">
                  ${user.referralCredits || 0}
                </p>
              </div>
              <Gift className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 7. Roles */}
      <motion.div variants={item}>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle>Roles</CardTitle>
                <CardDescription>Manage your account permissions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(user.roles || ["User"]).map((role: string) => (
                <Badge
                  key={role}
                  variant="secondary"
                  data-testid={`badge-role-${role.toLowerCase()}`}
                  className="gap-2"
                >
                  {role}
                  {role !== "User" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      data-testid={`button-remove-role-${role.toLowerCase()}`}
                      onClick={() =>
                        setDeleteDialogOpen({ type: "role", id: role })
                      }
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Explorer Program</Label>
                  <p className="text-sm text-muted-foreground">Test new features early</p>
                </div>
                <Switch
                  checked={(user.roles || []).includes("Explorer")}
                  onCheckedChange={(checked) =>
                    updateRoleMutation.mutate({
                      role: "Explorer",
                      action: checked ? "add" : "remove",
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Beta Tester</Label>
                  <p className="text-sm text-muted-foreground">Help test beta features</p>
                </div>
                <Switch
                  checked={(user.roles || []).includes("Tester")}
                  onCheckedChange={(checked) =>
                    updateRoleMutation.mutate({
                      role: "Tester",
                      action: checked ? "add" : "remove",
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 8. SSH Keys */}
      <motion.div variants={item}>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle>SSH Keys</CardTitle>
                  <CardDescription>Manage deployment keys</CardDescription>
                </div>
              </div>
              <Dialog open={addSshKeyOpen} onOpenChange={setAddSshKeyOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-ssh-key">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add SSH Key</DialogTitle>
                    <DialogDescription>
                      Paste your public SSH key (ssh-rsa or ed25519)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="ssh-name">Key Name</Label>
                      <Input
                        id="ssh-name"
                        placeholder="My Laptop"
                        {...sshKeyForm.register("name")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ssh-key">Public Key</Label>
                      <Textarea
                        id="ssh-key"
                        data-testid="input-ssh-key"
                        placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
                        rows={4}
                        {...sshKeyForm.register("key")}
                      />
                      {sshKeyForm.formState.errors.key && (
                        <p className="text-sm text-destructive mt-1">
                          {sshKeyForm.formState.errors.key.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={sshKeyForm.handleSubmit((data) => addSshKeyMutation.mutate(data))}
                      disabled={addSshKeyMutation.isPending}
                    >
                      Add Key
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {(sshKeys || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No SSH keys added</p>
            ) : (
              <div className="space-y-3">
                {(sshKeys || []).map((key: any) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{key.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">{key.fingerprint}</p>
                      <p className="text-sm text-muted-foreground">Added {key.createdAt}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-delete-ssh-key-${key.id}`}
                      onClick={() => setDeleteDialogOpen({ type: "ssh", id: key.id })}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 9. Account Secrets */}
      <motion.div variants={item}>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle>Account Secrets</CardTitle>
                  <CardDescription>Environment variables and API keys</CardDescription>
                </div>
              </div>
              <Dialog open={addSecretOpen} onOpenChange={setAddSecretOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-secret">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Secret
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Secret</DialogTitle>
                    <DialogDescription>
                      Add an environment variable or API key
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="secret-name">Name (UPPERCASE_SNAKE_CASE)</Label>
                      <Input
                        id="secret-name"
                        data-testid="input-secret-name"
                        placeholder="API_KEY"
                        {...secretForm.register("name")}
                      />
                      {secretForm.formState.errors.name && (
                        <p className="text-sm text-destructive mt-1">
                          {secretForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="secret-value">Value</Label>
                      <Input
                        id="secret-value"
                        data-testid="input-secret-value"
                        type="password"
                        placeholder="sk-..."
                        {...secretForm.register("value")}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={secretForm.handleSubmit((data) => addSecretMutation.mutate(data))}
                      disabled={addSecretMutation.isPending}
                    >
                      Add Secret
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {(secrets || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No secrets added</p>
            ) : (
              <div className="space-y-3">
                {(secrets || []).map((secret: any) => (
                  <div
                    key={secret.name}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium font-mono">{secret.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {revealedSecrets.has(secret.name) ? secret.value : "••••••••"}
                      </p>
                      <p className="text-sm text-muted-foreground">Added {secret.createdAt}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-reveal-secret-${secret.name}`}
                        onClick={() => toggleSecretReveal(secret.name)}
                      >
                        {revealedSecrets.has(secret.name) ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(secret.value)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-secret-${secret.name}`}
                        onClick={() => setDeleteDialogOpen({ type: "secret", id: secret.name })}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 10. Connected Services */}
      <motion.div variants={item}>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle>Connected Services</CardTitle>
                <CardDescription>OAuth integrations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {providers.map((provider) => {
                const isConnected = (integrations || []).some(
                  (i: any) => i.provider === provider.id && i.connected
                );
                const Icon = provider.icon;

                return (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <div>
                        <p className="font-medium">{provider.name}</p>
                        {isConnected && (
                          <Badge variant="secondary" className="mt-1">
                            Connected
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-disconnect-${provider.id}`}
                        onClick={() => disconnectServiceMutation.mutate(provider.id)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-connect-${provider.id}`}
                        onClick={() => connectServiceMutation.mutate(provider.id)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 11. Domains */}
      <motion.div variants={item}>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle>Domains</CardTitle>
                  <CardDescription>Manage custom domains</CardDescription>
                </div>
              </div>
              <Dialog open={addDomainOpen} onOpenChange={setAddDomainOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-domain">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Domain
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Custom Domain</DialogTitle>
                    <DialogDescription>
                      Enter your domain name (e.g., example.com)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="domain">Domain</Label>
                      <Input
                        id="domain"
                        data-testid="input-domain"
                        placeholder="example.com"
                        {...domainForm.register("domain")}
                      />
                      {domainForm.formState.errors.domain && (
                        <p className="text-sm text-destructive mt-1">
                          {domainForm.formState.errors.domain.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={domainForm.handleSubmit((data) => addDomainMutation.mutate(data))}
                      disabled={addDomainMutation.isPending}
                    >
                      Add Domain
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {(domains || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No domains added</p>
            ) : (
              <div className="space-y-3">
                {(domains || []).map((domain: any) => (
                  <div
                    key={domain.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{domain.domain}</p>
                      <Badge variant={domain.verified ? "default" : "secondary"} className="mt-1">
                        {domain.verified ? "Verified" : "Pending"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-delete-domain-${domain.id}`}
                      onClick={() => setDeleteDialogOpen({ type: "domain", id: domain.id })}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 12. Themes */}
      <motion.div variants={item}>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle>Themes</CardTitle>
                  <CardDescription>Customize your editor appearance</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/themes" target="_blank">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Browse Marketplace
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockThemes.map((theme) => (
                <div
                  key={theme.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{theme.name}</p>
                      <div className="flex gap-2 mt-1">
                        {theme.official && (
                          <Badge variant="secondary" className="text-sm">
                            Official
                          </Badge>
                        )}
                        {theme.installed && (
                          <Badge variant="default" className="text-sm">
                            <Check className="w-3 h-3 mr-1" />
                            Installed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Preview
                    </Button>
                    {theme.installed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-install-theme-${theme.id}`}
                      >
                        Uninstall
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-install-theme-${theme.id}`}
                      >
                        Install
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen !== null}
        onOpenChange={() => setDeleteDialogOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
              {deleteDialogOpen?.type === "role" && " Removing this role may affect your permissions."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteDialogOpen) return;
                
                switch (deleteDialogOpen.type) {
                  case "ssh":
                    deleteSshKeyMutation.mutate(deleteDialogOpen.id);
                    break;
                  case "secret":
                    deleteSecretMutation.mutate(deleteDialogOpen.id);
                    break;
                  case "domain":
                    deleteDomainMutation.mutate(deleteDialogOpen.id);
                    break;
                  case "role":
                    updateRoleMutation.mutate({
                      role: deleteDialogOpen.id,
                      action: "remove",
                    });
                    break;
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
