import {
  advanceAttack,
  createActiveAttack,
  getAttackPhase,
  getAttackPhaseProgress,
  getAttackProgress,
  getCancelWindow,
  hasContact,
  type ActiveAttack,
} from '../combat/AttackSystem';
import { DEFAULT_COMBAT_TUNING, type CombatTuning } from '../combat/CombatConfig';
import type { CombatEvent } from '../combat/CombatEvents';
import type { AttackDefinition, AttackPhase } from '../combat/FrameData';
import { InputBuffer, type BufferedDirection, type BufferedInput } from '../combat/InputBuffer';
import type { ArenaBounds } from '../data/ArenaConfig';
import { DEFAULT_ENERGY_RULES, EnergySystem, type EnergyRules } from '../systems/EnergySystem';
import { boxFromCenterBottom, type AABB } from '../utils/CollisionUtils';
import { FighterStateMachine, type FighterState } from './FighterStateMachine';

export type PlayerNumber = 1 | 2;

/** +1 faces right, -1 faces left. */
export type FacingDirection = 1 | -1;

export interface FighterHurtboxConfig {
  readonly standingWidth: number;
  readonly standingHeight: number;
  readonly crouchingWidth: number;
  readonly crouchingHeight: number;
}

export interface FighterConfig {
  readonly id: string;
  readonly name: string;
  readonly playerNumber: PlayerNumber;
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly accentColor: number;
  readonly maxHealth: number;
  readonly movementSpeed: number;
  readonly jumpForce: number;
  readonly gravity: number;
  readonly acceleration: number;
  readonly deceleration: number;
  readonly airAcceleration: number;
  readonly airDeceleration: number;
  readonly pushboxWidth: number;
  readonly hurtbox: FighterHurtboxConfig;
  readonly canAttackAirborne: boolean;
  readonly lightAttack: AttackDefinition;
  readonly heavyAttack: AttackDefinition;
  readonly crouchingLightAttack: AttackDefinition;
  readonly specialAttacks: readonly [AttackDefinition, AttackDefinition];
  readonly energyRules?: EnergyRules;
  readonly combatTuning?: CombatTuning;
}

export interface FighterControls {
  readonly moveLeft: boolean;
  readonly moveRight: boolean;
  readonly crouch: boolean;
  readonly jumpPressed: boolean;
  readonly lightPressed: boolean;
  readonly heavyPressed: boolean;
  readonly block?: boolean;
  readonly blockPressed?: boolean;
  readonly special1Pressed?: boolean;
  readonly special2Pressed?: boolean;
  readonly dodgePressed?: boolean;
}

export const NEUTRAL_CONTROLS: FighterControls = Object.freeze({
  moveLeft: false,
  moveRight: false,
  crouch: false,
  jumpPressed: false,
  lightPressed: false,
  heavyPressed: false,
  block: false,
  blockPressed: false,
  special1Pressed: false,
  special2Pressed: false,
  dodgePressed: false,
});

export interface FighterAttackView {
  readonly definition: AttackDefinition;
  readonly phase: AttackPhase;
  readonly phaseProgress: number;
  readonly overallProgress: number;
}

/**
 * Pure simulation entity. Rendering lives in FighterView; this class owns
 * movement, gravity, health, attack timing and the validated state machine, so
 * gameplay rules can be unit tested without Phaser.
 */
export class Fighter {
  readonly id: string;
  readonly name: string;
  readonly playerNumber: PlayerNumber;
  readonly config: FighterConfig;
  readonly tuning: CombatTuning;

  x: number;
  y: number;

  private facingDirection: FacingDirection = 1;
  private currentHealth: number;
  private readonly stateMachine = new FighterStateMachine();
  private readonly energySystem: EnergySystem;
  private readonly inputBuffer: InputBuffer;
  private readonly attackCooldowns = new Map<string, number>();
  private readonly pendingEvents: CombatEvent[] = [];
  private readonly cancelChainCounts = new Map<string, number>();
  private currentAttack: ActiveAttack | null = null;
  private movementVelocityX = 0;
  private movementVelocityY = 0;
  private moveDirection: -1 | 0 | 1 = 0;
  private crouchHeld = false;
  private blockHeld = false;
  private blockCrouching = false;
  private blockStartedFrame = -1;
  private blockWindowAvailable = false;
  private blockPressPending = false;
  private stateTimerDuration = 0;
  private groundedFlag = true;
  private simulationFrame = 0;
  private dodgeCooldownRemaining = 0;
  private dodgeDirection: FacingDirection = 1;
  private cancelChainDepth = 0;

