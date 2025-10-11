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

export default function PaymentButton({ amount, currency, userId = "demo" }: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [razorpayKey, setRazorpayKey] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    // Fetch Razorpay key
    fetch("/api/razorpay_key")
      .then(res => res.json())
      .then(data => {
        setRazorpayKey(data.key);
        setIsMockMode(data.isMockMode);
      })
      .catch(err => console.error("Error fetching Razorpay key:", err));

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    if (!razorpayKey) {
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
          description: `₹${amount} payment processed in mock mode. Credits added to your account.`,
        });
        setIsLoading(false);
      }, 1500);
      return;
    }

    const options = {
      key: razorpayKey,
      amount: amount * 100, // Convert to paise
      currency: currency,
      name: "ybuilt",
      description: "Creator Plan",
      image: "/logo.svg",
      handler: function (response: any) {
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
        userId: userId,
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
      disabled={isLoading || !razorpayKey}
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
          Buy Creator Plan {currency === "INR" ? "₹" : "$"}{amount}
        </>
      )}
    </Button>
  );
}
