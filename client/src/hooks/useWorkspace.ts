import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface PromptToFileRequest {
  promptText: string;
  filenameHint?: string;
}

export interface PromptToFileResponse {
  file: {
    path: string;
    name: string;
    url: string;
    size: number;
    type: string;
  };
  fileCreated: boolean;
}

export interface CreateFolderRequest {
  path: string;
}

export interface CreateFolderResponse {
  ok: boolean;
  path: string;
}

export interface DownloadFileRequest {
  jobId: string;
  path: string;
  suggestedName?: string;
}

export interface UploadFileResponse {
  success: boolean;
  file: {
    id: string;
    filename: string;
    url: string;
    size: number;
    type: string;
  };
}

export function useWorkspace(jobId: string) {
  const queryClient = useQueryClient();

  // Convert prompt to file
  const promptToFileMutation = useMutation({
    mutationFn: async (data: PromptToFileRequest) => {
      const response = await apiRequest(
        "POST",
        `/api/workspace/${jobId}/prompt-to-file`,
        data
      );
      return response.json() as Promise<PromptToFileResponse>;
    },
    onSuccess: () => {
      // Invalidate workspace files query to refresh the file list
      queryClient.invalidateQueries({ queryKey: ["/api/workspace", jobId, "files"] });
    },
  });

  // Create folder
  const createFolderMutation = useMutation({
    mutationFn: async (data: CreateFolderRequest) => {
      const response = await apiRequest(
        "POST",
        `/api/workspace/${jobId}/folder`,
        data
      );
      return response.json() as Promise<CreateFolderResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace", jobId, "files"] });
    },
  });

  // Save/create file
  const saveFileMutation = useMutation({
    mutationFn: async (data: { path: string; content: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/workspace/${jobId}/file`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace", jobId, "files"] });
    },
  });

  // Upload file to workspace
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`/api/workspace/${jobId}/upload`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(errorData.error || "Upload failed");
      }
      
      return response.json() as Promise<UploadFileResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace", jobId, "files"] });
    },
  });

  // Download file to user's device
  const downloadFile = async ({ path, suggestedName }: Omit<DownloadFileRequest, 'jobId'>) => {
    try {
      const response = await fetch(`/api/workspace/${jobId}/file?path=${encodeURIComponent(path)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }

      const data = await response.json();
      const content = data.content || '';
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName || path.split('/').pop() || 'file.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  };

  return {
    promptToFile: promptToFileMutation.mutateAsync,
    createFolder: createFolderMutation.mutateAsync,
    saveFile: saveFileMutation.mutateAsync,
    uploadFile: uploadFileMutation.mutateAsync,
    downloadFile,
    isPromptToFileLoading: promptToFileMutation.isPending,
    isCreateFolderLoading: createFolderMutation.isPending,
    isSaveFileLoading: saveFileMutation.isPending,
    isUploadLoading: uploadFileMutation.isPending,
  };
}
