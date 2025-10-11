import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Trash2, 
  Download, 
  Pause, 
  Play,
  ChevronDown,
  ChevronRight,
  Filter
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
  metadata?: any;
}

interface ConsolePanelProps {
  jobId: string;
}

export default function ConsolePanel({ jobId }: ConsolePanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<string>("server");
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set());
  const [isTailing, setIsTailing] = useState(true);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Connect to SSE endpoint for real-time logs
  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`/api/jobs/${jobId}/logs/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Skip connection message
        if (data.type === "connected") {
          return;
        }
        
        // Add log entry
        const logEntry: LogEntry = {
          timestamp: data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
          level: data.level || "info",
          source: data.source || "worker",
          message: data.message || "",
          metadata: data.metadata
        };
        
        setLogs(prev => [...prev, logEntry]);
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      eventSource.close();
      
      // Attempt to reconnect after 2 seconds
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          const newEventSource = new EventSource(`/api/jobs/${jobId}/logs/stream`);
          Object.assign(eventSource, newEventSource);
        }
      }, 2000);
    };
    
    return () => {
      eventSource.close();
    };
  }, [jobId]);

  // Filter logs based on search, level, and source
  useEffect(() => {
    let filtered = [...logs];

    // Filter by active tab
    if (activeTab === "server") {
      filtered = filtered.filter(log => log.source === "express");
    } else if (activeTab === "build") {
      filtered = filtered.filter(log => log.source === "worker");
    } else if (activeTab === "browser") {
      filtered = filtered.filter(log => log.source === "browser");
    } else if (activeTab === "agent") {
      filtered = filtered.filter(log => log.source === "agent");
    }

    // Filter by level
    if (levelFilter !== "all") {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Filter by source
    if (sourceFilters.size > 0) {
      filtered = filtered.filter(log => sourceFilters.has(log.source));
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.source.toLowerCase().includes(query) ||
        JSON.stringify(log.metadata).toLowerCase().includes(query)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, activeTab, searchQuery, levelFilter, sourceFilters]);

  // Auto-scroll when tailing
  useEffect(() => {
    if (isTailing && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, isTailing]);

  const handleClearLogs = () => {
    setLogs([]);
    setExpandedLines(new Set());
  };

  const handleDownloadLogs = () => {
    const logText = logs.map(log => 
      `${log.timestamp} [${log.source}] ${log.level.toUpperCase()}: ${log.message}${log.metadata ? ' :: ' + JSON.stringify(log.metadata) : ''}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${jobId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleExpandLine = (index: number) => {
    const newExpanded = new Set(expandedLines);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLines(newExpanded);
  };

  const toggleSourceFilter = (source: string) => {
    const newFilters = new Set(sourceFilters);
    if (newFilters.has(source)) {
      newFilters.delete(source);
    } else {
      newFilters.add(source);
    }
    setSourceFilters(newFilters);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-destructive";
      case "warn":
        return "text-yellow-500 dark:text-yellow-400";
      case "info":
      default:
        return "text-muted-foreground";
    }
  };

  const availableSources = Array.from(new Set(logs.map(log => log.source)));

  return (
    <div className="flex flex-col h-full">
      {/* Top controls */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
            data-testid="input-search-logs"
          />
        </div>

        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-28 h-8" data-testid="select-level-filter">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1" data-testid="button-filter-source">
              <Filter className="h-3 w-3" />
              Source
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {availableSources.map(source => (
              <DropdownMenuCheckboxItem
                key={source}
                checked={sourceFilters.size === 0 || sourceFilters.has(source)}
                onCheckedChange={() => toggleSourceFilter(source)}
              >
                {source}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearLogs}
          data-testid="button-clear-logs"
          className="h-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownloadLogs}
          data-testid="button-download-logs"
          className="h-8"
        >
          <Download className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsTailing(!isTailing)}
          data-testid="button-toggle-tail"
          className="h-8 gap-1"
        >
          {isTailing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span className="text-xs">{isTailing ? "Pause" : "Resume"}</span>
        </Button>

        <Badge variant="secondary" className="h-8">
          {filteredLogs.length} lines
        </Badge>
      </div>

      {/* Log tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="server" className="rounded-none" data-testid="tab-server-logs">
            Server Logs
          </TabsTrigger>
          <TabsTrigger value="build" className="rounded-none" data-testid="tab-build-logs">
            Build Logs
          </TabsTrigger>
          <TabsTrigger value="browser" className="rounded-none" data-testid="tab-browser-console">
            Browser Console
          </TabsTrigger>
          <TabsTrigger value="agent" className="rounded-none" data-testid="tab-agent-logs">
            Agent Logs
          </TabsTrigger>
        </TabsList>

        {["server", "build", "browser", "agent"].map(tab => (
          <TabsContent 
            key={tab} 
            value={tab} 
            className="flex-1 m-0 overflow-hidden"
          >
            <ScrollArea className="h-full" ref={scrollRef}>
              <div className="font-mono text-xs p-2 space-y-0.5">
                {filteredLogs.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    No logs to display
                  </div>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div 
                      key={index} 
                      className="hover-elevate rounded px-2 py-1"
                      data-testid={`log-entry-${index}`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => toggleExpandLine(index)}
                          className="mt-0.5"
                        >
                          {expandedLines.has(index) ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {log.timestamp}
                        </span>
                        <Badge variant="outline" className="h-4 text-[10px] px-1">
                          {log.source}
                        </Badge>
                        <span className={getLevelColor(log.level)}>
                          {log.message}
                        </span>
                        {log.metadata && !expandedLines.has(index) && (
                          <span className="text-muted-foreground/50 truncate">
                            :: {JSON.stringify(log.metadata)}
                          </span>
                        )}
                      </div>
                      {expandedLines.has(index) && log.metadata && (
                        <pre className="mt-1 ml-6 text-muted-foreground/70 bg-muted/30 rounded p-2 overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
