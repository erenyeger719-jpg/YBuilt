import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Rocket,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  CreditCard,
} from "lucide-react";

interface PublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

interface PlanInfo {
  currentPlan: string;
  publishCost: number;
  credits: number;
}

export default function PublishModal({ open, onOpenChange, jobId }: PublishModalProps) {
  const { toast } = useToast();
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  // NEW: Optional Netlify site name (used by deploy queue)
  const [siteName, setSiteName] = useState("");

  // Fetch plan info
  const { data: planInfo, isLoading: planLoading } = useQuery<PlanInfo>({
    queryKey: ["/api/plan"],
    queryFn: () => apiRequest<PlanInfo>("GET", "/api/plan"),
    enabled: open,
  });

  // Legacy publish mutation (kept for compatibility, not used by the new flow)
  const publishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/publish`, {});
    },
    onSuccess: (data: any) => {
      setPublishedUrl(data.publishedUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/plan"] });
      toast({
        title: "Published Successfully!",
        description: "Your app is now live",
      });
    },
    onError: (error: any) => {
      if (error.status === 402) {
        setShowPayment(true);
        toast({
          title: "Insufficient Credits",
          description: "Please add credits to publish",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Publish Failed",
          description: error.message || "Failed to publish app",
          variant: "destructive",
        });
      }
    },
  });

  // REPLACED: Simple submit handler that enqueues a Netlify deploy via the new server queue
  async function handlePublish() {
    try {
      const r = await fetch("/api/deploy/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "netlify",
          previewPath: `/previews/${jobId}/`,
          siteName: siteName || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "enqueue failed");

      // Close modal; logs stream into the pane via dual-broadcast (room = jobId)
      onOpenChange(false);

      // optional: focus the BUILD tab via a custom event
      window.dispatchEvent(new CustomEvent("workspace:show-build"));
    } catch (e: any) {
      toast({
        title: "Publish failed",
        description: e?.message || "Unable to start deploy",
        variant: "destructive",
      });
    }
  }

  // Payment mutation (kept for compatibility; not used in the new deploy-queue flow)
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!planInfo) throw new Error("Plan info not available");

      const amountNeeded = planInfo.publishCost - planInfo.credits;

      // Create Razorpay order
      const orderData = await apiRequest("POST", "/api/create_order", {
        amount: amountNeeded,
      });

      return new Promise((resolve, reject) => {
        // Load Razorpay SDK if not already loaded
        if (!(window as any).Razorpay) {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          script.onload = () => openRazorpayCheckout(orderData, amountNeeded, resolve, reject);
          script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
          document.body.appendChild(script);
        } else {
          openRazorpayCheckout(orderData, amountNeeded, resolve, reject);
        }
      });
    },
    onSuccess: () => {
      setShowPayment(false);
      queryClient.invalidateQueries({ queryKey: ["/api/plan"] });
      toast({
        title: "Payment Successful",
        description: "Credits added to your account",
      });
      // Now proceed with publish (legacy path)
      publishMutation.mutate();
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    },
  });

  const openRazorpayCheckout = async (
    orderData: any,
    amount: number,
    resolve: any,
    reject: any
  ) => {
    const options = {
      key: "rzp_test_mock_key_12345", // In production, fetch from backend
      amount: orderData.amount,
      currency: orderData.currency,
      name: "ybuilt",
      description: "Add credits to publish",
      order_id: orderData.id,
      handler: async function (response: any) {
        try {
          // Verify payment on backend
          await apiRequest("POST", "/api/verify_payment", {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            amount: amount,
          });
          resolve(response);
        } catch (error) {
          reject(error);
        }
      },
      prefill: {
        name: "Demo User",
        email: "demo@ybuilt.app",
      },
      theme: {
        color: "#3b82f6",
      },
      modal: {
        ondismiss: function () {
          reject(new Error("Payment cancelled by user"));
        },
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  const handlePayment = () => {
    paymentMutation.mutate();
  };

  const copyUrl = () => {
    if (publishedUrl) {
      navigator.clipboard.writeText(publishedUrl);
      toast({
        title: "Copied!",
        description: "URL copied to clipboard",
      });
    }
  };

  const hasInsufficientCredits = planInfo && planInfo.credits < planInfo.publishCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-publish">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Publish Application
          </DialogTitle>
          <DialogDescription>
            Deploy your app to production and make it accessible to the world
          </DialogDescription>
        </DialogHeader>

        {planLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : publishedUrl ? (
          // Success State (legacy)
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">Successfully Published!</p>
                <p className="text-xs text-muted-foreground">Your app is now live</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Published URL</label>
              <div className="flex gap-2">
                <Input
                  value={publishedUrl}
                  readOnly
                  className="font-mono text-xs"
                  data-testid="input-published-url"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyUrl}
                  data-testid="button-copy-url"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(publishedUrl, "_blank")}
                  data-testid="button-open-published"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cost</span>
              <Badge variant="outline">₹{planInfo?.publishCost} deducted</Badge>
            </div>

            <Button
              onClick={() => {
                setPublishedUrl(null);
                onOpenChange(false);
              }}
              className="w-full"
              data-testid="button-close-success"
            >
              Done
            </Button>
          </div>
        ) : showPayment || hasInsufficientCredits ? (
          // Payment Required State (legacy)
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">Insufficient Credits</p>
                <p className="text-xs text-muted-foreground">
                  You need ₹{planInfo?.publishCost} to publish
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Credits</span>
                <Badge variant="outline">₹{planInfo?.credits}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Publish Cost</span>
                <Badge variant="outline">₹{planInfo?.publishCost}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Amount Needed</span>
                <Badge>₹{(planInfo?.publishCost || 0) - (planInfo?.credits || 0)}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={handlePayment}
                disabled={paymentMutation.isPending}
                className="w-full gap-2"
                data-testid="button-add-credits"
              >
                <CreditCard className="h-4 w-4" />
                {paymentMutation.isPending ? "Processing..." : "Add Credits via Razorpay"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPayment(false);
                  onOpenChange(false);
                }}
                className="w-full"
                data-testid="button-cancel-payment"
              >
                Cancel
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Secure payment via Razorpay • UPI, Cards, Wallets accepted
            </p>
          </div>
        ) : (
          // Confirm Publish State (uses new deploy-queue flow)
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Plan</span>
                <Badge variant="outline" className="capitalize">
                  {planInfo?.currentPlan}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available Credits</span>
                <Badge variant="outline">₹{planInfo?.credits}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Publish Cost</span>
                <Badge>₹{planInfo?.publishCost}</Badge>
              </div>
            </div>

            {/* NEW: Optional site name for Netlify */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="site-name">
                Netlify site name (optional)
              </label>
              <Input
                id="site-name"
                placeholder="e.g., ybuilt-my-app"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                data-testid="input-site-name"
              />
              <p className="text-xs text-muted-foreground">
                We'll try this name. If it's taken, a random suffix will be used.
              </p>
            </div>

            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Publishing will make your app publicly accessible at a
                unique URL. We’ll kick off a deploy and show live logs in the build pane.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-publish"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                className="flex-1 gap-2"
                data-testid="button-confirm-publish"
              >
                <Rocket className="h-4 w-4" />
                Publish Now
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
