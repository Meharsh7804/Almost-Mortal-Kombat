import type {
  AIContext,
  AIIntent,
  AIPlannedAction,
  AIScoredAction,
  AITacticalSituation,
} from './AITypes';
import type { AIRandomSource } from './AIRandom';

interface Candidate {
  intent: AIIntent;
  label: string;
  base: number;
  valid: boolean;
  reason?: string;
}

export class AIDecisionEngine {
  decide(context: AIContext, random: AIRandomSource): { chosen: AIPlannedAction; scored: AIScoredAction[] } {
    const candidates = this.generate(context);
    const scored = candidates.map((candidate) => this.scoreCandidate(candidate, context));

    // Sort by score desc, stable-ish by label for deterministic tie handling before weighted pick.
    scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    const valid = scored.filter((entry) => entry.valid && Number.isFinite(entry.score));
    const fallback: AIScoredAction = {
      intent: 'IDLE',
      score: 0.1,
      label: 'idle-fallback',
      valid: true,
    };
    const pool = valid.length > 0 ? valid.slice(0, 6) : [fallback];

    const profile = context.profile.difficultyProfile;
    let chosenEntry = pool[0] ?? fallback;

    // Mistake probability: occasionally pick a weaker but valid option.
    if (pool.length > 1 && random.chance(profile.mistakeProbability)) {
      const weaker = pool.slice(1);
      chosenEntry = random.pick(weaker);
    } else if (pool.length > 1) {
      // Softmax-ish weighted pick among top options to avoid robotic repetition.
      const temperature = 0.22 + (1 - profile.spacingDiscipline) * 0.25;
      const max = pool[0]?.score ?? 0;
      const weights = pool.map((entry) => Math.exp((entry.score - max) / Math.max(0.05, temperature)));
      const total = weights.reduce((sum, w) => sum + w, 0);
      let roll = random.next() * (total || 1);
      for (let i = 0; i < pool.length; i += 1) {
        roll -= weights[i] ?? 0;
        if (roll <= 0) {
          chosenEntry = pool[i] ?? chosenEntry;
          break;
        }
      }
    }

    const commitmentFrames = this.commitmentFor(chosenEntry.intent, context);
    return {
      chosen: {
        intent: chosenEntry.intent,
        score: chosenEntry.score,
        commitmentFrames,
        label: chosenEntry.label,
        reason: this.reasonFor(chosenEntry.intent, context),
      },
      scored,
    };
  }

  determineSituation(context: AIContext): AITacticalSituation {
    const p = context.perception;
    if (!p.selfActionable || p.selfState === 'HITSTUN' || p.selfState === 'KNOCKDOWN' || p.selfState === 'BLOCKSTUN' || p.selfState === 'DODGING' || p.selfState === 'ATTACKING' || p.selfState === 'SPECIAL_ATTACK') {
      // While committed/recovering, controller should generally keep current action;
      // decision layer still reports recovery context for debug/reevaluation logic.
      if (p.selfActionable && p.selfCornered) {
        return 'CORNERED';
      }
      return 'AI_RECOVERY';
    }
    if (p.opponentAttack.active || p.opponentAttack.highThreat) {
      return 'OPPONENT_ATTACK';
    }
    if (p.opponentInRecovery) {
      return 'OPPONENT_RECOVERY';
    }
    if (p.selfCornered) {
      return 'CORNERED';
    }
    if (p.inLightRange || p.inHeavyRange || p.inSpecial1Range || p.inSpecial2Range || p.comboActive) {
      return 'OFFENSIVE_OPPORTUNITY';
    }
    if (p.absDistanceX > p.heavyRange + 30) {
      return 'APPROACHING';
    }
    return 'NEUTRAL';
  }

