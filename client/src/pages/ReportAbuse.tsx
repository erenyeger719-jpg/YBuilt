import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  category: z.enum(["spam", "harassment", "inappropriate", "copyright", "other"]),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type FormData = z.infer<typeof formSchema>;

export default function ReportAbuse() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      category: "spam",
      description: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const formData = new FormData();
      formData.append("userId", "demo");
      formData.append("type", "technical");
      formData.append("subject", `Abuse Report: ${data.category}`);
      formData.append("message", `URL: ${data.url}\n\nCategory: ${data.category}\n\nDescription: ${data.description}`);

      const response = await fetch("/api/support/tickets", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to submit report");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Report Submitted",
        description: `Your abuse report #${data.ticketId} has been submitted for review`,
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Failed to submit abuse report. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background" data-testid="page-report-abuse">
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
          <h1 className="text-4xl font-bold mb-2">Report Abuse</h1>
          <p className="text-muted-foreground">
            Report content that violates our community guidelines
          </p>
        </div>

        {/* Report Form */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <CardTitle>Submit Abuse Report</CardTitle>
                <CardDescription className="mt-1">
                  Please provide details about the content you're reporting
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit((data) => submitMutation.mutate(data))} className="space-y-4">
              {/* URL Field */}
              <div className="space-y-2">
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/content"
                  data-testid="input-url"
                  aria-label="URL to report"
                  {...form.register("url")}
                />
                {form.formState.errors.url && (
                  <p className="text-sm text-destructive">{form.formState.errors.url.message}</p>
                )}
              </div>

              {/* Category Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={form.watch("category")}
                  onValueChange={(value) => form.setValue("category", value as any)}
                >
                  <SelectTrigger
                    id="category"
                    data-testid="select-category"
                    aria-label="Abuse category"
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spam">Spam</SelectItem>
                    <SelectItem value="harassment">Harassment</SelectItem>
                    <SelectItem value="inappropriate">Inappropriate Content</SelectItem>
                    <SelectItem value="copyright">Copyright Violation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>
                )}
              </div>

              {/* Description Textarea */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Please provide details about why you're reporting this content..."
                  rows={4}
                  data-testid="textarea-description"
                  aria-label="Report description"
                  {...form.register("description")}
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitMutation.isPending}
                data-testid="button-submit"
                aria-label="Submit report"
                className="w-full gap-2"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Report"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
