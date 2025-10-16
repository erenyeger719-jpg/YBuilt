// client/src/components/PaymentButton.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentButtonProps {
  amount: number;
  currency: "INR" | "USD";
  userId?: string;
}

export default function PaymentButton({
  amount,
  currency,
  userId = "demo",
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [razorpayKey, setRazorpayKey] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let scriptEl: HTMLScriptElement | null = null;

    (async () => {
      try {
        // Tolerant to mock mode, explicit Accept header, hard fail on HTTP error
        const res = await fetch("/api/razorpay_key", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`razorpay_key HTTP ${res.status}`);
        const data = await res.json();

        // Align with server payload: { key: string|null } OR { mock: true, key: null }
        setRazorpayKey(data?.key ?? null);
        setIsMockMode(Boolean(data?.mock));

        if (data?.mock) {
          console.info("[payments] Razorpay in mock mode; skipping checkout init");
        } else if (data?.key) {
          // Load Razorpay script only when we actually need it
          scriptEl = document.createElement("script");
          scriptEl.src = "https://checkout.razorpay.com/v1/checkout.js";
          scriptEl.async = true;
          document.body.appendChild(scriptEl);
        }
      } catch (err) {
        console.error("Error fetching Razorpay key:", err);
        // Keep UI usable; button will be disabled below if not in mock mode
        setRazorpayKey(null);
        setIsMockMode(false);
      }
    })();

    return () => {
      if (scriptEl) {
        document.body.removeChild(scriptEl);
      }
    };
  }, []);

  const handlePayment = async () => {
    // Allow mock flow even without a real key
    if (!isMockMode && !razorpayKey) {
      toast({
        title: "Payment unavailable",
        description: "Please try again later",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Mock mode simulation
    if (isMockMode) {
      setTimeout(() => {
        toast({
          title: "Mock Payment Successful",
          description: `${currency === "INR" ? "₹" : "$"}${amount} payment processed in mock mode. Credits added to your account.`,
        });
        setIsLoading(false);
      }, 800);
      return;
    }

    // Live mode
    if (typeof window.Razorpay !== "function") {
      // Script not yet loaded or blocked by CSP
      toast({
        title: "Payment setup pending",
        description: "Secure checkout is still loading. Please try again in a moment.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const options = {
      key: razorpayKey!,
      amount: Math.round(amount * 100), // paise/cents
      currency,
      name: "ybuilt",
      description: "Creator Plan",
      image: "/logo.svg",
      handler: function () {
        toast({
          title: "Payment Successful",
          description: "Credits have been added to your account.",
        });
        setIsLoading(false);
      },
      prefill: {
        name: "Demo User",
        email: "demo@ybuilt.com",
      },
      notes: {
        userId,
      },
      theme: {
        color: "#000000",
      },
      modal: {
        ondismiss: function () {
          setIsLoading(false);
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={isLoading || (!isMockMode && !razorpayKey)}
      className="gap-2"
      data-testid="button-payment"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4" />
          Buy Creator Plan {currency === "INR" ? "₹" : "$"}
          {amount}
        </>
      )}
    </Button>
  );
}
