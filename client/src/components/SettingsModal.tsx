// client/src/components/SettingsModal.tsx
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Info,
  Users,
  CreditCard,
  Cloud,
  Shield,
  UserCircle,
  Wrench,
  Beaker,
  Database,
  Github,
  Pencil,
  Download,
  Search,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState("workspace");
  const [workspaceName, setWorkspaceName] = useState("The's ybuilt");
  const [description, setDescription] = useState("");
  const [githubBranch, setGithubBranch] = useState(false);
  const [chatSuggestions, setChatSuggestions] = useState(true);
  const [inviteEmails, setInviteEmails] = useState("");
  const [defaultWebsiteAccess, setDefaultWebsiteAccess] =
    useState<"anyone" | "workspace">("anyone");
  const [cloudToolPolicy, setCloudToolPolicy] =
    useState<"ask" | "always" | "never">("ask");

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ---------- helpers / “functionalities” ----------

  const DOCS_BASE = "https://ybuilt.dev/docs";

  const docsUrls: Record<string, string> = {
    workspace: `${DOCS_BASE}/workspace`,
    people: `${DOCS_BASE}/people`,
    plans: `${DOCS_BASE}/plans`,
    "cloud-ai": `${DOCS_BASE}/cloud-and-ai`,
    privacy: `${DOCS_BASE}/privacy-and-security`,
    account: `${DOCS_BASE}/account`,
    tools: `${DOCS_BASE}/tools`,
    labs: `${DOCS_BASE}/labs`,
    supabase: `${DOCS_BASE}/integrations/supabase`,
    github: `${DOCS_BASE}/integrations/github`,
  };

  const openDocs = (section: keyof typeof docsUrls) => {
    const url = docsUrls[section] ?? DOCS_BASE;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleInvite = () => {
    const emails = inviteEmails
      .split(/[,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (!emails.length) {
      alert("Add at least one email to invite ✨");
      return;
    }

    // TODO: wire to real invite API
    alert(
      `Invites queued for:\n\n${emails.join(
        ", "
      )}\n\nWe’ll hook this up to the real invite flow soon.`
    );
    setInviteEmails("");
  };

  const handleExportMembers = () => {
    const rows = [
      ["Member", "Email", "Role", "Status", "Joined"],
      [
        "reemonagita@gmail.com (you)",
        "reemonagita@gmail.com",
        "Owner",
        "Active",
        "Nov 13, 2025",
      ],
    ];

    const csv = rows
      .map((r) =>
        r.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ybuilt-members.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConnectSupabase = () => {
    window.open(
      "https://supabase.com/dashboard/projects",
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleConnectGitHub = () => {
    window.open("https://github.com/login", "_blank", "noopener,noreferrer");
  };

  const handlePricingClick = () => {
    alert(
      "Pricing is still being finalized. For now, enjoy the free early-access Cloud + AI balance ✨"
    );
  };

  // ---------- sections ----------

  const renderContent = () => {
    switch (activeSection) {
      case "workspace":
        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                  Workspace settings
                </h1>
                <p className="text-sm text-neutral-400">
                  Workspaces allow you to collaborate on projects in real time.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full border border-white/5 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-neutral-50"
                onClick={() => openDocs("workspace")}
              >
                <Info className="h-4 w-4" />
                <span>Docs</span>
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="mb-1 text-base font-semibold text-neutral-100">
                    Workspace Avatar
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Set an avatar for your workspace.
                  </p>
                </div>
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-rose-500 text-2xl font-bold text-white shadow-lg">
                    T
                  </div>
                  <button
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-neutral-900/90 text-neutral-200 shadow-sm transition-colors hover:bg-neutral-700"
                    onClick={() =>
                      alert(
                        "Custom avatars are on the roadmap. For now we’ll keep this gradient beauty ✨"
                      )
                    }
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-1 text-base font-semibold text-neutral-100">
                    Workspace Name
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Your full workspace name, as visible to others.
                  </p>
                </div>
                <div>
                  <Input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="border-white/10 bg-[#1C1C1C] text-neutral-100"
                    maxLength={100}
                  />
                  <p className="mt-1 text-right text-xs text-neutral-500">
                    {workspaceName.length} / 100 characters
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-1 text-base font-semibold text-neutral-100">
                    Workspace Description
                  </h3>
                  <p className="text-sm text-neutral-400">
                    A short description about your workspace or team.
                  </p>
                </div>
                <div>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description"
                    className="min-h-[100px] resize-none border-white/10 bg-[#1C1C1C] text-neutral-100"
                    maxLength={500}
                  />
                  <p className="mt-1 text-right text-xs text-neutral-500">
                    {description.length} / 500 characters
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="mb-1 text-base font-semibold text-neutral-100">
                    Leave Workspace
                  </h3>
                  <p className="text-sm text-neutral-400">
                    You cannot leave as you are the only owner. Please transfer
                    ownership first.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  disabled
                  className="cursor-not-allowed bg-red-600/70 text-red-50"
                >
                  Leave Workspace
                </Button>
              </div>
            </div>
          </div>
        );

      case "people":
        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                  People
                </h1>
                <p className="text-sm text-neutral-400">
                  Inviting people to <strong>The&apos;s ybuilt</strong> gives
                  access to workspace shared projects and credits. You have 1
                  builder in this workspace.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full border border-white/5 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-neutral-50"
                onClick={() => openDocs("people")}
              >
                <Info className="h-4 w-4" />
                <span>Docs</span>
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="mb-4 text-base font-semibold text-neutral-100">
                Invite new members
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="Add emails (comma or space separated)"
                  className="flex-1 border-white/10 bg-[#1C1C1C]"
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                />
                <Button
                  className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-md hover:from-blue-400 hover:via-indigo-400 hover:to-violet-400"
                  onClick={handleInvite}
                >
                  Invite
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-100">
                  Members
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 rounded-full border border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10"
                  onClick={handleExportMembers}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>

              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  placeholder="Search members by name or email..."
                  className="border-white/10 bg-[#1C1C1C] pl-9"
                />
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-4 border-b border-white/10 pb-2 text-xs font-medium text-neutral-500">
                  <div>Member</div>
                  <div>Email</div>
                  <div>Role</div>
                  <div>Status</div>
                  <div>Joined</div>
                </div>
                <div className="grid grid-cols-5 items-center gap-4 border-b border-white/10 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                    <span className="text-sm text-neutral-200">
                      reemonagita@gmail.com (you)
                    </span>
                  </div>
                  <div className="text-sm text-neutral-400">
                    reemonagita@gmail.com
                  </div>
                  <div>
                    <Badge variant="secondary">Owner</Badge>
                  </div>
                  <div>
                    <Badge className="bg-emerald-500/20 text-emerald-400">
                      Active
                    </Badge>
                  </div>
                  <div className="text-sm text-neutral-400">Nov 13, 2025</div>
                </div>
              </div>
            </div>
          </div>
        );

      case "plans":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                Plans & credits
              </h1>
              <p className="text-sm text-neutral-400">
                Manage your subscription and credit usage.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
              <h3 className="mb-2 text-lg font-semibold text-neutral-100">
                Pricing Not Finalized
              </h3>
              <p className="text-sm text-neutral-400">
                We&apos;re currently finalizing our pricing structure. Check
                back soon for updates on plans and credits.
              </p>
            </div>
          </div>
        );

      case "cloud-ai":
        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                  Cloud & AI balance
                </h1>
                <p className="text-sm text-neutral-400">
                  All plans include free monthly usage. For increased Cloud and
                  AI usage, you can top up on paid plans.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full border border-white/5 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-neutral-50"
                onClick={() => openDocs("cloud-ai")}
              >
                <Info className="h-4 w-4" />
                <span>Docs</span>
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-rose-500">
                    <svg
                      className="h-6 w-6 text-white"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="mb-1 text-lg font-semibold text-neutral-100">
                      Cloud + AI
                    </h3>
                    <p className="text-sm text-neutral-400">
                      Monthly included usage resets 01 Dec 05:30 GMT+5:30
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-neutral-400">
                  Upgrade to top up your balance ($0).
                </p>
                <Button
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-neutral-900 shadow-md hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400"
                  onClick={handlePricingClick}
                >
                  Upgrade plan
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                    <Info className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="text-base font-semibold text-neutral-100">
                    Cloud
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-neutral-100">$0 / $25</p>
                  <p className="text-sm text-neutral-400">Free balance used</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                    <svg
                      className="h-5 w-5 text-purple-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-neutral-100">
                    AI
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-neutral-100">$0 / $1</p>
                  <p className="text-sm text-neutral-400">Free balance used</p>
                </div>
              </div>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                Privacy & security
              </h1>
              <p className="text-sm text-neutral-400">
                Manage privacy and security settings for your workspace.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="mb-2 text-base font-semibold text-neutral-100">
                    Default Project Visibility
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Choose whether new projects start as public, private
                    (workspace-only), or drafts.
                  </p>
                </div>
                <Select defaultValue="workspace">
                  <SelectTrigger className="w-[180px] border-white/10 bg-[#1C1C1C]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#1C1C1C]">
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="workspace">Workspace</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="mb-2 text-base font-semibold text-neutral-100">
                    Default Website Access{" "}
                    <Badge
                      variant="secondary"
                      className="ml-2 bg-white/10 text-xs text-neutral-200"
                    >
                      Business
                    </Badge>
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Choose if new published websites are public or only
                    accessible to logged in workspace members.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className={`min-w-[170px] border-white/15 text-sm ${
                    defaultWebsiteAccess === "anyone"
                      ? "bg-white/5 text-neutral-100 hover:bg-white/10"
                      : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  }`}
                  onClick={() =>
                    setDefaultWebsiteAccess((prev) =>
                      prev === "anyone" ? "workspace" : "anyone"
                    )
                  }
                >
                  {defaultWebsiteAccess === "anyone"
                    ? "Anyone with link"
                    : "Workspace members only"}
                </Button>
              </div>
            </div>
          </div>
        );

      case "account":
        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                  Account settings
                </h1>
                <p className="text-sm text-neutral-400">
                  Personalize how others see and interact with you on ybuilt.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full border border-white/5 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-neutral-50"
                onClick={() => openDocs("account")}
              >
                <Info className="h-4 w-4" />
                <span>Docs</span>
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="mb-1 text-base font-semibold text-neutral-100">
                    Your Avatar
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Your avatar is either fetched from your linked identity
                    provider or automatically generated based on your account.
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-2xl font-bold text-white">
                  R
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-1 text-base font-semibold text-neutral-100">
                    Username
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Your public identifier and profile URL.
                  </p>
                </div>
                <div>
                  <Input
                    value="AP2MMEDdyQbICQULOAaYKvNGwI42"
                    readOnly
                    className="border-white/10 bg-[#1C1C1C] font-mono text-sm text-neutral-100"
                  />
                  <a
                    href="https://ybuilt.dev/@AP2MMEDdyQbICQULOAaYKvNGwI42"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                  >
                    ybuilt.dev/@AP2MMEDdyQbICQULOAaYKvNGwI42
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-1 text-base font-semibold text-neutral-100">
                    Email
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Your email address associated with your account.
                  </p>
                </div>
                <Input
                  value="reemonagita@gmail.com"
                  readOnly
                  className="border-white/10 bg-[#1C1C1C] text-neutral-100"
                />
              </div>
            </div>
          </div>
        );

      case "tools":
        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                  Tools
                </h1>
                <p className="text-sm text-neutral-400">
                  Manage tools that ybuilt can use. Applies to future actions by
                  these tools.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full border border-white/5 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-neutral-50"
                onClick={() => openDocs("tools")}
              >
                <Info className="h-4 w-4" />
                <span>Docs</span>
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                      <svg
                        className="h-5 w-5 text-blue-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                      </svg>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-base font-semibold text-neutral-100">
                          Cloud
                        </h3>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          Enabled
                        </span>
                      </div>
                      <p className="text-sm text-neutral-400">
                        Create and connect a Cloud project to add backend
                        features (database, auth, storage). Required to use
                        Cloud tools.
                      </p>
                    </div>
                  </div>
                  <Select
                    value={cloudToolPolicy}
                    onValueChange={(v: "ask" | "always" | "never") =>
                      setCloudToolPolicy(v)
                    }
                  >
                    <SelectTrigger className="w-[160px] border-white/10 bg-[#1C1C1C]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#1C1C1C]">
                      <SelectItem value="ask">Ask each time</SelectItem>
                      <SelectItem value="always">Always allow</SelectItem>
                      <SelectItem value="never">Never allow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      case "labs":
        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                  Labs
                </h1>
                <p className="text-sm text-neutral-400">
                  These are experimental features, that might be modified or
                  removed.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full border border-white/5 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-neutral-50"
                onClick={() => openDocs("labs")}
              >
                <Info className="h-4 w-4" />
                <span>Docs</span>
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 pr-4">
                  <h3 className="mb-2 text-base font-semibold text-neutral-100">
                    GitHub branch switching
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Select the branch to make edits to in your GitHub
                    repository.
                  </p>
                </div>
                <Switch
                  checked={githubBranch}
                  onCheckedChange={setGithubBranch}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 pr-4">
                  <h3 className="mb-2 text-base font-semibold text-neutral-100">
                    Chat Suggestions
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Show helpful suggestions in the chat interface to enhance
                    your experience.
                  </p>
                </div>
                <Switch
                  checked={chatSuggestions}
                  onCheckedChange={setChatSuggestions}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>
          </div>
        );

      case "supabase":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                Supabase
              </h1>
              <p className="text-sm text-neutral-400">
                Integrate user authentication, data storage, and backend
                capabilities.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-base font-semibold text-neutral-100">
                      Organizations
                    </h3>
                    <Badge className="bg-orange-500/20 text-orange-400">
                      Admin
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-400">
                    Connected Supabase organizations will be accessible to all
                    members in this workspace.
                  </p>
                </div>
                <Button
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-md hover:bg-emerald-500"
                  onClick={handleConnectSupabase}
                >
                  <Database className="h-4 w-4" />
                  Connect Supabase
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );

      case "github":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-neutral-100">
                GitHub
              </h1>
              <p className="text-sm text-neutral-400">
                Sync your project 2-way with GitHub to collaborate at source.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-base font-semibold text-neutral-100">
                      Connected Account
                    </h3>
                    <Badge className="bg-orange-500/20 text-orange-400">
                      Admin
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-400">
                    Add your GitHub account to manage connected organizations.
                  </p>
                </div>
                <Button
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-100 shadow-md hover:bg-white/10"
                  onClick={handleConnectGitHub}
                >
                  <Github className="h-4 w-4" />
                  Connect GitHub
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ---------- PORTAL + HARD CENTERING ----------

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex h-[85vh] w-[95vw] max-w-[1400px] overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
        {/* Sidebar */}
        <div className="w-64 border-r border-white/10 bg-[#161616] p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-rose-500 p-3 shadow-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 font-bold text-white backdrop-blur-sm">
                T
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white">
                  The&apos;s ybuilt
                </h3>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Workspace
            </h4>
            <div className="space-y-1">
              {[
                { id: "workspace", icon: "⚙️", label: "The's ybuilt" },
                { id: "people", icon: <Users className="h-4 w-4" />, label: "People" },
                {
                  id: "plans",
                  icon: <CreditCard className="h-4 w-4" />,
                  label: "Plans & credits",
                },
                {
                  id: "cloud-ai",
                  icon: <Cloud className="h-4 w-4" />,
                  label: "Cloud & AI balance",
                },
                {
                  id: "privacy",
                  icon: <Shield className="h-4 w-4" />,
                  label: "Privacy & security",
                },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                    activeSection === item.id
                      ? "bg-white/10 text-neutral-100 shadow-sm"
                      : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h4 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Account
            </h4>
            <div className="space-y-1">
              {[
                {
                  id: "account",
                  icon: <UserCircle className="h-4 w-4" />,
                  label: "Your Account",
                },
                { id: "tools", icon: <Wrench className="h-4 w-4" />, label: "Tools" },
                { id: "labs", icon: <Beaker className="h-4 w-4" />, label: "Labs" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                    activeSection === item.id
                      ? "bg-white/10 text-neutral-100 shadow-sm"
                      : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Integrations
            </h4>
            <div className="space-y-1">
              {[
                {
                  id: "supabase",
                  icon: <Database className="h-4 w-4 text-emerald-500" />,
                  label: "Supabase",
                },
                {
                  id: "github",
                  icon: <Github className="h-4 w-4" />,
                  label: "GitHub",
                },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                    activeSection === item.id
                      ? "bg-white/10 text-neutral-100 shadow-sm"
                      : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute right-6 top-6 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full text-neutral-400 hover:bg-white/10 hover:text-neutral-100"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="h-full overflow-y-auto px-12 py-10">
            <div className="mx-auto max-w-4xl pb-10">{renderContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
