/**
 * CHAT SETTINGS MANAGEMENT
 * 
 * Allows ChatGPT chat to update user settings, preferences, and strategies
 * Examples:
 * - "Set my risk level to aggressive"
 * - "Change market scan interval to 6 hours"
 * - "New strategy: grid trading on BTC"
 * - "Disable email alerts"
 */

import type { UnifiedContext } from './unifiedContextService';

// ============================================================================
// CHAT COMMAND TYPES
// ============================================================================

export type SettingsCommand = 
  | 'update_profile'
  | 'update_preferences'
  | 'update_strategy'
  | 'update_risk_level'
  | 'update_scan_interval'
  | 'toggle_notifications'
  | 'update_position_size'
  | 'update_loss_limit';

export interface ChatSettingsUpdate {
  command: SettingsCommand;
  parameters: Record<string, any>;
  reasoning?: string;
  confirmationRequired?: boolean;
}

export interface SettingsUpdateResponse {
  success: boolean;
  command: SettingsCommand;
  oldValue?: any;
  newValue?: any;
  message: string;
  requiresApproval?: boolean;
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

/**
 * Parse user intent from chat message to extract settings changes
 */
export function parseSettingsIntent(
  message: string,
  context: UnifiedContext
): ChatSettingsUpdate | null {
  const lower = message.toLowerCase();

  // Risk Level Changes
  if (lower.includes('risico') || lower.includes('risk')) {
    if (lower.includes('voorzichtig') || lower.includes('conservative')) {
      return {
        command: 'update_risk_level',
        parameters: { riskProfile: 'voorzichtig' },
        reasoning: 'User requested conservative risk profile'
      };
    }
    if (lower.includes('gebalanceerd') || lower.includes('balanced')) {
      return {
        command: 'update_risk_level',
        parameters: { riskProfile: 'gebalanceerd' },
        reasoning: 'User requested balanced risk profile'
      };
    }
    if (lower.includes('actief') || lower.includes('aggressive')) {
      return {
        command: 'update_risk_level',
        parameters: { riskProfile: 'actief' },
        reasoning: 'User requested aggressive risk profile',
        confirmationRequired: true
      };
    }
  }

  // Scan Interval Changes
  if (lower.includes('interval') || lower.includes('frequentie') || lower.includes('scan')) {
    if (lower.includes('elk uur') || lower.includes('1 uur') || lower.includes('1h')) {
      return {
        command: 'update_scan_interval',
        parameters: { marketScanInterval: '1h' },
        reasoning: 'User requested hourly market scans'
      };
    }
    if (lower.includes('6 uur') || lower.includes('6h')) {
      return {
        command: 'update_scan_interval',
        parameters: { marketScanInterval: '6h' },
        reasoning: 'User requested 6-hourly market scans'
      };
    }
    if (lower.includes('dagelijks') || lower.includes('daily') || lower.includes('24h')) {
      return {
        command: 'update_scan_interval',
        parameters: { marketScanInterval: '24h' },
        reasoning: 'User requested daily market scans'
      };
    }
    if (lower.includes('handmatig') || lower.includes('manual') || lower.includes('uit')) {
      return {
        command: 'update_scan_interval',
        parameters: { marketScanInterval: 'manual' },
        reasoning: 'User requested manual market scans only'
      };
    }
  }

  // Notification Preferences
  if (lower.includes('notificatie') || lower.includes('alert') || lower.includes('email')) {
    if (lower.includes('uit') || lower.includes('disable') || lower.includes('off')) {
      if (lower.includes('email')) {
        return {
          command: 'toggle_notifications',
          parameters: { emailOnAlert: false, emailOnExecution: false },
          reasoning: 'User disabled email notifications'
        };
      }
      return {
        command: 'toggle_notifications',
        parameters: { emailOnExecution: false, emailOnAlert: false },
        reasoning: 'User disabled notifications'
      };
    }
    if (lower.includes('aan') || lower.includes('enable') || lower.includes('on')) {
      return {
        command: 'toggle_notifications',
        parameters: { emailOnAlert: true, emailOnExecution: true },
        reasoning: 'User enabled notifications'
      };
    }
  }

  // Position Size
  if (lower.includes('positie') || lower.includes('position size') || lower.includes('maximum')) {
    const match = message.match(/(\d+)%/);
    if (match) {
      const percentage = parseInt(match[1], 10);
      if (percentage > 0 && percentage <= 100) {
        return {
          command: 'update_position_size',
          parameters: { maxPositionSize: percentage },
          reasoning: `User set max position size to ${percentage}%`,
          confirmationRequired: percentage > 50
        };
      }
    }
  }

  // Strategy Changes
  if (lower.includes('strategie') || lower.includes('strategy') || lower.includes('systeem')) {
    if (lower.includes('dca')) {
      return {
        command: 'update_strategy',
        parameters: { strategy: 'DCA' },
        reasoning: 'User selected DCA (Dollar Cost Averaging) strategy'
      };
    }
    if (lower.includes('grid') || lower.includes('grid trading')) {
      return {
        command: 'update_strategy',
        parameters: { strategy: 'Grid Trading' },
        reasoning: 'User selected Grid Trading strategy'
      };
    }
    if (lower.includes('momentum')) {
      return {
        command: 'update_strategy',
        parameters: { strategy: 'Momentum Trading' },
        reasoning: 'User selected Momentum Trading strategy'
      };
    }
    if (lower.includes('kopen en houden') || lower.includes('buy and hold')) {
      return {
        command: 'update_strategy',
        parameters: { strategy: 'Buy & Hold' },
        reasoning: 'User selected Buy & Hold strategy'
      };
    }
  }

  // Daily Loss Limit
  if (lower.includes('verlies') || lower.includes('loss limit') || lower.includes('limiet')) {
    const match = message.match(/(\d+)%/);
    if (match) {
      const percentage = parseInt(match[1], 10);
      if (percentage > 0 && percentage <= 10) {
        return {
          command: 'update_loss_limit',
          parameters: { dailyLossLimit: percentage },
          reasoning: `User set daily loss limit to ${percentage}%`
        };
      }
    }
  }

  return null;
}

/**
 * Execute settings update
 */
export async function executeSettingsUpdate(
  userId: string,
  update: ChatSettingsUpdate
): Promise<SettingsUpdateResponse> {
  try {
    const endpoint = getEndpointForCommand(update.command);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        ...update.parameters
      })
    });

    if (!response.ok) {
      return {
        success: false,
        command: update.command,
        message: `Failed to update: ${response.statusText}`,
        requiresApproval: false
      };
    }

    const result = await response.json();

    return {
      success: true,
      command: update.command,
      oldValue: result.oldValue,
      newValue: result.newValue,
      message: formatSuccessMessage(update.command, result.newValue),
      requiresApproval: false
    };
  } catch (error) {
    return {
      success: false,
      command: update.command,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      requiresApproval: false
    };
  }
}

