import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

type Currency = "INR" | "USD";

interface CurrencyToggleProps {
  onCurrencyChange?: (currency: Currency) => void;
}

export default function CurrencyToggle({ onCurrencyChange }: CurrencyToggleProps) {
  const [currency, setCurrency] = useState<Currency>("INR");

  useEffect(() => {
    const saved = localStorage.getItem("currency") as Currency;
    if (saved === "INR" || saved === "USD") {
      setCurrency(saved);
      onCurrencyChange?.(saved);
    }
  }, [onCurrencyChange]);

  const toggleCurrency = () => {
    const newCurrency: Currency = currency === "INR" ? "USD" : "INR";
    setCurrency(newCurrency);
    localStorage.setItem("currency", newCurrency);
    onCurrencyChange?.(newCurrency);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleCurrency}
      data-testid="button-currency-toggle"
      className="font-mono"
    >
      {currency}
    </Button>
  );
}
