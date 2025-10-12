import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { 
  Upload, 
  Check, 
  Mail, 
  Link as LinkIcon, 
  Trash2, 
  Download, 
  ExternalLink,
  Key,
  Shield,
  Plus
} from "lucide-react";
import { Link } from "wouter";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  bio: z.string().max(140, "Bio must be 140 characters or less").optional(),
  publicProfile: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface Project {
  id: string;
  name: string;
  thumbnail: string;
  createdAt: string;
  lastPublished: string | null;
  status: string;
}

export default function Profile() {
  const { toast } = useToast();
  const [userId] = useState("demo"); // In production, get from auth context
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fetch profile data
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["/api/users", userId, "profile"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/profile`);
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
  });

  const user = profileData?.user;
  const projects = profileData?.projects || [];
  const counts = profileData?.counts || { sshKeys: 0, secrets: 0 };

  // Form setup
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      bio: user?.bio || "",
      publicProfile: user?.publicProfile || false,
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        bio: user.bio || "",
        publicProfile: user.publicProfile || false,
      });
    }
  }, [user, form]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest(`/api/users/${userId}/profile`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
      toast({
        title: "Saved",
        description: "Your profile has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch(`/api/users/${userId}/avatar`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
      toast({
        title: "Success",
        description: "Avatar uploaded successfully",
      });
      setAvatarPreview(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload avatar",
        variant: "destructive",
      });
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
      toast({
        title: "Deleted",
        description: "Project deleted successfully",
      });
      setDeleteProjectId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  // Auto-save on form change
  const handleFieldChange = useCallback(
    (field: keyof ProfileFormData, value: any) => {
      form.setValue(field, value);
      const formData = form.getValues();
      updateProfileMutation.mutate(formData);
    },
    [form, updateProfileMutation]
  );

  // Avatar upload handlers
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      uploadAvatarMutation.mutate(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      uploadAvatarMutation.mutate(file);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold settings-text-light">Profile</h2>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold settings-text-light">Profile</h2>
        <p className="text-muted-foreground mt-1">
          Manage your public profile and personal information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avatar Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="rounded-2xl">
            <CardHeader className="p-6">
              <CardTitle>Avatar</CardTitle>
              <CardDescription>Upload a profile picture</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="flex items-center gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={avatarPreview || user?.avatar || undefined} />
                  <AvatarFallback className="text-2xl">
                    {user?.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={`flex-1 border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                    isDragging ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag & drop or click to upload
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadAvatarMutation.isPending}
                    data-testid="button-upload-avatar"
                  >
                    {uploadAvatarMutation.isPending ? "Uploading..." : "Choose File"}
                  </Button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    className="hidden"
                    data-testid="input-avatar"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Max 5MB • PNG, JPG, GIF, WEBP
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* User Details Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="rounded-2xl">
            <CardHeader className="p-6">
              <CardTitle>User Details</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={user?.username || ""} disabled />
                <p className="text-xs text-muted-foreground">
                  Username cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  data-testid="input-first-name"
                  value={form.watch("firstName") || ""}
                  onChange={(e) => handleFieldChange("firstName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  data-testid="input-last-name"
                  value={form.watch("lastName") || ""}
                  onChange={(e) => handleFieldChange("lastName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  data-testid="input-bio"
                  value={form.watch("bio") || ""}
                  onChange={(e) => handleFieldChange("bio", e.target.value)}
                  className="resize-none"
                  rows={3}
                  maxLength={140}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {(form.watch("bio") || "").length}/140
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="publicProfile">Public Profile</Label>
                  <p className="text-xs text-muted-foreground">
                    Make your profile visible to others
                  </p>
                </div>
                <Switch
                  id="publicProfile"
                  data-testid="switch-public-profile"
                  checked={form.watch("publicProfile")}
                  onCheckedChange={(checked) => handleFieldChange("publicProfile", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Contact & Identity Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="rounded-2xl">
            <CardHeader className="p-6">
              <CardTitle>Contact & Identity</CardTitle>
              <CardDescription>Email and verification status</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{user?.email || ""}</span>
                  </div>
                  {user?.emailVerified && (
                    <Badge variant="default" className="gap-1">
                      <Check className="w-3 h-3" />
                      Verified
                    </Badge>
                  )}
                </div>
                <Link href="/settings/account">
                  <Button variant="link" className="h-auto p-0 text-xs">
                    <LinkIcon className="w-3 h-3 mr-1" />
                    Change email in Account settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Roles & Flags Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="rounded-2xl">
            <CardHeader className="p-6">
              <CardTitle>Roles & Permissions</CardTitle>
              <CardDescription>Your account roles and access levels</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              {user?.roles && user.roles.length > 0 ? (
                <div className="space-y-3">
                  {user.roles.map((role: string) => (
                    <div key={role} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Badge variant="secondary">{role}</Badge>
                        <p className="text-xs text-muted-foreground">
                          {role === "owner" && "Full system access and control"}
                          {role === "admin" && "Administrative privileges"}
                          {role === "editor" && "Can create and edit content"}
                          {role === "viewer" && "Read-only access"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No roles assigned</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Links Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="rounded-2xl">
            <CardHeader className="p-6">
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>Access related settings and tools</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/settings/account#ssh-keys">
                  <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                    <Key className="w-4 h-4" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">SSH Keys</p>
                      <p className="text-xs text-muted-foreground">
                        {counts.sshKeys} SSH key{counts.sshKeys !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </Link>

                <Link href="/settings/account#secrets">
                  <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                    <Shield className="w-4 h-4" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">Account Secrets</p>
                      <p className="text-xs text-muted-foreground">
                        {counts.secrets} secret{counts.secrets !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Projects List Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="rounded-2xl">
            <CardHeader className="p-6">
              <CardTitle>Projects</CardTitle>
              <CardDescription>Manage your projects and workspaces</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {projects.length > 0 ? (
                <Table data-testid="table-projects">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Published</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.slice(0, 20).map((project: Project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <img
                            src={project.thumbnail}
                            alt={project.name}
                            className="w-12 h-12 rounded-md object-cover"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {project.lastPublished
                            ? new Date(project.lastPublished).toLocaleDateString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/workspace/${project.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-open-project-${project.id}`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-export-project-${project.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteProjectId(project.id)}
                              data-testid={`button-delete-project-${project.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No projects yet</p>
                  <Link href="/">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Project
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteProjectId) {
                  deleteProjectMutation.mutate(deleteProjectId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