  private generate(context: AIContext): Candidate[] {
    const p = context.perception;
    const out: Candidate[] = [];
    const add = (intent: AIIntent, label: string, base: number, valid: boolean, reason?: string): void => {
      out.push({ intent, label, base, valid, reason });
    };

    // Universal fallback
    add('IDLE', 'idle', 0.15, true);

    // Recovery/commitment states: only allow compatible "hold/idle-like" intents.
    if (!p.selfActionable) {
      if (p.selfState === 'BLOCKSTUN' && p.opponentAttack.canBeBlocked) {
        add(
          p.opponentAttack.attack?.guardType === 'LOW' ? 'BLOCK_CROUCH' : 'BLOCK_STAND',
          'hold-block',
          0.9,
          true,
        );
      }
      return out;
    }

    // Movement feasibility: when cornered, advancing toward opponent drives
    // further into the corner; retreating is usually the escape route.
    const canMoveToward = !p.selfCornered;
    const canMoveAway = true;

    add('APPROACH', 'approach', p.absDistanceX > p.lightRange ? 0.7 : 0.2, canMoveToward && p.selfGrounded, 'path blocked');
    add('RETREAT', 'retreat', p.selfCornered ? 0.45 : 0.25, canMoveAway && p.selfGrounded, 'corner');
    add('WALK_FORWARD', 'walk-forward', 0.35, canMoveToward && p.selfGrounded);
    add('WALK_BACKWARD', 'walk-backward', 0.3, canMoveAway && p.selfGrounded);
    add('REPOSITION', 'reposition', 0.28, canMoveAway && p.selfGrounded);
    add('BAIT', 'bait', 0.22, p.selfGrounded && canMoveAway && canMoveToward);
    add('CROUCH', 'crouch', 0.12, p.selfGrounded);
    add('JUMP', 'jump', 0.08, p.selfCanJump && p.absDistanceX > 220, 'jump unavailable');

    // Attacks
    add('LIGHT_ATTACK', 'light', p.inLightRange ? 0.7 : 0.15, p.selfCanLight);
    add('HEAVY_ATTACK', 'heavy', p.inHeavyRange ? 0.62 : 0.12, p.selfCanHeavy);
    add('CROUCH_LIGHT_ATTACK', 'low-light', p.inCrouchLightRange ? 0.58 : 0.1, p.selfCanCrouchLight && p.selfGrounded);

    add(
      'SPECIAL_1',
      'special-1',
      p.inSpecial1Range ? 0.55 : 0.18,
      p.selfCanSpecial1,
      'special unavailable',
    );
    add(
      'SPECIAL_2',
      'special-2',
      p.inSpecial2Range ? 0.55 : 0.18,
      p.selfCanSpecial2,
      'special unavailable',
    );

    // Anti-air
    if (p.opponentAirborne) {
      add('ANTI_AIR_LIGHT', 'anti-air-light', p.inLightRange ? 0.5 : 0.2, p.selfCanLight && p.selfGrounded);
      add('ANTI_AIR_HEAVY', 'anti-air-heavy', p.inHeavyRange ? 0.55 : 0.22, p.selfCanHeavy && p.selfGrounded);
    }

    // Defense vs threats
    if (p.opponentAttack.active || p.opponentAttack.highThreat) {
      const crouchGuard = p.opponentAttack.attack?.guardType === 'LOW';
      add(crouchGuard ? 'BLOCK_CROUCH' : 'BLOCK_STAND', 'block', p.opponentAttack.canBeBlocked ? 0.8 : 0, p.opponentAttack.canBeBlocked);
      add(
        crouchGuard ? 'PERFECT_GUARD_CROUCH' : 'PERFECT_GUARD_STAND',
        'perfect-guard-attempt',
        p.opponentAttack.canBeBlocked && p.opponentAttack.framesUntilImpactEstimate <= 8 ? 0.5 : 0.05,
        p.opponentAttack.canBeBlocked && p.selfGrounded,
      );
      add('DODGE_BACKWARD', 'dodge-back', p.selfCanDodge ? 0.62 : 0, p.selfCanDodge);
      add('DODGE_FORWARD', 'dodge-forward', p.selfCanDodge && canMoveToward ? 0.45 : 0, p.selfCanDodge && canMoveToward);
    }

    // Punish
    if (p.opponentInRecovery) {
      add('PUNISH_LIGHT', 'punish-light', p.inLightRange ? 0.82 : 0.25, p.selfCanLight && p.inLightRange);
      add('PUNISH_HEAVY', 'punish-heavy', p.inHeavyRange && p.opponentRecoveryFramesEstimate >= 14 ? 0.88 : 0.18, p.selfCanHeavy && p.inHeavyRange);
      const specialPunish = p.selfCanSpecial1 && p.inSpecial1Range ? 'SPECIAL_1' : p.selfCanSpecial2 && p.inSpecial2Range ? 'SPECIAL_2' : null;
      if (specialPunish) {
        add(
          specialPunish === 'SPECIAL_1' ? 'PUNISH_SPECIAL' : 'SPECIAL_2',
          'punish-special',
          p.opponentRecoveryFramesEstimate >= 12 ? 0.86 : 0.2,
          true,
        );
      }
    }

    // Combo continuation (only if current attack is cancelable per frame data contact handled in combat; here we be conservative)
    if ((p.selfState === 'ATTACKING' || p.selfState === 'SPECIAL_ATTACK') && p.comboActive) {
      // Continuation intents are only meaningful if combat allows; engine gates actual cancels.
      add('COMBO_CONTINUE_LIGHT', 'combo-light', 0.35, p.selfCanLight);
      add('COMBO_CONTINUE_HEAVY', 'combo-heavy', 0.38, p.selfCanHeavy);
      add('COMBO_CONTINUE_SPECIAL', 'combo-special', 0.4, p.selfCanSpecial1 || p.selfCanSpecial2);
    }

    return out;
  }

