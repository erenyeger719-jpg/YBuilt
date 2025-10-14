import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogPortal,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertTriangle,
  FileText,
  Users,
  X,
  Loader2,
} from "lucide-react";

interface GetHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Form validation schema based on insertSupportTicketSchema
const formSchema = z.object({
  type: z.enum(["billing", "account", "technical"]),
  subject: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  attachments: z.array(z.instanceof(File)).max(5, "Maximum 5 files allowed"),
});

type FormData = z.infer<typeof formSchema>;

export default function GetHelpModal({ open, onOpenChange }: GetHelpModalProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  // Fetch current user data
  const { data: userData } = useQuery<{ user: { username: string; email: string } }>({
    queryKey: ["/api/me"],
    enabled: open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "technical",
      subject: "",
      message: "",
      attachments: [],
    },
  });

  // Save focus when modal opens, restore when it closes
  useEffect(() => {
    if (open) {
      // Save the currently focused element when modal opens
      // But if it's in a dropdown menu, save the logo button instead
      const activeEl = document.activeElement as HTMLElement;
      const logoButton = document.querySelector('[data-testid="button-logo-menu"]') as HTMLElement;
      
      // If focused element is in a dropdown or menu, use logo button as fallback
      if (activeEl?.closest('[role="menu"]') || activeEl?.closest('[role="menuitem"]')) {
        lastFocusedElement.current = logoButton;
      } else {
        lastFocusedElement.current = activeEl;
      }
    } else {
      // Reset form when modal closes
      form.reset();
      setSelectedFiles([]);
      
      // Restore focus to the saved element or logo button as fallback
      const elementToFocus = lastFocusedElement.current || 
                            document.querySelector('[data-testid="button-logo-menu"]') as HTMLElement;
      
      if (elementToFocus && typeof elementToFocus.focus === 'function') {
        // Small delay to ensure modal is fully closed
        setTimeout(() => {
          elementToFocus.focus();
        }, 150);
      }
    }
  }, [open, form]);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Create FormData for multipart upload
      const formData = new FormData();
      
      // Always include demo user ID as fallback
      const userId = userData?.user?.email?.split('@')[0] || "demo";
      formData.append("userId", userId);
      formData.append("type", data.type);
      formData.append("subject", data.subject || "");
      formData.append("message", data.message);

      // Append all files
      data.attachments.forEach((file) => {
        formData.append("attachments", file);
      });

      // Use fetch API directly for multipart/form-data
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit ticket");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Ticket Submitted",
        description: `Your support ticket #${data.ticketId} has been created`,
      });

      // Navigate based on support type
      const typeRoutes = {
        billing: "/support/billing",
        account: "/support/account",
        technical: "/support/technical",
      };
      
      const selectedType = form.getValues("type");
      onOpenChange(false);
      navigate(typeRoutes[selectedType]);
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit support ticket",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file size (5MB max per file)
    const invalidFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast({
        title: "File Too Large",
        description: "Each file must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Validate total number of files
    if (selectedFiles.length + files.length > 5) {
      toast({
        title: "Too Many Files",
        description: "Maximum 5 files allowed",
        variant: "destructive",
      });
      return;
    }

    // Validate file types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
    ];
    
    const invalidTypes = files.filter(file => !allowedTypes.includes(file.type));
    if (invalidTypes.length > 0) {
      toast({
        title: "Invalid File Type",
        description: "Only images, PDFs, and text files are allowed",
        variant: "destructive",
      });
      return;
    }

    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);
    form.setValue("attachments", newFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    form.setValue("attachments", newFiles);
  };

  const handleQuickAction = (action: string) => {
    const actions = {
      "report-abuse": () => navigate("/report-abuse"),
      "docs": () => window.open("/docs", "_blank"),
      "community": () => window.open("/community", "_blank"),
    };
    
    actions[action as keyof typeof actions]?.();
  };

  const userDisplayName = userData?.user?.email?.split('@')[0] || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogContent 
          className="sm:max-w-[500px]" 
          data-testid="modal-get-help"
          style={{ zIndex: 2147483600 }}
        >
          <DialogHeader>
            <DialogTitle>Get help</DialogTitle>
            <DialogDescription>
              {userDisplayName 
                ? `Hi there, ${userDisplayName}! How can we help?`
                : "Hi there! How can we help?"
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit((data) => submitMutation.mutate(data))} className="space-y-4">
            {/* Support Type Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="support-type">Choose an option</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(value) => form.setValue("type", value as "billing" | "account" | "technical")}
              >
                <SelectTrigger 
                  id="support-type" 
                  data-testid="select-support-type"
                  aria-label="Support type"
                >
                  <SelectValue placeholder="Select support type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.type && (
                <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <Label>Quick actions</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction("report-abuse")}
                  data-testid="button-quick-report-abuse"
                  aria-label="Report abuse"
                  className="flex-1 gap-2"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Report abuse
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction("docs")}
                  data-testid="button-quick-docs"
                  aria-label="Read the docs"
                  className="flex-1 gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Read the docs
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction("community")}
                  data-testid="button-quick-community"
                  aria-label="Check the community"
                  className="flex-1 gap-2"
                >
                  <Users className="h-4 w-4" />
                  Check the community
                </Button>
              </div>
            </div>

            {/* Message Field */}
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your issue..."
                rows={3}
                data-testid="textarea-message"
                aria-label="Message"
                {...form.register("message")}
              />
              {form.formState.errors.message && (
                <p className="text-sm text-destructive">{form.formState.errors.message.message}</p>
              )}
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="attachments">Attachments (optional)</Label>
              <Input
                id="attachments"
                type="file"
                multiple
                accept="image/*,.pdf,.txt"
                onChange={handleFileChange}
                data-testid="input-attachments"
                aria-label="File attachments"
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Max 5 files, 5MB each. Accepts images, PDFs, and text files.
              </p>

              {/* File List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        aria-label={`Remove ${file.name}`}
                        className="h-8 w-8 flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {form.formState.errors.attachments && (
                <p className="text-sm text-destructive">{form.formState.errors.attachments.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              data-testid="button-submit-ticket"
              aria-label="Submit support ticket"
              className="w-full gap-2"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
