import type { CombatEvent } from '../combat/CombatEvents';

export interface PlayerMatchStats {
  damageDealt: number;
  damageReceived: number;
  hitsLanded: number;
  hitsBlockedByOpponent: number;
  combos: number;
  highestCombo: number;
  comboDamage: number;
  highestComboDamage: number;
  perfectGuards: number;
  dodges: number;
  specialsUsed: number;
  roundsWon: number;
}

export interface MatchStatisticsSnapshot {
  readonly players: readonly [PlayerMatchStats, PlayerMatchStats];
  readonly totalRounds: number;
  readonly durationSeconds: number;
}

function createPlayerStats(): PlayerMatchStats {
  return {
    damageDealt: 0,
    damageReceived: 0,
    hitsLanded: 0,
    hitsBlockedByOpponent: 0,
    combos: 0,
    highestCombo: 0,
    comboDamage: 0,
    highestComboDamage: 0,
    perfectGuards: 0,
    dodges: 0,
    specialsUsed: 0,
    roundsWon: 0,
  };
}

export class MatchStatisticsTracker {
  private readonly byRuntimeId = new Map<string, 1 | 2>();
  private readonly stats: [PlayerMatchStats, PlayerMatchStats] = [createPlayerStats(), createPlayerStats()];
  private readonly comboDamageByPair = new Map<string, number>();
  private durationFrames = 0;
  private roundCount = 0;

  registerFighter(runtimeId: string, playerNumber: 1 | 2): void {
    this.byRuntimeId.set(runtimeId, playerNumber);
  }

  reset(): void {
    this.stats[0] = createPlayerStats();
    this.stats[1] = createPlayerStats();
    this.comboDamageByPair.clear();
    this.durationFrames = 0;
    this.roundCount = 0;
  }

  tick(): void {
    this.durationFrames += 1;
  }

  onRoundStart(): void {
    this.roundCount += 1;
  }

  onRoundEnd(winnerPlayer: 1 | 2 | null): void {
    if (winnerPlayer) {
      this.stats[winnerPlayer - 1]!.roundsWon += 1;
    }
  }

  onCombatEvents(events: readonly CombatEvent[]): void {
    for (const event of events) {
      this.handleEvent(event);
    }
  }

  getSnapshot(): MatchStatisticsSnapshot {
    return {
      players: [
        { ...this.stats[0]! },
        { ...this.stats[1]! },
      ],
      totalRounds: this.roundCount,
      durationSeconds: this.durationFrames / 60,
    };
  }

  private handleEvent(event: CombatEvent): void {
    switch (event.type) {
      case 'ATTACK_CONNECTED': {
        const attacker = this.resolveById(event.attackerId);
        const victim = this.resolveById(event.victimId);
        if (attacker) {
          const s = this.stats[attacker - 1]!;
          s.hitsLanded += 1;
          s.damageDealt += event.damage;
          s.highestCombo = Math.max(s.highestCombo, event.comboHits);
          const key = `${event.attackerId}::${event.victimId}`;
          const current = (this.comboDamageByPair.get(key) ?? 0) + event.damage;
          this.comboDamageByPair.set(key, current);
          s.comboDamage = Math.max(s.comboDamage, current);
          s.highestComboDamage = Math.max(s.highestComboDamage, current);
        }
        if (victim) {
          this.stats[victim - 1]!.damageReceived += event.damage;
        }
        break;
      }
      case 'ATTACK_BLOCKED': {
        const attacker = this.resolveById(event.attackerId);
        const victim = this.resolveById(event.victimId);
        if (attacker) {
          const s = this.stats[attacker - 1]!;
          s.hitsBlockedByOpponent += 1;
          s.damageDealt += event.chipDamage;
        }
        if (victim) {
          this.stats[victim - 1]!.damageReceived += event.chipDamage;
        }
        if (event.perfect && victim) {
          this.stats[victim - 1]!.perfectGuards += 1;
        }
        break;
      }
      case 'PERFECT_GUARD': {
        const player = event.playerNumber ?? this.resolveById(event.fighterId);
        if (player) {
          const s = this.stats[player - 1]!;
          s.perfectGuards = Math.max(s.perfectGuards, 1);
        }
        break;
      }
      case 'COMBO_STARTED': {
        const attacker = this.resolveById(event.attackerId);
        if (attacker) {
          const s = this.stats[attacker - 1]!;
          s.combos += 1;
          s.highestCombo = Math.max(s.highestCombo, event.hits);
          const key = `${event.attackerId}::${event.victimId}`;
          this.comboDamageByPair.set(key, event.damage);
          s.comboDamage = Math.max(s.comboDamage, event.damage);
          s.highestComboDamage = Math.max(s.highestComboDamage, event.damage);
        }
        break;
      }
      case 'COMBO_UPDATED': {
        const attacker = this.resolveById(event.attackerId);
        if (attacker) {
          const s = this.stats[attacker - 1]!;
          s.highestCombo = Math.max(s.highestCombo, event.hits);
          const key = `${event.attackerId}::${event.victimId}`;
          this.comboDamageByPair.set(key, event.damage);
          s.comboDamage = Math.max(s.comboDamage, event.damage);
          s.highestComboDamage = Math.max(s.highestComboDamage, event.damage);
        }
        break;
      }
      case 'COMBO_ENDED': {
        this.comboDamageByPair.delete(`${event.attackerId}::${event.victimId}`);
        break;
      }
      case 'DODGE_STARTED': {
        const player = event.playerNumber ?? this.resolveById(event.fighterId);
        if (player) {
          this.stats[player - 1]!.dodges += 1;
        }
        break;
      }
      case 'SPECIAL_ATTACK_USED': {
        const player = event.playerNumber ?? this.resolveById(event.fighterId);
        if (player) {
          this.stats[player - 1]!.specialsUsed += 1;
        }
        break;
      }
      default:
        break;
    }
  }

  private resolveById(runtimeId: string): 1 | 2 | null {
    return this.byRuntimeId.get(runtimeId) ?? null;
  }
}
