import { Express, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Setup docker route
 * @param app Express application
 */
export const setupDockerRoute = (app: Express): void => {

  // Get docker ps data
  app.get('/api/docker/ps', async (req: Request, res: Response) => {
    try {
      // Execute docker ps with JSON format for structured output
      // Each line will be a JSON object with container information
      const { stdout, stderr } = await execAsync('docker ps --format "{{json .}}"');

      if (stderr) {
        console.error('Docker ps stderr:', stderr);
      }

      // Parse the output - each line is a JSON object
      const containers = stdout
        .trim()
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (parseError) {
            console.error('Error parsing container line:', line, parseError);
            return null;
          }
        })
        .filter(container => container !== null);

      res.json({
        success: true,
        containers: containers,
        count: containers.length
      });
    } catch (error: any) {
      console.error('Error executing docker ps:', error);
      
      // Check if docker is not available
      if (error.code === 'ENOENT' || error.message?.includes('docker')) {
        return res.status(503).json({
          success: false,
          error: 'Docker is not available or not installed',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to execute docker ps',
        message: error.message
      });
    }
  });

  // Stop a docker container
  app.post('/api/docker/stop', async (req: Request, res: Response) => {
    try {
      const { containerId } = req.body;

      if (!containerId || typeof containerId !== 'string') {
        return res.status(400).json({ 
          success: false,
          error: 'containerId is required and must be a string' 
        });
      }

      // Execute docker stop
      const { stdout, stderr } = await execAsync(`docker stop ${containerId}`);

      if (stderr && !stderr.includes(containerId)) {
        console.error('Docker stop stderr:', stderr);
      }

      res.json({
        success: true,
        message: `Container ${containerId} stopped successfully`,
        output: stdout
      });
    } catch (error: any) {
      console.error('Error stopping container:', error);
      
      if (error.code === 'ENOENT' || error.message?.includes('docker')) {
        return res.status(503).json({
          success: false,
          error: 'Docker is not available or not installed',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to stop container',
        message: error.message || error.stderr || 'Unknown error'
      });
    }
  });
};