  private scoreCandidate(candidate: Candidate, context: AIContext): AIScoredAction {
    if (!candidate.valid) {
      return { intent: candidate.intent, score: -Infinity, label: candidate.label, valid: false, reason: candidate.reason };
    }

    const p = context.perception;
    const d = context.profile.difficultyProfile;
    const pers = context.profile.personalityProfile;
    const adapt = context.adaptation;
    let score = candidate.base;

    const inGoodRange = p.inLightRange || p.inHeavyRange;
    const tooFar = p.absDistanceX > p.heavyRange + 40;
    const tooClose = p.absDistanceX < 58 && p.selfGrounded;

    // Tactical/situational weighting
    switch (candidate.intent) {
      case 'APPROACH':
      case 'WALK_FORWARD':
        score += (tooFar ? 0.55 : 0.1) * d.spacingWeight * pers.spacingBias;
        score += adapt.pressureBias;
        if (p.selfCornered) score -= 0.3;
        break;
      case 'RETREAT':
      case 'WALK_BACKWARD':
      case 'REPOSITION':
        score += (tooClose ? 0.4 : 0.12) * pers.spacingBias;
        score += (p.selfCornered ? 0.5 : 0) * pers.defenseBias;
        score += p.opponentAttack.active ? 0.2 * d.defenseWeight : 0;
        break;
      case 'BAIT':
        score += 0.2 * d.spacingWeight * pers.repositionBias * (0.4 + d.predictionStrength);
        if (tooFar) score -= 0.25;
        break;
      case 'JUMP':
        score += (0.08 + d.predictionStrength * 0.12) * pers.jumpBias;
        score -= adapt.antiJumpBias * 1.2; // avoid becoming predictable when adapted against jumps? inverse: if player jumps a lot we shouldn't jump more; anti-air bias handled elsewhere
        score -= p.opponentAttack.active ? 0.3 : 0;
        if (p.opponentGrounded) score -= 0.15;
        break;
      case 'LIGHT_ATTACK':
      case 'ANTI_AIR_LIGHT':
      case 'PUNISH_LIGHT':
      case 'COMBO_CONTINUE_LIGHT':
        score += (inGoodRange ? 0.35 : -0.05) * d.aggression * pers.lightBias;
        score += p.inLightRange ? 0.2 : -0.2;
        if (candidate.intent === 'PUNISH_LIGHT') score += 0.35 * d.punishWeight;
        if (candidate.intent === 'ANTI_AIR_LIGHT') score += 0.3 * d.antiAirAwareness + adapt.antiJumpBias;
        if (candidate.intent === 'COMBO_CONTINUE_LIGHT') score += 0.25 * d.comboConfidence;
        break;
      case 'HEAVY_ATTACK':
      case 'ANTI_AIR_HEAVY':
      case 'PUNISH_HEAVY':
      case 'COMBO_CONTINUE_HEAVY':
        score += (p.inHeavyRange ? 0.4 : -0.1) * d.aggression * pers.heavyBias;
        score += p.opponentInRecovery ? 0.25 * d.punishWeight : 0;
        score -= p.opponentAttack.active ? 0.25 : 0;
        if (candidate.intent === 'ANTI_AIR_HEAVY') score += 0.28 * d.antiAirAwareness + adapt.antiJumpBias;
        if (candidate.intent === 'COMBO_CONTINUE_HEAVY') score += 0.22 * d.comboConfidence;
        break;
      case 'SPECIAL_1':
      case 'SPECIAL_2':
      case 'PUNISH_SPECIAL':
      case 'COMBO_CONTINUE_SPECIAL':
        score += 0.25 * pers.specialBias;
        score += (p.selfEnergy >= 50 ? 0.18 : 0.05) * (1 - d.specialUsageThreshold + 0.4);
        if (p.inSpecial1Range || p.inSpecial2Range) score += 0.18;
        if (p.opponentInRecovery) score += 0.22 * d.punishWeight;
        if (candidate.intent === 'COMBO_CONTINUE_SPECIAL') score += 0.2 * d.comboConfidence;
        score -= p.opponentBlocking && p.absDistanceX < 90 ? 0.08 : 0;
        break;
      case 'CROUCH_LIGHT_ATTACK':
        score += p.inCrouchLightRange ? 0.25 * pers.lightBias : -0.05;
        score += p.opponentBlocking ? 0.05 : 0;
        break;
      case 'BLOCK_STAND':
      case 'BLOCK_CROUCH':
        score += 0.55 * d.defenseWeight * pers.defenseBias;
        score += p.opponentAttack.highThreat ? 0.25 : 0.1;
        score += adapt.antiHeavyBias * 0.4;
        score *= d.blockProbability + 0.35;
        break;
      case 'PERFECT_GUARD_STAND':
      case 'PERFECT_GUARD_CROUCH':
        score += 0.2 * d.defenseWeight * pers.defenseBias;
        score += d.perfectGuardProbability * 1.8;
        score += p.opponentAttack.framesUntilImpactEstimate <= 5 ? 0.15 : -0.1;
        score -= 0.2; // inherently risky attempt
        break;
      case 'DODGE_FORWARD':
      case 'DODGE_BACKWARD':
        score += 0.45 * d.defenseWeight * pers.dodgeBias;
        score += p.opponentAttack.highThreat ? 0.2 : 0.05;
        score += adapt.antiHeavyBias * 0.3;
        score *= d.dodgeProbability + 0.4;
        if (candidate.intent === 'DODGE_FORWARD') score += pers.riskBias * 0.08 - (p.selfCornered ? 0.2 : 0);
        if (candidate.intent === 'DODGE_BACKWARD') score += p.selfCornered ? -0.25 : 0.08;
        break;
      case 'CROUCH':
        score += 0.05;
        if (p.opponentAttack.attack?.guardType === 'HIGH') score += 0.15;
        break;
      case 'IDLE':
        score += 0.08 + (1 - d.aggression) * 0.08;
        if (p.opponentInRecovery || p.inLightRange) score -= 0.08;
        break;
    }

    // Adaptation-driven adjustments (bounded, based only on observed tendencies)
    if (p.opponentAirborne && (candidate.intent.startsWith('ANTI_AIR') || candidate.intent === 'LIGHT_ATTACK' || candidate.intent === 'HEAVY_ATTACK')) {
      score += adapt.antiJumpBias;
    }
    if (p.opponentBlocking && (candidate.intent === 'REPOSITION' || candidate.intent === 'BAIT' || candidate.intent === 'APPROACH')) {
      score += adapt.antiBlockBias * 0.5;
    }
    if ((candidate.intent === 'BLOCK_STAND' || candidate.intent === 'BLOCK_CROUCH' || candidate.intent === 'DODGE_BACKWARD') && adapt.antiHeavyBias > 0) {
      score += adapt.antiHeavyBias * 0.4;
    }
    if (adapt.repeatedStarterRate > 0.25 && (candidate.intent.startsWith('BLOCK') || candidate.intent.startsWith('PERFECT_GUARD') || candidate.intent.startsWith('DODGE'))) {
      score += adapt.patternBreakBias * 0.35;
    }

    // Corner caution
    if (p.selfCornered && (candidate.intent === 'RETREAT' || candidate.intent === 'DODGE_BACKWARD')) {
      score -= 0.35;
    }
    if (p.selfCornered && (candidate.intent === 'DODGE_FORWARD' || candidate.intent === 'APPROACH')) {
      score += 0.12 * pers.riskBias;
    }

    // Risk shaping
    score *= 0.85 + pers.riskBias * 0.15;
    score = Math.max(-5, Math.min(5, score));

    return {
      intent: candidate.intent,
      score,
      label: candidate.label,
      valid: true,
    };
  }

