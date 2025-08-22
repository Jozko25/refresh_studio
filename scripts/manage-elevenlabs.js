#!/usr/bin/env node

import ElevenLabsAPI from '../src/elevenlabs-api.js';
import { promises as fs } from 'fs';
import path from 'path';

async function main() {
    const api = new ElevenLabsAPI();
    const command = process.argv[2];
    const arg1 = process.argv[3];
    const arg2 = process.argv[4];

    try {
        switch(command) {
            case 'list-agents':
                console.log('Listing all agents...');
                const agents = await api.listAgents();
                console.log(JSON.stringify(agents, null, 2));
                break;

            case 'list-tools':
                console.log('Listing all tools...');
                const tools = await api.listTools();
                console.log(JSON.stringify(tools, null, 2));
                break;

            case 'get-agent':
                if (!arg1) {
                    console.error('Please provide agent ID');
                    process.exit(1);
                }
                console.log(`Getting agent ${arg1}...`);
                const agent = await api.getAgent(arg1);
                console.log(JSON.stringify(agent, null, 2));
                break;

            case 'get-tool':
                if (!arg1) {
                    console.error('Please provide tool ID');
                    process.exit(1);
                }
                console.log(`Getting tool ${arg1}...`);
                const tool = await api.getTool(arg1);
                console.log(JSON.stringify(tool, null, 2));
                break;

            case 'update-prompt':
                if (!arg1) {
                    console.error('Please provide agent ID');
                    process.exit(1);
                }
                console.log(`Updating prompt for agent ${arg1}...`);
                await api.updateAgentPrompt(arg1);
                console.log('Prompt updated successfully from FINAL_PROMPT_CLEAN.md');
                break;

            case 'update-webhook':
                if (!arg1 || !arg2) {
                    console.error('Please provide tool ID and webhook URL');
                    process.exit(1);
                }
                console.log(`Updating webhook for tool ${arg1}...`);
                await api.updateToolWebhook(arg1, arg2);
                console.log('Webhook updated successfully');
                break;

            case 'find-agent':
                if (!arg1) {
                    console.error('Please provide agent name to search');
                    process.exit(1);
                }
                console.log(`Searching for agent: ${arg1}...`);
                const foundAgent = await api.findAgentByName(arg1);
                if (foundAgent) {
                    console.log('Found agent:');
                    console.log(JSON.stringify(foundAgent, null, 2));
                } else {
                    console.log('Agent not found');
                }
                break;

            case 'find-tool':
                if (!arg1) {
                    console.error('Please provide tool name to search');
                    process.exit(1);
                }
                console.log(`Searching for tool: ${arg1}...`);
                const foundTool = await api.findToolByName(arg1);
                if (foundTool) {
                    console.log('Found tool:');
                    console.log(JSON.stringify(foundTool, null, 2));
                } else {
                    console.log('Tool not found');
                }
                break;

            case 'sync-tools':
                console.log('Syncing all tool configurations...');
                // This will sync the three main tools with our webhook
                const toolNames = ['quick_booking', 'get_services_overview', 'get_opening_hours'];
                const webhookBase = process.env.WEBHOOK_BASE_URL || 'https://refresh-studio.onrender.com';
                
                for (const toolName of toolNames) {
                    console.log(`Updating ${toolName}...`);
                    const tool = await api.findToolByName(toolName);
                    if (tool) {
                        await api.updateToolWebhook(tool.id, `${webhookBase}/elevenlabs-unified`);
                        console.log(`✓ ${toolName} updated`);
                    } else {
                        console.log(`✗ ${toolName} not found`);
                    }
                }
                break;

            case 'help':
            default:
                console.log(`
ElevenLabs Agent Management CLI

Usage: node scripts/manage-elevenlabs.js [command] [args]

Commands:
  list-agents              - List all agents
  list-tools               - List all tools
  get-agent <id>          - Get specific agent details
  get-tool <id>           - Get specific tool details
  update-prompt <agent-id> - Update agent prompt from FINAL_PROMPT_CLEAN.md
  update-webhook <tool-id> <url> - Update tool webhook URL
  find-agent <name>       - Find agent by name
  find-tool <name>        - Find tool by name
  sync-tools              - Sync all tool webhooks
  help                    - Show this help message

Examples:
  node scripts/manage-elevenlabs.js list-agents
  node scripts/manage-elevenlabs.js update-prompt agent_123
  node scripts/manage-elevenlabs.js update-webhook tool_456 https://example.com/webhook
  node scripts/manage-elevenlabs.js find-agent "refresh"
  node scripts/manage-elevenlabs.js sync-tools
                `);
                break;
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();