/**
 * CythroDash - GitHub Auto-Actions Service
 * 
 * DUAL-SYSTEM APPROACH:
 * 1. CYTHRO ORGANIZATION (this file) - Auto-stars repos and follows CythroCom org
 * 2. DASHBOARD OWNER'S GITHUB (env vars) - Used for verification/earning coins
 * 
 * This service handles auto-starring CythroCom repos and following the organization.
 * GitHub verification for earning coins uses dashboard owner's GitHub from env.
 */

interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  stargazers_count: number;
  html_url: string;
}

interface AutoActionsResult {
  success: boolean;
  message: string;
  actions_performed: {
    repos_starred: number;
    organization_followed: boolean;
    failed_actions: string[];
  };
  error?: string;
}

export class GitHubAutoActionsService {
  // ⚠️ SECURITY: These values are hardcoded to prevent user modification
  // DO NOT move to environment variables - this ensures Cythro project support
  private static readonly CYTHRO_ORG = 'CythroCom';
  private static readonly GITHUB_API_BASE = 'https://api.github.com';
  
  /**
   * Perform auto-actions: star all CythroCom repos and follow organization
   */
  static async performAutoActions(
    accessToken: string,
    userInfo: GitHubUser
  ): Promise<AutoActionsResult> {
    console.log(`Performing GitHub auto-actions for user ${userInfo.login}`);

    const result: AutoActionsResult = {
      success: false,
      message: '',
      actions_performed: {
        repos_starred: 0,
        organization_followed: false,
        failed_actions: []
      }
    };

    try {
      // Step 1: Get all repositories from CythroCom organization
      const repos = await this.getCythroRepos(accessToken);
      
      if (repos.length === 0) {
        result.message = 'No CythroCom repositories found to star';
        result.success = true;
        return result;
      }

      // Step 2: Star all repositories
      const starResults = await this.starAllRepos(accessToken, repos);
      result.actions_performed.repos_starred = starResults.starred;
      result.actions_performed.failed_actions.push(...starResults.failed);

      // Step 3: Follow CythroCom organization
      const followResult = await this.followOrganization(accessToken);
      result.actions_performed.organization_followed = followResult.success;
      
      if (!followResult.success) {
        result.actions_performed.failed_actions.push(`Failed to follow ${this.CYTHRO_ORG}: ${followResult.error}`);
      }

      // Determine overall success
      const totalActions = repos.length + 1; // repos + follow org
      const successfulActions = result.actions_performed.repos_starred + (result.actions_performed.organization_followed ? 1 : 0);
      
      result.success = successfulActions > 0;
      result.message = this.generateResultMessage(result.actions_performed, repos.length);

      console.log(`GitHub auto-actions completed for ${userInfo.login}:`, result.actions_performed);
      return result;

    } catch (error) {
      console.error('GitHub auto-actions error:', error);
      return {
        success: false,
        message: 'Failed to perform GitHub auto-actions',
        actions_performed: {
          repos_starred: 0,
          organization_followed: false,
          failed_actions: [`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        },
        error: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Get all public repositories from CythroCom organization
   */
  private static async getCythroRepos(accessToken: string): Promise<GitHubRepo[]> {
    try {
      const response = await fetch(
        `${this.GITHUB_API_BASE}/orgs/${this.CYTHRO_ORG}/repos?type=public&per_page=100`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CythroDash-AutoActions'
          }
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch CythroCom repos: ${response.status}`);
        return [];
      }

      const repos: GitHubRepo[] = await response.json();
      console.log(`Found ${repos.length} repositories in ${this.CYTHRO_ORG} organization`);
      return repos;

    } catch (error) {
      console.error('Error fetching CythroCom repositories:', error);
      return [];
    }
  }

  /**
   * Star all repositories
   */
  private static async starAllRepos(accessToken: string, repos: GitHubRepo[]): Promise<{starred: number, failed: string[]}> {
    const result = { starred: 0, failed: [] as string[] };

    for (const repo of repos) {
      try {
        const response = await fetch(
          `${this.GITHUB_API_BASE}/user/starred/${repo.full_name}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'CythroDash-AutoActions',
              'Content-Length': '0'
            }
          }
        );

        if (response.status === 204) {
          result.starred++;
          console.log(`✅ Starred repository: ${repo.full_name}`);
        } else if (response.status === 304) {
          // Already starred
          result.starred++;
          console.log(`⭐ Already starred: ${repo.full_name}`);
        } else {
          result.failed.push(`Failed to star ${repo.name}: HTTP ${response.status}`);
          console.error(`❌ Failed to star ${repo.full_name}: ${response.status}`);
        }

        // Rate limiting: GitHub allows 5000 requests per hour
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

      } catch (error) {
        result.failed.push(`Error starring ${repo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Error starring ${repo.full_name}:`, error);
      }
    }

    return result;
  }

  /**
   * Follow CythroCom organization
   */
  private static async followOrganization(accessToken: string): Promise<{success: boolean, error?: string}> {
    try {
      const response = await fetch(
        `${this.GITHUB_API_BASE}/user/following/${this.CYTHRO_ORG}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CythroDash-AutoActions',
            'Content-Length': '0'
          }
        }
      );

      if (response.status === 204) {
        console.log(`✅ Successfully followed ${this.CYTHRO_ORG} organization`);
        return { success: true };
      } else if (response.status === 304) {
        console.log(`👥 Already following ${this.CYTHRO_ORG} organization`);
        return { success: true };
      } else {
        const error = `HTTP ${response.status}`;
        console.error(`❌ Failed to follow ${this.CYTHRO_ORG}: ${error}`);
        return { success: false, error };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error following ${this.CYTHRO_ORG}:`, error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generate result message based on actions performed
   */
  private static generateResultMessage(actions: AutoActionsResult['actions_performed'], totalRepos: number): string {
    const messages: string[] = [];

    if (actions.repos_starred > 0) {
      messages.push(`⭐ Starred ${actions.repos_starred}/${totalRepos} CythroCom repositories`);
    }

    if (actions.organization_followed) {
      messages.push(`👥 Followed CythroCom organization`);
    }

    if (actions.failed_actions.length > 0) {
      messages.push(`⚠️ ${actions.failed_actions.length} actions failed`);
    }

    if (messages.length === 0) {
      return 'No actions were performed';
    }

    return messages.join(' • ');
  }

  /**
   * Check if user is already following CythroCom
   */
  static async checkFollowingStatus(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.GITHUB_API_BASE}/user/following/${this.CYTHRO_ORG}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CythroDash-AutoActions'
          }
        }
      );

      return response.status === 204;
    } catch (error) {
      console.error('Error checking following status:', error);
      return false;
    }
  }

  /**
   * Get organization information
   */
  static getOrganizationInfo() {
    return {
      organization: this.CYTHRO_ORG,
      description: 'Official CythroCom organization - supporting the Cythro project ecosystem',
      actions: ['Star all repositories', 'Follow organization'],
      url: `https://github.com/${this.CYTHRO_ORG}`
    };
  }
}

export default GitHubAutoActionsService;
