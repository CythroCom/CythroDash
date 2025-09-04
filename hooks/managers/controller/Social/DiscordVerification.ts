/**
 * CythroDash - Discord Verification Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { 
  CythroDashSocialVerification, 
  VerificationStatus, 
  SocialPlatform, 
  VerificationAction 
} from '@/database/tables/cythro_dash_social_verifications';
import { socialVerificationOperations } from '@/hooks/managers/database/social-verifications';
import { userOperations } from '@/hooks/managers/database/user';

// Discord API interfaces
interface DiscordGuildMember {
  user?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  nick?: string;
  roles: string[];
  joined_at: string;
  premium_since?: string;
  deaf: boolean;
  mute: boolean;
  pending?: boolean;
}

interface DiscordVerificationRequest {
  user_id: number;
  guild_id: string;
  ip_address: string;
  user_agent: string;
  discord_user_id?: string; // Discord user ID from connection
  discord_username?: string; // Discord username from connection
}

interface DiscordVerificationResult {
  success: boolean;
  message: string;
  verification?: CythroDashSocialVerification;
  member_data?: DiscordGuildMember;
  errors?: string[];
}

export class DiscordVerificationController {
  
  /**
   * Verify Discord server membership
   */
  static async verifyServerMembership(request: DiscordVerificationRequest): Promise<DiscordVerificationResult> {
    try {
      console.log('Discord verification request:', { user_id: request.user_id, guild_id: request.guild_id });

      // Get user's Discord OAuth data
      const user = await userOperations.getUserById(request.user_id);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          errors: ['USER_NOT_FOUND']
        };
      }

      // Check if Discord user ID is provided in the request
      if (!request.discord_user_id) {
        return {
          success: false,
          message: 'Discord account not connected. Please connect your Discord account first.',
          errors: ['DISCORD_NOT_CONNECTED']
        };
      }

      const discordUserId = request.discord_user_id;

      // Check if verification already exists
      const existingVerification = await socialVerificationOperations.getVerificationByUserAndPlatform(
        request.user_id,
        SocialPlatform.DISCORD,
        VerificationAction.JOIN_SERVER,
        request.guild_id
      );

      // Check Discord API for membership
      const memberData = await DiscordVerificationController.checkGuildMembership(
        request.guild_id,
        discordUserId
      );

      if (!memberData) {
        // User is not in the server
        if (existingVerification) {
          // Update existing verification to failed
          await socialVerificationOperations.updateVerificationStatus(
            existingVerification._id!.toString(),
            VerificationStatus.FAILED,
            'User is not a member of the Discord server'
          );
        }

        return {
          success: false,
          message: 'You are not a member of our Discord server. Please join first.',
          errors: ['NOT_GUILD_MEMBER']
        };
      }

      // User is in the server - create or update verification
      let verification: CythroDashSocialVerification;

      if (existingVerification) {
        // Update existing verification
        verification = await socialVerificationOperations.updateVerification(existingVerification._id!.toString(), {
          status: VerificationStatus.VERIFIED,
          verified_at: new Date(),
          last_check: new Date(),
          verification_data: {
            guild_id: request.guild_id,
            member_since: new Date(memberData.joined_at),
            roles: memberData.roles
          },
          error_message: undefined,
          error_code: undefined,
          updated_at: new Date()
        });
      } else {
        // Create new verification
        verification = await socialVerificationOperations.createVerification({
          user_id: request.user_id,
          platform: SocialPlatform.DISCORD,
          action: VerificationAction.JOIN_SERVER,
          platform_user_id: discordUserId,
          platform_username: request.discord_username || 'Unknown',
          target_id: request.guild_id,
          status: VerificationStatus.VERIFIED,
          verified_at: new Date(),
          coins_reward: 50, // Discord server join reward
          claimed: false,
          verification_data: {
            guild_id: request.guild_id,
            member_since: new Date(memberData.joined_at),
            roles: memberData.roles
          },
          ip_address: request.ip_address,
          user_agent: request.user_agent,
          verification_attempts: 1,
          last_check: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      return {
        success: true,
        message: 'Discord server membership verified successfully!',
        verification,
        member_data: memberData
      };

    } catch (error) {
      console.error('Discord verification error:', error);
      return {
        success: false,
        message: 'Failed to verify Discord membership',
        errors: ['VERIFICATION_ERROR']
      };
    }
  }

  /**
   * Check if user is a member of Discord guild using bot token
   */
  private static async checkGuildMembership(guildId: string, userId: string): Promise<DiscordGuildMember | null> {
    try {
      const botToken = process.env.DISCORD_BOT_TOKEN;
      if (!botToken) {
        console.error('Discord bot token not configured');
        return null;
      }

      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        // User is not a member
        return null;
      }

      if (!response.ok) {
        console.error('Discord API error:', response.status, await response.text());
        return null;
      }

      const memberData: DiscordGuildMember = await response.json();
      return memberData;

    } catch (error) {
      console.error('Discord API request error:', error);
      return null;
    }
  }

  /**
   * Claim rewards for verified Discord membership
   */
  static async claimDiscordReward(userId: number, verificationId: string): Promise<DiscordVerificationResult> {
    try {
      const verification = await socialVerificationOperations.getVerificationById(verificationId);
      
      if (!verification) {
        return {
          success: false,
          message: 'Verification not found',
          errors: ['VERIFICATION_NOT_FOUND']
        };
      }

      if (verification.user_id !== userId) {
        return {
          success: false,
          message: 'Unauthorized',
          errors: ['UNAUTHORIZED']
        };
      }

      if (verification.status !== VerificationStatus.VERIFIED) {
        return {
          success: false,
          message: 'Verification not completed',
          errors: ['NOT_VERIFIED']
        };
      }

      if (verification.claimed) {
        return {
          success: false,
          message: 'Reward already claimed',
          errors: ['ALREADY_CLAIMED']
        };
      }

      // Award coins to user
      const user = await userOperations.getUserById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          errors: ['USER_NOT_FOUND']
        };
      }

      await userOperations.updateCoins(userId, verification.coins_reward, 'Discord server verification reward');

      // Mark verification as claimed
      const updatedVerification = await socialVerificationOperations.updateVerification(verificationId, {
        claimed: true,
        claimed_at: new Date(),
        updated_at: new Date()
      });

      return {
        success: true,
        message: `Successfully claimed ${verification.coins_reward} coins for Discord verification!`,
        verification: updatedVerification
      };

    } catch (error) {
      console.error('Discord reward claim error:', error);
      return {
        success: false,
        message: 'Failed to claim Discord reward',
        errors: ['CLAIM_ERROR']
      };
    }
  }

  /**
   * Re-verify Discord membership (for periodic checks)
   */
  static async recheckMembership(verificationId: string): Promise<DiscordVerificationResult> {
    try {
      const verification = await socialVerificationOperations.getVerificationById(verificationId);
      
      if (!verification) {
        return {
          success: false,
          message: 'Verification not found',
          errors: ['VERIFICATION_NOT_FOUND']
        };
      }

      if (!verification.platform_user_id || !verification.target_id) {
        return {
          success: false,
          message: 'Invalid verification data',
          errors: ['INVALID_DATA']
        };
      }

      // Check current membership
      const memberData = await DiscordVerificationController.checkGuildMembership(
        verification.target_id,
        verification.platform_user_id
      );

      if (!memberData) {
        // User is no longer a member
        await socialVerificationOperations.updateVerificationStatus(
          verificationId,
          VerificationStatus.FAILED,
          'User is no longer a member of the Discord server'
        );

        return {
          success: false,
          message: 'User is no longer a member of the Discord server',
          errors: ['MEMBERSHIP_LOST']
        };
      }

      // Update verification with current data
      const updatedVerification = await socialVerificationOperations.updateVerification(verificationId, {
        last_check: new Date(),
        verification_data: {
          ...verification.verification_data,
          roles: memberData.roles
        },
        updated_at: new Date()
      });

      return {
        success: true,
        message: 'Discord membership re-verified successfully',
        verification: updatedVerification,
        member_data: memberData
      };

    } catch (error) {
      console.error('Discord recheck error:', error);
      return {
        success: false,
        message: 'Failed to recheck Discord membership',
        errors: ['RECHECK_ERROR']
      };
    }
  }
}
