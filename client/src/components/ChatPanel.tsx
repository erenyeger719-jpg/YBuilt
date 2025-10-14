import { useState, useRef, useEffect } from 'react';
import { useSocket, ChatMode, ChatMessage } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, MessageCircle, Users, HeadphonesIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockAuth } from '@/lib/mockAuth';

interface ChatPanelProps {
  projectId?: string;
  className?: string;
}

export default function ChatPanel({ projectId, className }: ChatPanelProps) {
  const {
    isConnected,
    messages,
    typingUsers,
    currentMode,
    sendMessage,
    startTyping,
    stopTyping,
    changeMode,
  } = useSocket({ projectId });

  const [inputValue, setInputValue] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUser = mockAuth.getUserFromToken();

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    startTyping();
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || !isConnected) return;

    sendMessage(inputValue.trim());
    setInputValue('');
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping();
  };

  const getModeIcon = (mode: ChatMode) => {
    switch (mode) {
      case 'ai-assistant':
        return <Bot className="w-4 h-4" />;
      case 'collaboration':
        return <Users className="w-4 h-4" />;
      case 'support':
        return <HeadphonesIcon className="w-4 h-4" />;
    }
  };

  const getModeLabel = (mode: ChatMode) => {
    switch (mode) {
      case 'ai-assistant':
        return 'AI Assistant';
      case 'collaboration':
        return 'Collaboration';
      case 'support':
        return 'Support';
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isCurrentUser = message.role === 'user' && (!message.userId || message.userId === String(currentUser?.id));
    const isAI = message.role === 'assistant';
    const isSystem = message.role === 'system';

    return (
      <div
        key={message.id}
        className={cn(
          'flex gap-3 mb-4',
          isCurrentUser && 'flex-row-reverse'
        )}
        data-testid={`message-${message.id}`}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className={cn(
            isAI && 'bg-primary text-primary-foreground',
            isSystem && 'bg-secondary text-secondary-foreground',
            !isAI && !isSystem && 'bg-muted text-muted-foreground'
          )}>
            {isAI ? <Bot className="w-4 h-4" /> : 
             isSystem ? <MessageCircle className="w-4 h-4" /> :
             <User className="w-4 h-4" />}
          </AvatarFallback>
        </Avatar>

        <div className={cn(
          'flex flex-col gap-1 max-w-[75%]',
          isCurrentUser && 'items-end'
        )}>
          {message.username && currentMode === 'collaboration' && (
            <span className="text-xs text-muted-foreground px-2" data-testid={`username-${message.id}`}>
              {message.username}
            </span>
          )}
          
          <div
            className={cn(
              'rounded-md px-3 py-2 text-sm',
              isCurrentUser && 'bg-primary text-primary-foreground',
              isAI && 'bg-secondary text-secondary-foreground',
              isSystem && 'bg-muted text-muted-foreground border border-border',
              !isCurrentUser && !isAI && !isSystem && 'bg-muted text-foreground'
            )}
            data-testid={`message-content-${message.id}`}
          >
            {message.content}
          </div>
          
          <span className="text-xs text-muted-foreground px-2" data-testid={`timestamp-${message.id}`}>
            {new Date(message.createdAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card className={cn('flex flex-col h-full', className)} data-testid="chat-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold">Chat</CardTitle>
        
        <div className="flex gap-1">
          {(['ai-assistant', 'collaboration', 'support'] as ChatMode[]).map((mode) => (
            <Button
              key={mode}
              variant={currentMode === mode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => changeMode(mode)}
              className={cn(
                'gap-1.5',
                currentMode === mode && 'toggle-elevate toggle-elevated'
              )}
              data-testid={`button-mode-${mode}`}
            >
              {getModeIcon(mode)}
              <span className="hidden sm:inline">{getModeLabel(mode)}</span>
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 p-4 pt-0 min-h-0">
        <div className="flex items-center gap-2">
          <Badge 
            variant={isConnected ? 'default' : 'secondary'} 
            className="text-xs"
            data-testid="badge-connection-status"
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          
          {!currentUser && (
            <Badge variant="outline" className="text-xs" data-testid="badge-anonymous">
              Anonymous Mode
            </Badge>
          )}
        </div>

        <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4" data-testid="scroll-messages">
          <div className="space-y-2">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">
                  {currentMode === 'ai-assistant' && 'Start chatting with the AI assistant'}
                  {currentMode === 'collaboration' && 'Collaborate with your team'}
                  {currentMode === 'support' && 'Get help from our support team'}
                </p>
              </div>
            ) : (
              messages.map(renderMessage)
            )}
            
            {typingUsers.length > 0 && (
              <div className="flex gap-2 items-center text-sm text-muted-foreground" data-testid="typing-indicator">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs">
                  {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={
              currentMode === 'ai-assistant' 
                ? 'Ask the AI assistant...' 
                : currentMode === 'collaboration'
                ? 'Send a message to your team...'
                : 'Describe your issue...'
            }
            disabled={!isConnected}
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || !isConnected}
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
