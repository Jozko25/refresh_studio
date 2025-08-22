#!/usr/bin/env node

import ElevenLabsAPI from '../src/elevenlabs-api.js';

async function main() {
    const api = new ElevenLabsAPI();
    const toolId = "tool_5201k2phhg36eyzagdxr4e75wh37";
    
    try {
        // Get current tool configuration
        const currentTool = await api.getTool(toolId);
        
        // Create updated configuration with better descriptions and data-only responses
        const updatedConfig = {
            ...currentTool.tool_config,
            name: "refresh_booking",
            description: "REFRESH clinic booking system - Returns structured JSON data for services, prices, availability. The AI should interpret this data and present it naturally to users in Slovak.",
            api_schema: {
                ...currentTool.tool_config.api_schema,
                url: "https://refresh-studio.onrender.com/elevenlabs-unified", // Updated URL
                request_body_schema: {
                    type: "object",
                    required: ["tool_name"],
                    description: "REFRESH booking tool - returns structured JSON data for AI interpretation",
                    properties: {
                        search_term: {
                            type: "string",
                            description: "Service name, time request, or user query in Slovak (e.g. 'hydrafacial', 'Zuzka má aký termín', '15:15 máte voľné')",
                            dynamic_variable: "",
                            constant_value: ""
                        },
                        service_id: {
                            type: "string",
                            description: "Service ID if known (usually empty - let the system find it)",
                            dynamic_variable: "",
                            constant_value: ""
                        },
                        tool_name: {
                            type: "string",
                            description: "Operation type: 'quick_booking' (finds services/prices/times), 'get_services_overview' (lists available services), or 'get_opening_hours' (clinic hours/location)",
                            dynamic_variable: "",
                            constant_value: ""
                        }
                    }
                }
            }
        };
        
        const result = await api.updateTool(toolId, updatedConfig);
        console.log('✅ Tool configuration updated successfully!');
        console.log('Updated tool:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('❌ Error updating tool:', error.message);
        process.exit(1);
    }
}

main();