import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Bug,
  CreditCard,
  Bot,
  MessageSquare,
  Database,
  Lock,
  MessageCircle,
} from "lucide-react";

interface NewChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction: (prompt: string) => void;
}

const quickActions = [
  {
    id: "check-bugs",
    label: "Check my app for bugs",
    prompt: "Review my application code and check for bugs, security issues, and potential improvements.",
    icon: Bug,
  },
  {
    id: "add-payment",
    label: "Add payment processing",
    prompt: "Integrate payment processing into my application using Stripe or a similar payment gateway.",
    icon: CreditCard,
  },
  {
    id: "connect-ai",
    label: "Connect AI Assistant",
    prompt: "Add an AI assistant feature to my application that can chat with users and answer questions.",
    icon: Bot,
  },
  {
    id: "add-sms",
    label: "Add SMS sending",
    prompt: "Integrate SMS sending capability into my application using Twilio or similar service.",
    icon: MessageSquare,
  },
  {
    id: "add-database",
    label: "Add a database",
    prompt: "Set up a database for my application and create the necessary schemas and models.",
    icon: Database,
  },
  {
    id: "add-auth",
    label: "Add authenticated login",
    prompt: "Implement user authentication with login, signup, and session management.",
    icon: Lock,
  },
];

export default function NewChatModal({
  open,
  onOpenChange,
  onSelectAction,
}: NewChatModalProps) {
  const handleActionClick = (prompt: string) => {
    onSelectAction(prompt);
    onOpenChange(false);
  };

  const handleEmptyChat = () => {
    onSelectAction("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="modal-new-chat">
        <DialogHeader>
          <DialogTitle>New chat with Agent</DialogTitle>
          <DialogDescription>
            Agent can make changes, review and debug itself automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.id}
                className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-colors"
                onClick={() => handleActionClick(action.prompt)}
                data-testid={`quick-action-${action.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm mb-1">{action.label}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {action.prompt}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleEmptyChat}
            data-testid="button-start-empty-chat"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Start empty chat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
