import express from 'express';
import cors from 'cors';
import { BuildOrchestrator } from '../orchestrator';
import { BuildRequest, BuildResponse } from '../types';

export function createServer(orchestrator: BuildOrchestrator) {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Start a new build
  app.post('/api/build', async (req, res) => {
    try {
      const { prompt, projectId } = req.body as BuildRequest;
      
      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'prompt is required' });
      }
      
      const sessionId = await orchestrator.startBuild(prompt, projectId);
      
      const response: BuildResponse = {
        sessionId,
        projectId: (orchestrator as any).sessionManager.getSession(sessionId).projectId,
        status: 'prd_generating'
      };
      
      res.json(response);
    } catch (error) {
      console.error('Build endpoint error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });
  
  // Get build status
  app.get('/api/build/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const status = await orchestrator.getBuildStatus(sessionId);
      res.json(status);
    } catch (error) {
      res.status(404).json({ 
        error: error instanceof Error ? error.message : 'Session not found' 
      });
    }
  });
  
  // Get artifacts only
  app.get('/api/build/:sessionId/artifacts', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { artifacts } = await orchestrator.getBuildStatus(sessionId);
      res.json(artifacts);
    } catch (error) {
      res.status(404).json({ error: 'Session not found' });
    }
  });
  
  return app;
}
