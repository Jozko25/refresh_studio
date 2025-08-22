import dotenv from 'dotenv';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

class ElevenLabsAPI {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.baseURL = 'https://api.elevenlabs.io/v1';
        
        if (!this.apiKey) {
            throw new Error('ELEVENLABS_API_KEY not found in environment variables');
        }
        
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    // List all agents
    async listAgents() {
        try {
            const response = await this.client.get('/convai/agents');
            return response.data;
        } catch (error) {
            console.error('Error listing agents:', error.response?.data || error.message);
            throw error;
        }
    }

    // Get specific agent details
    async getAgent(agentId) {
        try {
            const response = await this.client.get(`/convai/agents/${agentId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting agent:', error.response?.data || error.message);
            throw error;
        }
    }

    // Update agent configuration (including prompt)
    async updateAgent(agentId, config) {
        try {
            const response = await this.client.patch(`/convai/agents/${agentId}`, {
                agent_config: config
            });
            console.log('Agent updated successfully');
            return response.data;
        } catch (error) {
            console.error('Error updating agent:', error.response?.data || error.message);
            throw error;
        }
    }

    // Update agent prompt from FINAL_PROMPT_CLEAN.md
    async updateAgentPrompt(agentId) {
        try {
            // Read the prompt from file
            const promptPath = path.join(__dirname, '..', 'FINAL_PROMPT_CLEAN.md');
            const prompt = await fs.readFile(promptPath, 'utf-8');
            
            // Get current agent config
            const agent = await this.getAgent(agentId);
            
            // Get the current prompt configuration and clean it
            const currentPrompt = agent.conversation_config.agent.prompt;
            
            // Create updated prompt config - remove tools field but keep tool_ids
            const updatedPrompt = {
                ...currentPrompt,
                prompt: prompt
            };
            
            // Remove the tools field to avoid conflict with tool_ids
            if (updatedPrompt.tools) {
                delete updatedPrompt.tools;
            }
            
            console.log('✅ Prompt update: tools field removed, ready to send');
            
            // Send the update with the cleaned prompt configuration
            const response = await this.client.patch(`/convai/agents/${agentId}`, {
                conversation_config: {
                    agent: {
                        prompt: updatedPrompt
                    }
                }
            });
            
            console.log('Prompt updated from FINAL_PROMPT_CLEAN.md');
            return response.data;
        } catch (error) {
            console.error('Error updating prompt:', error.response?.data || error.message);
            throw error;
        }
    }

    // List all tools
    async listTools() {
        try {
            const response = await this.client.get('/convai/tools');
            return response.data;
        } catch (error) {
            console.error('Error listing tools:', error.response?.data || error.message);
            throw error;
        }
    }

    // Get specific tool details
    async getTool(toolId) {
        try {
            const response = await this.client.get(`/convai/tools/${toolId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting tool:', error.response?.data || error.message);
            throw error;
        }
    }

    // Update tool configuration
    async updateTool(toolId, toolConfig) {
        try {
            const response = await this.client.patch(`/convai/tools/${toolId}`, {
                tool_config: toolConfig
            });
            console.log(`Tool ${toolId} updated successfully`);
            return response.data;
        } catch (error) {
            console.error('Error updating tool:', error.response?.data || error.message);
            throw error;
        }
    }

    // Create a new tool
    async createTool(toolConfig) {
        try {
            const response = await this.client.post('/convai/tools', {
                tool_config: toolConfig
            });
            console.log('Tool created successfully');
            return response.data;
        } catch (error) {
            console.error('Error creating tool:', error.response?.data || error.message);
            throw error;
        }
    }

    // Delete a tool
    async deleteTool(toolId) {
        try {
            const response = await this.client.delete(`/convai/tools/${toolId}`);
            console.log(`Tool ${toolId} deleted successfully`);
            return response.data;
        } catch (error) {
            console.error('Error deleting tool:', error.response?.data || error.message);
            throw error;
        }
    }

    // Update webhook URL for a tool
    async updateToolWebhook(toolId, webhookUrl) {
        try {
            const tool = await this.getTool(toolId);
            
            const updatedConfig = {
                ...tool.tool_config,
                api_schema: {
                    ...tool.tool_config.api_schema,
                    url: webhookUrl
                }
            };
            
            return await this.updateTool(toolId, updatedConfig);
        } catch (error) {
            console.error('Error updating tool webhook:', error.response?.data || error.message);
            throw error;
        }
    }

    // Helper function to find agent by name
    async findAgentByName(name) {
        try {
            const agents = await this.listAgents();
            return agents.agents?.find(agent => 
                agent.agent_config?.name?.toLowerCase().includes(name.toLowerCase())
            );
        } catch (error) {
            console.error('Error finding agent:', error.response?.data || error.message);
            throw error;
        }
    }

    // Helper function to find tool by name
    async findToolByName(name) {
        try {
            const tools = await this.listTools();
            return tools.tools?.find(tool => 
                tool.tool_config?.name?.toLowerCase() === name.toLowerCase()
            );
        } catch (error) {
            console.error('Error finding tool:', error.response?.data || error.message);
            throw error;
        }
    }
}

export default ElevenLabsAPI;