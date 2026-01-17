/**
 * ROLE-BASED MESSAGE COMPONENT
 *
 * Displays tailored messaging for different restaurant roles
 * Helps users understand value proposition based on their role
 */

'use client';

type RestaurantRole = 'owner' | 'sommelier' | 'chef' | 'cfo' | 'general';

interface RoleMessage {
  role: RestaurantRole;
  icon: string;
  title: string;
  message: string;
}

const ROLE_MESSAGES: RoleMessage[] = [
  {
    role: 'owner',
    icon: '👔',
    title: 'För Ägare',
    message: 'Kontroll och snabbare inköp – mer tid till gästerna.',
  },
  {
    role: 'sommelier',
    icon: '🍷',
    title: 'För Sommelier',
    message: 'Matchning och tryggt vinval – rätt vin till varje rätt.',
  },
  {
    role: 'chef',
    icon: '👨‍🍳',
    title: 'För Kökschef',
    message: 'Rätt vin till menyn – perfekt pairing varje säsong.',
  },
  {
    role: 'cfo',
    icon: '💼',
    title: 'För Ekonomiansvarig',
    message: 'Spårbarhet och budgetkontroll – transparent prissättning.',
  },
];

interface RoleBasedMessageProps {
  variant?: 'horizontal' | 'vertical';
  compact?: boolean;
}

export function RoleBasedMessage({ variant = 'horizontal', compact = false }: RoleBasedMessageProps) {
  if (compact) {
    // Compact version - single line rotating messages
    return (
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        {ROLE_MESSAGES.map((msg) => (
          <div key={msg.role} className="flex items-center gap-2 whitespace-nowrap text-sm">
            <span className="text-lg">{msg.icon}</span>
            <span className="font-medium text-foreground">{msg.title}:</span>
            <span className="text-muted-foreground">{msg.message}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div className="space-y-3">
        {ROLE_MESSAGES.map((msg) => (
          <div key={msg.role} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <span className="text-2xl">{msg.icon}</span>
            <div>
              <div className="font-medium text-sm text-foreground mb-1">{msg.title}</div>
              <div className="text-xs text-muted-foreground">{msg.message}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Horizontal grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {ROLE_MESSAGES.map((msg) => (
        <div key={msg.role} className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-3xl mb-2">{msg.icon}</div>
          <div className="font-semibold text-sm text-foreground mb-1">{msg.title}</div>
          <div className="text-xs text-muted-foreground">{msg.message}</div>
        </div>
      ))}
    </div>
  );
}
