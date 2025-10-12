import { useState } from "react";
import { Button } from "@/components/ui/button";
import GetHelpModal from "@/components/GetHelpModal";
import { HelpCircle } from "lucide-react";

export default function TestGetHelpModal() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <HelpCircle className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-3xl font-bold">Get Help Modal Test</h1>
          <p className="text-muted-foreground">
            Click the button below to open the Get Help modal and test all its features.
          </p>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          size="lg"
          data-testid="button-open-get-help"
          className="gap-2"
        >
          <HelpCircle className="h-5 w-5" />
          Open Get Help Modal
        </Button>

        <div className="mt-8 p-4 border rounded-lg bg-muted/30 text-left text-sm space-y-2">
          <p className="font-semibold">Test Features:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>User greeting with name from /api/me</li>
            <li>Support type dropdown (Billing, Account, Technical)</li>
            <li>Quick action buttons with navigation</li>
            <li>Message textarea</li>
            <li>File upload (max 5 files, 5MB each)</li>
            <li>Form validation with error messages</li>
            <li>Submit with multipart/form-data</li>
            <li>Navigation after submission</li>
          </ul>
        </div>

        <GetHelpModal open={modalOpen} onOpenChange={setModalOpen} />
      </div>
    </div>
  );
}
