import { ContextStore, ContextKey } from '@letsela/core';
import { randomUUID } from 'crypto';
import { BuildSession } from './types';

export class SessionManager {
  private contextStore: ContextStore;
  private sessions: Map<string, BuildSession>;

  constructor(redisUrl?: string) {
    this.contextStore = new ContextStore(redisUrl);
    this.sessions = new Map();
  }

  createSession(projectId?: string): BuildSession {
    const sessionId = randomUUID();
    const finalProjectId = projectId || randomUUID();
    
    const session: BuildSession = {
      id: sessionId,
      projectId: finalProjectId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): BuildSession | undefined {
    return this.sessions.get(sessionId);
  }

  async updateSessionStatus(sessionId: string, status: BuildSession['status'], error?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.updatedAt = new Date();
      if (error) session.error = error;
      this.sessions.set(sessionId, session);
    }
  }

  getContextKey(sessionId: string): ContextKey {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return {
      projectId: session.projectId,
      sessionId: session.id
    };
  }

  getContextStore(): ContextStore {
    return this.contextStore;
  }
}
