import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, 
  Trash2, 
  Code2, 
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExecutionResult {
  stdout: string;
  stderr: string;
  result: any;
  executionTimeMs: number;
  status: "completed" | "timeout" | "error";
  error?: string;
}

interface TerminalPanelProps {
  className?: string;
}

const EXAMPLE_CODE = `// Try some JavaScript!
console.log("Hello, World!");

const fibonacci = (n) => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
};

console.log("Fibonacci(10):", fibonacci(10));

// Return a value
({ message: "Code executed successfully!", timestamp: new Date().toISOString() })`;

export default function TerminalPanel({ className }: TerminalPanelProps) {
  const [code, setCode] = useState(EXAMPLE_CODE);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [result]);

  const handleExecute = async () => {
    if (!code.trim() || isExecuting) return;

    setIsExecuting(true);
    
    try {
      const response = await apiRequest("POST", "/api/execute", { code });
      const executionResult: ExecutionResult = await response.json();
      
      setResult(executionResult);
      setExecutionHistory(prev => [...prev, executionResult]);

      if (executionResult.status === "error") {
        toast({
          title: "Execution Error",
          description: executionResult.error || "Unknown error occurred",
          variant: "destructive",
        });
      } else if (executionResult.status === "timeout") {
        toast({
          title: "Execution Timeout",
          description: `Code execution exceeded ${executionResult.executionTimeMs}ms limit`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorResult: ExecutionResult = {
        stdout: "",
        stderr: error.message || "Network error occurred",
        result: null,
        executionTimeMs: 0,
        status: "error",
        error: error.message,
      };
      
      setResult(errorResult);
      setExecutionHistory(prev => [...prev, errorResult]);
      
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute code",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClear = () => {
    setCode("");
    setResult(null);
    setExecutionHistory([]);
  };

  const handleLoadExample = () => {
    setCode(EXAMPLE_CODE);
    setResult(null);
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      handleExecute
    );
  };

  const getStatusIcon = () => {
    if (isExecuting) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    
    if (!result) {
      return <Code2 className="w-4 h-4" />;
    }

    switch (result.status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "timeout":
      case "error":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Code2 className="w-4 h-4" />;
    }
  };

  const getStatusBadge = () => {
    if (isExecuting) {
      return (
        <Badge variant="secondary" className="gap-1" data-testid="badge-status">
          <Loader2 className="w-3 h-3 animate-spin" />
          Running
        </Badge>
      );
    }

    if (!result) {
      return (
        <Badge variant="outline" data-testid="badge-status">
          Ready
        </Badge>
      );
    }

    switch (result.status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700" data-testid="badge-status">
            <CheckCircle className="w-3 h-3" />
            Success
          </Badge>
        );
      case "timeout":
        return (
          <Badge variant="destructive" className="gap-1" data-testid="badge-status">
            <Clock className="w-3 h-3" />
            Timeout
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1" data-testid="badge-status">
            <AlertCircle className="w-3 h-3" />
            Error
          </Badge>
        );
    }
  };

  return (
    <Card className={cn("flex flex-col h-full", className)} data-testid="terminal-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          {getStatusIcon()}
          Code Terminal
        </CardTitle>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
          
          {result && (
            <Badge variant="outline" className="gap-1" data-testid="badge-execution-time">
              <Clock className="w-3 h-3" />
              {result.executionTimeMs}ms
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 p-4 pt-0 min-h-0">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExecute}
            disabled={isExecuting || !code.trim()}
            className="gap-2"
            data-testid="button-execute"
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Execute (Ctrl+Enter)
          </Button>

          <Button
            variant="outline"
            onClick={handleClear}
            disabled={isExecuting}
            className="gap-2"
            data-testid="button-clear"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>

          <Button
            variant="ghost"
            onClick={handleLoadExample}
            disabled={isExecuting}
            data-testid="button-load-example"
          >
            Load Example
          </Button>
        </div>

        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex-1 border rounded-md overflow-hidden" data-testid="editor-container">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              value={code}
              onChange={(value) => setCode(value || "")}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
                readOnly: isExecuting,
              }}
            />
          </div>

          {result && (
            <div className="flex-1 flex flex-col border rounded-md overflow-hidden" data-testid="output-container">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
                <span className="text-sm font-medium">Output</span>
                {result.executionTimeMs > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="output-execution-time">
                    {result.executionTimeMs}ms
                  </Badge>
                )}
              </div>
              
              <ScrollArea ref={scrollRef} className="flex-1" data-testid="scroll-output">
                <div className="p-3 font-mono text-sm space-y-2">
                  {result.stdout && (
                    <div data-testid="output-stdout">
                      <div className="text-xs text-muted-foreground mb-1">STDOUT:</div>
                      <pre className="text-green-600 dark:text-green-400 whitespace-pre-wrap">
                        {result.stdout}
                      </pre>
                    </div>
                  )}

                  {result.stderr && (
                    <div data-testid="output-stderr">
                      <div className="text-xs text-muted-foreground mb-1">STDERR:</div>
                      <pre className="text-destructive whitespace-pre-wrap">
                        {result.stderr}
                      </pre>
                    </div>
                  )}

                  {result.error && (
                    <div data-testid="output-error">
                      <div className="text-xs text-muted-foreground mb-1">ERROR:</div>
                      <pre className="text-destructive whitespace-pre-wrap">
                        {result.error}
                      </pre>
                    </div>
                  )}

                  {result.result !== null && result.result !== undefined && (
                    <div data-testid="output-result">
                      <div className="text-xs text-muted-foreground mb-1">RESULT:</div>
                      <pre className="text-foreground whitespace-pre-wrap">
                        {typeof result.result === "object" 
                          ? JSON.stringify(result.result, null, 2)
                          : String(result.result)}
                      </pre>
                    </div>
                  )}

                  {!result.stdout && !result.stderr && !result.error && result.result === null && (
                    <div className="text-muted-foreground text-center py-4" data-testid="output-empty">
                      No output
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {!result && (
            <div className="flex-1 flex items-center justify-center border rounded-md bg-muted/20" data-testid="output-placeholder">
              <div className="text-center text-muted-foreground">
                <Code2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Write JavaScript code and press Execute</p>
                <p className="text-xs mt-1">Use Ctrl+Enter (Cmd+Enter on Mac) to run</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