  private commitmentFor(intent: AIIntent, context: AIContext): number {
    const d = context.profile.difficultyProfile;
    const base = d.actionCommitmentFrames;
    switch (intent) {
      case 'IDLE':
        return Math.max(d.minimumActionFrames, Math.round(base * 0.7));
      case 'APPROACH':
      case 'RETREAT':
      case 'WALK_FORWARD':
      case 'WALK_BACKWARD':
      case 'REPOSITION':
      case 'BAIT':
      case 'CROUCH':
        return Math.max(d.minimumActionFrames, base);
      case 'BLOCK_STAND':
      case 'BLOCK_CROUCH':
      case 'PERFECT_GUARD_STAND':
      case 'PERFECT_GUARD_CROUCH':
        return Math.max(d.minimumActionFrames, Math.round(base * 0.9));
      case 'JUMP':
        return Math.max(d.minimumActionFrames, 6);
      case 'DODGE_FORWARD':
      case 'DODGE_BACKWARD':
        return Math.max(d.minimumActionFrames, context.perception.selfGrounded ? 8 : base);
      case 'LIGHT_ATTACK':
      case 'CROUCH_LIGHT_ATTACK':
      case 'HEAVY_ATTACK':
      case 'SPECIAL_1':
      case 'SPECIAL_2':
      case 'PUNISH_LIGHT':
      case 'PUNISH_HEAVY':
      case 'PUNISH_SPECIAL':
      case 'COMBO_CONTINUE_LIGHT':
      case 'COMBO_CONTINUE_HEAVY':
      case 'COMBO_CONTINUE_SPECIAL':
      case 'ANTI_AIR_LIGHT':
      case 'ANTI_AIR_HEAVY':
        return Math.max(d.minimumActionFrames, Math.round(base * 0.8));
    }
  }

