import { PRDContract, ArchitectureContract } from '@letsela/core';

export interface BuildSession {
  id: string;
  projectId: string;
  status: 'pending' | 'prd_generating' | 'prd_complete' | 'architecture_generating' | 'architecture_complete' | 'file_generating' | 'done' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export interface BuildRequest {
  prompt: string;
  projectId?: string;
}

export interface BuildResponse {
  sessionId: string;
  projectId: string;
  status: string;
}