/**
 * Get endpoint for settings command
 */
function getEndpointForCommand(command: SettingsCommand): string {
  switch (command) {
    case 'update_profile':
      return '/api/user/profile';
    case 'update_preferences':
      return '/api/user/notification-preferences';
    case 'update_strategy':
      return '/api/user/strategy';
    case 'update_risk_level':
      return '/api/user/risk-level';
    case 'update_scan_interval':
      return '/api/user/scan-interval';
    case 'toggle_notifications':
      return '/api/user/notification-preferences';
    case 'update_position_size':
      return '/api/user/position-size';
    case 'update_loss_limit':
      return '/api/user/loss-limit';
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

/**
 * Format success message for user
 */
function formatSuccessMessage(command: SettingsCommand, value: any): string {
  switch (command) {
    case 'update_risk_level':
      return `✅ Risicoprofielen bijgewerkt naar: ${value}`;
    case 'update_scan_interval':
      return `✅ Marktscans ingesteld op: ${value}`;
    case 'update_strategy':
      return `✅ Strategie gewijzigd naar: ${value}`;
    case 'toggle_notifications':
      return `✅ Meldingen instellingen bijgewerkt`;
    case 'update_position_size':
      return `✅ Maximale positiegrootte ingesteld op: ${value}%`;
    case 'update_loss_limit':
      return `✅ Dagelijkse verliesbeperking ingesteld op: ${value}%`;
    default:
      return `✅ Instelling bijgewerkt`;
  }
}

/**
 * Build user-friendly description of setting change
 */
export function describeSettingChange(update: ChatSettingsUpdate): string {
  switch (update.command) {
    case 'update_risk_level': {
      const profile = update.parameters.riskProfile;
      return `Je risicoprofiel wijzigen naar ${profile}:\n` +
        `- Voorzichtig: 10% max per positie, conservatieve strategieën\n` +
        `- Gebalanceerd: 20% max per positie, gemengde benadering\n` +
        `- Actief: 35% max per positie, agressieve strategieën`;
    }
    case 'update_scan_interval': {
      const interval = update.parameters.marketScanInterval;
      return `Je marktscans ingesteld op: ${interval === 'manual' ? 'handmatig' : interval}`;
    }
    case 'update_strategy': {
      const strategy = update.parameters.strategy;
      return `Strategie wijzigen naar: ${strategy}`;
    }
    case 'toggle_notifications':
      return `Meldingen: ${update.parameters.emailOnAlert ? 'aan' : 'uit'}`;
    case 'update_position_size':
      return `Maximale positiegrootte: ${update.parameters.maxPositionSize}%`;
    case 'update_loss_limit':
      return `Dagelijkse verliesbeperking: ${update.parameters.dailyLossLimit}%`;
    default:
      return 'Instelling bijgewerkt';
  }
}