  private reasonFor(intent: AIIntent, context: AIContext): string {
    const s = context.situation;
    switch (intent) {
      case 'APPROACH':
      case 'WALK_FORWARD':
        return s === 'APPROACHING' ? 'close distance' : 'advance';
      case 'RETREAT':
      case 'WALK_BACKWARD':
      case 'REPOSITION':
        return context.perception.selfCornered ? 'escape corner pressure' : 'adjust spacing';
      case 'BLOCK_STAND':
      case 'BLOCK_CROUCH':
        return 'defend incoming threat';
      case 'PERFECT_GUARD_STAND':
      case 'PERFECT_GUARD_CROUCH':
        return 'attempt timed guard';
      case 'DODGE_FORWARD':
      case 'DODGE_BACKWARD':
        return 'evade threat';
      case 'LIGHT_ATTACK':
      case 'HEAVY_ATTACK':
      case 'SPECIAL_1':
      case 'SPECIAL_2':
      case 'CROUCH_LIGHT_ATTACK':
        return s === 'OFFENSIVE_OPPORTUNITY' ? 'take opening' : 'pressure/spacing attack';
      case 'PUNISH_LIGHT':
      case 'PUNISH_HEAVY':
      case 'PUNISH_SPECIAL':
        return 'punish recovery';
      case 'COMBO_CONTINUE_LIGHT':
      case 'COMBO_CONTINUE_HEAVY':
      case 'COMBO_CONTINUE_SPECIAL':
        return 'continue combo route';
      case 'ANTI_AIR_LIGHT':
      case 'ANTI_AIR_HEAVY':
        return 'anti-air response';
      case 'BAIT':
        return 'bait commitment';
      case 'JUMP':
        return 'reposition/jump option';
      case 'CROUCH':
        return 'low profile/guard ready';
      case 'IDLE':
        return 'hold position';
    }
  }
}

export function isAttackIntent(intent: AIIntent): boolean {
  return (
    intent === 'LIGHT_ATTACK' ||
    intent === 'HEAVY_ATTACK' ||
    intent === 'SPECIAL_1' ||
    intent === 'SPECIAL_2' ||
    intent === 'CROUCH_LIGHT_ATTACK' ||
    intent === 'PUNISH_LIGHT' ||
    intent === 'PUNISH_HEAVY' ||
    intent === 'PUNISH_SPECIAL' ||
    intent === 'COMBO_CONTINUE_LIGHT' ||
    intent === 'COMBO_CONTINUE_HEAVY' ||
    intent === 'COMBO_CONTINUE_SPECIAL' ||
    intent === 'ANTI_AIR_LIGHT' ||
    intent === 'ANTI_AIR_HEAVY'
  );
}

export function intentUsesSpecial(intent: AIIntent): boolean {
  return (
    intent === 'SPECIAL_1' ||
    intent === 'SPECIAL_2' ||
    intent === 'PUNISH_SPECIAL' ||
    intent === 'COMBO_CONTINUE_SPECIAL'
  );
}
