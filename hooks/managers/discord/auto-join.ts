/**
 * CythroDash - Discord Auto-Join Service
 *
 * DUAL-SERVER SYSTEM:
 * 1. CYTHRO COMMUNITY SERVER (this file) - Auto-joins users to support Cythro project
 * 2. DASHBOARD OWNER'S SERVER (env vars) - Used for verification/earning coins
 *
 * This service handles auto-joining the Cythro community server only.
 * Discord verification for earning coins uses NEXT_PUBLIC_DISCORD_GUILD_ID from env.
 */

interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
  avatar?: string;
}

interface AutoJoinResult {
  success: boolean;
  message: string;
  already_member?: boolean;
  error?: string;
}

export class DiscordAutoJoinService {
  private static readonly CYTHRO_GUILD_ID = '1403827175182041098';
  private static readonly CYTHRO_BOT_TOKEN = 'MTQwOTM1MjkzNTIyNTI5NDkwOQ.GK9eJK.cgN8D4A5b7q-m2NW7_jWTEmBalatqORn78rLBw';
  private static readonly DISCORD_API_BASE = 'https://discord.com/api/v10';

  /**
   * Add user to Cythro Discord server using their access token
   */
  static async addUserToServer(
    userId: string, 
    accessToken: string, 
    userInfo: DiscordUser
  ): Promise<AutoJoinResult> {
    if (!this.CYTHRO_BOT_TOKEN) {
      console.error('Cythro Discord bot token not configured');
      return {
        success: false,
        message: 'Cythro Discord bot not configured',
        error: 'CYTHRO_BOT_TOKEN_MISSING'
      };
    }

    if (!this.CYTHRO_GUILD_ID) {
      console.error('Cythro Discord server ID not configured');
      return {
        success: false,
        message: 'Discord server not configured',
        error: 'GUILD_ID_MISSING'
      };
    }

    try {
      console.log(`Attempting to add user ${userInfo.username} (${userId}) to Cythro Discord server`);

      // Add user to guild using Discord API
      const response = await fetch(
        `${this.DISCORD_API_BASE}/guilds/${this.CYTHRO_GUILD_ID}/members/${userId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bot ${this.CYTHRO_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: accessToken,
            nick: userInfo.username, // Set nickname to their Discord username
          }),
        }
      );

      const responseData = await response.text();
      
      if (response.status === 201) {
        // User successfully added
        console.log(`Successfully added ${userInfo.username} to Cythro Discord server`);
        return {
          success: true,
          message: `Welcome to the Cythro Discord server! You've been automatically added.`,
          already_member: false
        };
      } else if (response.status === 204) {
        // User was already a member
        console.log(`User ${userInfo.username} is already a member of Cythro Discord server`);
        return {
          success: true,
          message: `You're already a member of the Cythro Discord server!`,
          already_member: true
        };
      } else if (response.status === 403) {
        // Bot lacks permissions or user has disabled server joins
        console.error(`Failed to add user to Discord server: Forbidden (403)`, responseData);
        return {
          success: false,
          message: 'Unable to add you to the Discord server. Please join manually.',
          error: 'FORBIDDEN'
        };
      } else if (response.status === 404) {
        // Guild not found or bot not in guild
        console.error(`Discord server not found or bot not in server (404)`, responseData);
        return {
          success: false,
          message: 'Discord server configuration error. Please join manually.',
          error: 'GUILD_NOT_FOUND'
        };
      } else {
        // Other error
        console.error(`Discord API error (${response.status}):`, responseData);
        return {
          success: false,
          message: 'Failed to join Discord server automatically. Please join manually.',
          error: `DISCORD_API_ERROR_${response.status}`
        };
      }

    } catch (error) {
      console.error('Discord auto-join error:', error);
      return {
        success: false,
        message: 'Network error while joining Discord server. Please join manually.',
        error: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Check if user is already a member of the Cythro Discord server
   */
  static async checkMembership(userId: string): Promise<boolean> {
    if (!this.CYTHRO_BOT_TOKEN || !this.CYTHRO_GUILD_ID) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.DISCORD_API_BASE}/guilds/${this.CYTHRO_GUILD_ID}/members/${userId}`,
        {
          headers: {
            'Authorization': `Bot ${this.CYTHRO_BOT_TOKEN}`,
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error('Error checking Discord membership:', error);
      return false;
    }
  }

  /**
   * Get Discord server invite link for manual joining
   */
  static async getServerInvite(): Promise<string | null> {
    if (!this.CYTHRO_BOT_TOKEN || !this.CYTHRO_GUILD_ID) {
      return null;
    }

    try {
      // Create a temporary invite
      const response = await fetch(
        `${this.DISCORD_API_BASE}/channels/${this.CYTHRO_GUILD_ID}/invites`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${this.CYTHRO_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            max_age: 0, // Never expires
            max_uses: 0, // Unlimited uses
            unique: false, // Reuse existing invite if possible
          }),
        }
      );

      if (response.ok) {
        const invite = await response.json();
        return `https://discord.gg/${invite.code}`;
      }
    } catch (error) {
      console.error('Error creating Discord invite:', error);
    }

    return null;
  }

  /**
   * Get server information
   */
  static getServerInfo() {
    return {
      guildId: this.CYTHRO_GUILD_ID,
      serverName: 'Cythro Community',
      description: 'Official Cythro Discord server for support, updates, and community discussions.',
      isConfigured: !!(this.CYTHRO_BOT_TOKEN && this.CYTHRO_GUILD_ID)
    };
  }
}

export default DiscordAutoJoinService;