  constructor(config: FighterConfig) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.playerNumber = config.playerNumber;
    this.x = config.x;
    this.y = config.y;
    this.currentHealth = config.maxHealth;
    this.tuning = config.combatTuning ?? DEFAULT_COMBAT_TUNING;
    this.energySystem = new EnergySystem(config.energyRules ?? DEFAULT_ENERGY_RULES);
    this.inputBuffer = new InputBuffer(this.tuning.inputBufferFrames);
  }

  get state(): FighterState {
    return this.stateMachine.current;
  }

  get facing(): FacingDirection {
    return this.facingDirection;
  }

  get health(): number {
    return this.currentHealth;
  }

  get maxHealth(): number {
    return this.config.maxHealth;
  }

  get energy(): number {
    return this.energySystem.current;
  }

  get maxEnergy(): number {
    return this.energySystem.max;
  }

  get energyRatio(): number {
    return this.energySystem.ratio;
  }

  get energyRules(): EnergyRules {
    return this.energySystem.rules;
  }

  get velocityX(): number {
    return this.movementVelocityX;
  }

  get velocityY(): number {
    return this.movementVelocityY;
  }

  get grounded(): boolean {
    return this.groundedFlag;
  }

  get activeAttack(): ActiveAttack | null {
    return this.currentAttack;
  }

  get stateRemainingFrames(): number {
    return this.stateMachine.remainingFrames;
  }

  get stateDurationFrames(): number {
    return this.stateTimerDuration;
  }

  get stateFramesElapsed(): number {
    return this.stateMachine.framesInState;
  }

  get simulationTick(): number {
    return this.simulationFrame;
  }

  get isDefeated(): boolean {
    return this.stateMachine.current === 'DEFEATED';
  }

  get isActionable(): boolean {
    return this.stateMachine.isActionable;
  }

  get isBlocking(): boolean {
    return this.stateMachine.current === 'BLOCKING';
  }

  get isBlockstunned(): boolean {
    return this.stateMachine.current === 'BLOCKSTUN';
  }

  get isHoldingBlock(): boolean {
    return this.blockHeld;
  }

  get isCrouchBlocking(): boolean {
    return (
      (this.stateMachine.current === 'BLOCKING' || this.stateMachine.current === 'BLOCKSTUN') &&
      this.blockCrouching
    );
  }

  get isDodging(): boolean {
    return this.stateMachine.current === 'DODGING';
  }

  get isInvulnerable(): boolean {
    return (
      this.stateMachine.current === 'DODGING' &&
      this.stateMachine.framesInState <= this.tuning.dodge.invulnerabilityFrames
    );
  }

  get dodgeCooldown(): number {
    return this.dodgeCooldownRemaining;
  }

  get dodgeCooldownMax(): number {
    return this.tuning.dodge.cooldownFrames;
  }

  get currentDodgeDirection(): FacingDirection {
    return this.dodgeDirection;
  }

  get bufferedInputs(): readonly BufferedInput[] {
    return this.inputBuffer.items;
  }

  setFacing(direction: FacingDirection): void {
    this.facingDirection = direction;
  }

  faceTowards(targetX: number): void {
    if (targetX > this.x) {
      this.facingDirection = 1;
    } else if (targetX < this.x) {
      this.facingDirection = -1;
    }
  }

  isFacingPosition(x: number): boolean {
    if (x === this.x) {
      return true;
    }
    return x > this.x ? this.facingDirection === 1 : this.facingDirection === -1;
  }

  setHorizontalPosition(x: number): void {
    this.x = x;
  }

  gainEnergy(amount: number): number {
    return this.energySystem.gain(amount);
  }

  spendEnergy(amount: number): boolean {
    return this.energySystem.spend(amount);
  }

  drainEvents(target: CombatEvent[]): void {
    for (const event of this.pendingEvents) {
      target.push(event);
    }
    this.pendingEvents.length = 0;
  }

  clearInput(): void {
    this.moveDirection = 0;
    this.crouchHeld = false;
    this.blockHeld = false;
    this.blockPressPending = false;
  }

  bufferControls(controls: FighterControls): void {
    if (this.isDefeated) {
      return;
    }

    this.enqueuePressedActions(controls);
    this.inputBuffer.prune(this.simulationFrame);
  }

  applyControls(controls: FighterControls): void {
    this.moveDirection = ((controls.moveLeft ? -1 : 0) + (controls.moveRight ? 1 : 0)) as
      -1 | 0 | 1;
    this.crouchHeld = controls.crouch;
    this.blockHeld = controls.block === true;

    if (controls.blockPressed === true) {
      this.blockPressPending = true;
    }

    if (this.isDefeated) {
      this.moveDirection = 0;
      this.crouchHeld = false;
      this.blockHeld = false;
      return;
    }

    this.enqueuePressedActions(controls);
    this.inputBuffer.prune(this.simulationFrame);
    this.tryBufferedActions();
    this.updateBlockState();
  }

  tryJump(): boolean {
    if (!this.groundedFlag || !this.stateMachine.isActionable || this.isDefeated) {
      return false;
    }

    if (!this.stateMachine.transition('JUMPING')) {
      return false;
    }

    this.stateTimerDuration = 0;
    this.movementVelocityY = -this.config.jumpForce;
    this.groundedFlag = false;
    return true;
  }

  tryDodge(direction: -1 | 0 | 1 = 0): boolean {
    if (
      this.isDefeated ||
      !this.groundedFlag ||
      !this.stateMachine.isActionable ||
      this.dodgeCooldownRemaining > 0
    ) {
      return false;
    }

    const dodgeTuning = this.tuning.dodge;
    if (!this.energySystem.canSpend(dodgeTuning.energyCost)) {
      return false;
    }

    if (!this.stateMachine.transition('DODGING', dodgeTuning.durationFrames)) {
      return false;
    }

    this.energySystem.spend(dodgeTuning.energyCost);
    this.dodgeDirection = direction === 0 ? (-this.facingDirection as FacingDirection) : direction;
    this.movementVelocityX = this.dodgeDirection * dodgeTuning.speed;
    this.dodgeCooldownRemaining = dodgeTuning.cooldownFrames;
    this.stateTimerDuration = dodgeTuning.durationFrames;
    this.resetCancelChain();
    this.blockPressPending = false;
    this.blockWindowAvailable = false;

    this.pendingEvents.push({
      type: 'DODGE_STARTED',
      fighterId: this.id,
      playerNumber: this.playerNumber,
      direction: this.dodgeDirection,
    });

    return true;
  }

  tryStartAttack(definition: AttackDefinition): boolean {
    if (this.isDefeated) {
      return false;
    }

    const existing = this.currentAttack;
    const state = this.stateMachine.current;
    const isCancel = existing !== null;

    if (!this.groundedFlag && !(definition.airborne && this.config.canAttackAirborne)) {
      return false;
    }

    if (isCancel) {
      if (state !== 'ATTACKING' && state !== 'SPECIAL_ATTACK') {
        return false;
      }
      if (!this.isValidCancel(existing, definition)) {
        return false;
      }
    } else {
      if (!this.stateMachine.isActionable && state !== 'BLOCKING') {
        return false;
      }
    }

    if (!this.energySystem.canSpend(definition.energyCost)) {
      return false;
    }

    if (this.getAttackCooldown(definition.id) > 0) {
      return false;
    }

    const targetState: FighterState =
      definition.category === 'SPECIAL' || definition.category === 'ULTIMATE'
        ? 'SPECIAL_ATTACK'
        : 'ATTACKING';

    if (!this.stateMachine.canTransitionTo(targetState)) {
      return false;
    }

    if (isCancel) {
      this.cancelChainDepth += 1;
      this.cancelChainCounts.set(
        definition.id,
        (this.cancelChainCounts.get(definition.id) ?? 0) + 1,
      );
    } else {
      this.resetCancelChain();
      this.cancelChainCounts.set(definition.id, 1);
    }

    this.stateMachine.transition(targetState);
    this.energySystem.spend(definition.energyCost);
    this.currentAttack = createActiveAttack(definition);
    this.stateTimerDuration = 0;
    this.blockPressPending = false;
    this.blockWindowAvailable = false;

    if (definition.cooldownFrames > 0) {
      this.attackCooldowns.set(definition.id, definition.cooldownFrames);
    }

    if (this.groundedFlag) {
      this.movementVelocityX = 0;
    }

    const special = definition.category === 'SPECIAL' || definition.category === 'ULTIMATE';
    this.pendingEvents.push({
      type: 'ATTACK_STARTED',
      attackerId: this.id,
      playerNumber: this.playerNumber,
      attackId: definition.id,
      attackName: definition.name,
      category: definition.category,
      special,
    });

    if (special) {
      this.pendingEvents.push({
        type: 'SPECIAL_ATTACK_USED',
        fighterId: this.id,
        playerNumber: this.playerNumber,
        attackId: definition.id,
        attackName: definition.name,
      });
    }

    return true;
  }

  /** Advances the active attack one fixed tick. Called by the combat engine. */
  tickAttack(): AttackPhase | null {
    if (!this.currentAttack) {
      return null;
    }

    const phase = advanceAttack(this.currentAttack);
    if (phase === 'COMPLETE') {
      this.finishAttack();
      return null;
    }

    return phase;
  }

  getAttackPhase(): AttackPhase | null {
    return this.currentAttack ? getAttackPhase(this.currentAttack) : null;
  }

  getAttackView(): FighterAttackView | null {
    if (!this.currentAttack) {
      return null;
    }

    return {
      definition: this.currentAttack.definition,
      phase: getAttackPhase(this.currentAttack),
      phaseProgress: getAttackPhaseProgress(this.currentAttack),
      overallProgress: getAttackProgress(this.currentAttack),
    };
  }

  cancelAttack(): void {
    if (this.currentAttack) {
      this.currentAttack = null;
    }

    this.resetCancelChain();

    if (
      this.stateMachine.current === 'ATTACKING' ||
      this.stateMachine.current === 'SPECIAL_ATTACK'
    ) {
      this.stateMachine.transition(this.groundedFlag ? 'IDLE' : 'FALLING');
    }
  }

  enterHitstun(frames: number): void {
    if (this.isDefeated) {
      return;
    }

    this.cancelAttack();
    this.clearInput();
    this.blockWindowAvailable = false;

    if (this.stateMachine.transition('HITSTUN', frames)) {
      this.stateTimerDuration = Math.max(0, Math.floor(frames));
      this.blockCrouching = false;
    }
  }

  enterKnockdown(frames: number): void {
    if (this.isDefeated) {
      return;
    }

    this.cancelAttack();
    this.clearInput();
    this.blockWindowAvailable = false;

    if (this.stateMachine.transition('KNOCKDOWN', frames)) {
      this.stateTimerDuration = Math.max(0, Math.floor(frames));
      this.blockCrouching = false;
    }
  }

  enterBlockstun(frames: number): void {
    if (this.isDefeated) {
      return;
    }

    this.blockCrouching = this.crouchHeld;
    this.blockWindowAvailable = false;
    this.blockPressPending = false;

    if (this.stateMachine.transition('BLOCKSTUN', frames)) {
      this.stateTimerDuration = Math.max(0, Math.floor(frames));
    }
  }

  tryPerfectGuard(): boolean {
    if (
      this.stateMachine.current !== 'BLOCKING' ||
      !this.blockWindowAvailable ||
      this.blockStartedFrame < 0
    ) {
      return false;
    }

    if (this.simulationFrame - this.blockStartedFrame > this.tuning.perfectGuardFrames) {
      this.blockWindowAvailable = false;
      return false;
    }

    this.blockWindowAvailable = false;
    return true;
  }

  takeDamage(amount: number): number {
    if (this.isDefeated || amount <= 0) {
      return 0;
    }

    const applied = Math.min(amount, this.currentHealth);
    this.currentHealth = Math.max(0, this.currentHealth - applied);
    return applied;
  }

  applyKnockback(horizontalVelocity: number, liftVelocity: number): void {
    this.movementVelocityX = horizontalVelocity;

    if (liftVelocity > 0) {
      this.movementVelocityY = -liftVelocity;
      this.groundedFlag = false;
    }
  }

  setDefeated(): void {
    this.cancelAttack();
    this.clearInput();
    this.currentHealth = 0;
    this.blockWindowAvailable = false;
    this.stateMachine.transition('DEFEATED');
    this.stateTimerDuration = 0;
  }

  reset(): void {
    this.x = this.config.x;
    this.y = this.config.y;
    this.currentHealth = this.config.maxHealth;
    this.movementVelocityX = 0;
    this.movementVelocityY = 0;
    this.groundedFlag = true;
    this.facingDirection = 1;
    this.currentAttack = null;
    this.stateTimerDuration = 0;
    this.simulationFrame = 0;
    this.dodgeCooldownRemaining = 0;
    this.dodgeDirection = 1;
    this.blockCrouching = false;
    this.blockStartedFrame = -1;
    this.blockWindowAvailable = false;
    this.blockPressPending = false;
    this.cancelChainDepth = 0;
    this.cancelChainCounts.clear();
    this.attackCooldowns.clear();
    this.pendingEvents.length = 0;
    this.energySystem.reset();
    this.inputBuffer.clear();
    this.stateMachine.reset('IDLE');
    this.clearInput();
  }

  getHurtbox(): AABB {
    const crouching = this.isCrouchingBody();
    const width = crouching
      ? this.config.hurtbox.crouchingWidth
      : this.config.hurtbox.standingWidth;
    const height = crouching
      ? this.config.hurtbox.crouchingHeight
      : this.config.hurtbox.standingHeight;

    return boxFromCenterBottom(this.x, this.y, width, height);
  }

  getPushbox(): AABB {
    const height = this.isCrouchingBody()
      ? this.config.hurtbox.crouchingHeight
      : this.config.hurtbox.standingHeight;

    return boxFromCenterBottom(this.x, this.y, this.config.pushboxWidth, height);
  }

  step(dtSeconds: number, arena: ArenaBounds): void {
    this.simulationFrame += 1;
    this.tickCooldowns();

    if (this.stateMachine.current === 'DEFEATED') {
      this.applyGroundFriction(dtSeconds, 1200);
      this.integrate(dtSeconds, arena);
      return;
    }

    this.stateMachine.tick();
    this.resolveTimedStateExits();
    this.updateBlockState();

    if (this.stateMachine.isActionable || this.stateMachine.current === 'BLOCKING') {
      this.tryBufferedActions();
    }

    const state = this.stateMachine.current;

    if (state === 'ATTACKING' || state === 'SPECIAL_ATTACK') {
      this.applyAttackMovement(dtSeconds);
    } else if (state === 'DODGING') {
      this.applyGroundFriction(dtSeconds, this.tuning.dodge.friction);
    } else if (state === 'BLOCKING' || state === 'BLOCKSTUN') {
      this.applyCombatFriction(dtSeconds);
    } else if (this.stateMachine.isActionable) {
      if (this.groundedFlag) {
        if (this.crouchHeld) {
          if (this.stateMachine.current !== 'CROUCHING') {
            this.stateMachine.transition('CROUCHING');
          }
          this.movementVelocityX = moveTowards(
            this.movementVelocityX,
            0,
            this.config.deceleration * dtSeconds,
          );
        } else {
          if (this.stateMachine.current === 'CROUCHING') {
            this.stateMachine.transition('IDLE');
          }
          this.applyHorizontalMovement(
            dtSeconds,
            this.config.acceleration,
            this.config.deceleration,
          );
        }
      } else {
        this.applyHorizontalMovement(
          dtSeconds,
          this.config.airAcceleration,
          this.config.airDeceleration,
        );
      }
    } else {
      this.applyCombatFriction(dtSeconds);
    }

    this.integrate(dtSeconds, arena);

    if (this.stateMachine.isActionable) {
      this.updateLocomotionState();
    }
  }

  private enqueuePressedActions(controls: FighterControls): void {
    const tick = this.simulationFrame;
    const direction: BufferedDirection = ((controls.moveLeft ? -1 : 0) +
      (controls.moveRight ? 1 : 0)) as BufferedDirection;

    if (controls.jumpPressed) {
      this.inputBuffer.enqueue('jump', tick, direction);
    }
    if (controls.lightPressed) {
      this.inputBuffer.enqueue('light', tick, direction);
    }
    if (controls.heavyPressed) {
      this.inputBuffer.enqueue('heavy', tick, direction);
    }
    if (controls.special1Pressed) {
      this.inputBuffer.enqueue('special1', tick, direction);
    }
    if (controls.special2Pressed) {
      this.inputBuffer.enqueue('special2', tick, direction);
    }
    if (controls.dodgePressed) {
      this.inputBuffer.enqueue('dodge', tick, direction);
    }
  }

  private tryBufferedActions(): void {
    if (this.isDefeated) {
      this.inputBuffer.clear();
      return;
    }

    this.inputBuffer.prune(this.simulationFrame);

    for (const entry of this.inputBuffer.items) {
      if (!this.executeBufferedAction(entry)) {
        continue;
      }

      this.inputBuffer.consume(entry);
      return;
    }
  }

  private executeBufferedAction(entry: BufferedInput): boolean {
    switch (entry.action) {
      case 'jump':
        return this.tryJump();
      case 'light':
        return this.tryStartAttack(
          this.crouchHeld && this.groundedFlag
            ? this.config.crouchingLightAttack
            : this.config.lightAttack,
        );
      case 'heavy':
        return this.tryStartAttack(this.config.heavyAttack);
      case 'special1':
        return this.tryStartAttack(this.config.specialAttacks[0]);
      case 'special2':
        return this.tryStartAttack(this.config.specialAttacks[1]);
      case 'dodge':
        return this.tryDodge(entry.direction);
    }
  }

  private updateBlockState(): void {
    if (this.isDefeated) {
      return;
    }

    const state = this.stateMachine.current;

    if (!this.blockHeld) {
      if (state === 'BLOCKING') {
        this.blockWindowAvailable = false;
        this.blockStartedFrame = -1;
        this.stateMachine.transition(this.crouchHeld ? 'CROUCHING' : 'IDLE');
      }
      return;
    }

    if (state === 'BLOCKING') {
      this.blockCrouching = this.crouchHeld;
      return;
    }

    if (!this.groundedFlag || !this.stateMachine.isActionable) {
      return;
    }

    if (!this.stateMachine.transition('BLOCKING')) {
      return;
    }

    this.blockCrouching = this.crouchHeld;
    this.movementVelocityX = 0;

    if (this.blockPressPending) {
      this.blockStartedFrame = this.simulationFrame;
      this.blockWindowAvailable = true;
    }

    this.blockPressPending = false;
  }

  private resolveTimedStateExits(): void {
    const state = this.stateMachine.current;

    if (this.stateMachine.remainingFrames > 0) {
      return;
    }

    if (state === 'HITSTUN' || state === 'KNOCKDOWN') {
      this.stateTimerDuration = 0;
      this.stateMachine.transition(this.groundedFlag ? 'IDLE' : 'FALLING');
      return;
    }

    if (state === 'BLOCKSTUN') {
      this.stateTimerDuration = 0;
      if (this.blockHeld && this.groundedFlag) {
        this.stateMachine.transition('BLOCKING');
        this.blockCrouching = this.crouchHeld;
      } else {
        this.stateMachine.transition(this.groundedFlag ? 'IDLE' : 'FALLING');
      }
      return;
    }

    if (state === 'DODGING') {
      this.stateTimerDuration = 0;
      this.movementVelocityX = 0;
      this.stateMachine.transition(this.groundedFlag ? 'IDLE' : 'FALLING');
    }
  }

  private isValidCancel(current: ActiveAttack, next: AttackDefinition): boolean {
    const window = getCancelWindow(current, next.category);
    if (!window) {
      return false;
    }

    if (window.requiresContact && !hasContact(current)) {
      return false;
    }

    if (this.cancelChainDepth + 1 > this.tuning.maxCancelChain) {
      return false;
    }

    const repeats = this.cancelChainCounts.get(next.id) ?? 0;
    return repeats < this.tuning.maxAttackRepeatsPerChain;
  }

  private resetCancelChain(): void {
    this.cancelChainDepth = 0;
    this.cancelChainCounts.clear();
  }

  private getAttackCooldown(attackId: string): number {
    return this.attackCooldowns.get(attackId) ?? 0;
  }

  private tickCooldowns(): void {
    if (this.dodgeCooldownRemaining > 0) {
      this.dodgeCooldownRemaining -= 1;
    }

    for (const [attackId, remaining] of this.attackCooldowns) {
      if (remaining <= 1) {
        this.attackCooldowns.delete(attackId);
      } else {
        this.attackCooldowns.set(attackId, remaining - 1);
      }
    }
  }

  private isCrouchingBody(): boolean {
    return (
      this.stateMachine.current === 'CROUCHING' ||
      ((this.stateMachine.current === 'BLOCKING' || this.stateMachine.current === 'BLOCKSTUN') &&
        this.blockCrouching)
    );
  }

  private finishAttack(): void {
    this.currentAttack = null;
    this.resetCancelChain();

    if (
      this.stateMachine.current === 'ATTACKING' ||
      this.stateMachine.current === 'SPECIAL_ATTACK'
    ) {
      this.stateMachine.transition(this.groundedFlag ? 'IDLE' : 'FALLING');
    }
  }

  private applyAttackMovement(dtSeconds: number): void {
    const attack = this.currentAttack;
    const advance = attack?.definition.advance;

    if (
      advance &&
      attack &&
      attack.frame >= advance.startFrame &&
      attack.frame <= advance.endFrame
    ) {
      this.movementVelocityX = this.facingDirection * advance.velocityX;
      return;
    }

    this.applyCombatFriction(dtSeconds);
  }

  private applyHorizontalMovement(
    dtSeconds: number,
    acceleration: number,
    deceleration: number,
  ): void {
    const target = this.moveDirection * this.config.movementSpeed;
    const rate = this.moveDirection !== 0 ? acceleration : deceleration;
    this.movementVelocityX = moveTowards(this.movementVelocityX, target, rate * dtSeconds);
  }

  private applyCombatFriction(dtSeconds: number): void {
    const state = this.stateMachine.current;
    const friction =
      state === 'ATTACKING' || state === 'SPECIAL_ATTACK' ? 2400 : state === 'HITSTUN' ? 620 : 900;

    this.applyGroundFriction(dtSeconds, friction);
  }

  private applyGroundFriction(dtSeconds: number, friction: number): void {
    if (!this.groundedFlag) {
      return;
    }

    this.movementVelocityX = moveTowards(this.movementVelocityX, 0, friction * dtSeconds);
  }

  private integrate(dtSeconds: number, arena: ArenaBounds): void {
    if (!this.groundedFlag) {
      this.movementVelocityY += this.config.gravity * dtSeconds;
      this.y += this.movementVelocityY * dtSeconds;

      if (this.y >= arena.groundY) {
        this.y = arena.groundY;
        this.movementVelocityY = 0;
        this.groundedFlag = true;
      }
    } else {
      this.y = arena.groundY;
      this.movementVelocityY = 0;
    }

    this.x += this.movementVelocityX * dtSeconds;

    const halfPushbox = this.config.pushboxWidth / 2;
    const minimumX = arena.left + halfPushbox;
    const maximumX = arena.right - halfPushbox;

    if (this.x < minimumX) {
      this.x = minimumX;
      this.movementVelocityX = 0;
    } else if (this.x > maximumX) {
      this.x = maximumX;
      this.movementVelocityX = 0;
    }
  }

  private updateLocomotionState(): void {
    const state = this.stateMachine.current;

    if (!this.groundedFlag) {
      if (state === 'IDLE' || state === 'WALKING' || state === 'CROUCHING') {
        this.stateMachine.transition(this.movementVelocityY < 0 ? 'JUMPING' : 'FALLING');
      } else if (state === 'JUMPING' && this.movementVelocityY >= 0) {
        this.stateMachine.transition('FALLING');
      } else if (state === 'FALLING' && this.movementVelocityY < 0) {
        this.stateMachine.transition('JUMPING');
      }
      return;
    }

    if (state === 'JUMPING' || state === 'FALLING') {
      this.stateMachine.transition('IDLE');
      return;
    }

    if (state === 'CROUCHING') {
      return;
    }

    if (state !== 'IDLE' && state !== 'WALKING') {
      return;
    }

    if (Math.abs(this.movementVelocityX) > 8) {
      if (state === 'IDLE') {
        this.stateMachine.transition('WALKING');
      }
    } else if (state === 'WALKING') {
      this.stateMachine.transition('IDLE');
    }
  }
}

function moveTowards(current: number, target: number, maximumDelta: number): number {
  if (Math.abs(target - current) <= maximumDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maximumDelta;
}
