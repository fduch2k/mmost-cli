import { z } from 'zod';

/**
 * Configuration schema for Mattermost CLI
 * @typedef {Object} MattermostConfigSchema
 * @property {string} url - Mattermost instance URL
 * @property {string} token - Mattermost personal access token
 * @property {string} [teamName] - Mattermost team name (from MATTERMOST_TEAM_NAME env var)
 * @property {string} [teamId] - Mattermost team ID (from MATTERMOST_TEAM_ID env var)
 */
const configSchema = z
  .object({
    url: z.string().url('Invalid Mattermost URL (from MATTERMOST_URL env var)'),
    token: z.string().min(1, 'Mattermost token is required (from MATTERMOST_TOKEN env var)'),
    teamName: z.string().optional(),
    teamId: z.string().optional(),
  })
  .refine(data => data.teamName || data.teamId, {
    message:
      'Either team name (MATTERMOST_TEAM_NAME) or team ID (MATTERMOST_TEAM_ID) must be provided',
  });

export type MattermostConfig = z.infer<typeof configSchema>;

/**
 * Load configuration from environment variables
 * @returns Validated configuration object
 */
export function loadConfig(): MattermostConfig {
  const config = {
    url: process.env.MATTERMOST_URL || '',
    token: process.env.MATTERMOST_TOKEN || '',
    teamName: process.env.MATTERMOST_TEAM_NAME || undefined,
    teamId: process.env.MATTERMOST_TEAM_ID || undefined,
  };

  return configSchema.parse(config);
}
