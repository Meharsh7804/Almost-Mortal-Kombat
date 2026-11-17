import {
  advanceAttack,
  createActiveAttack,
  getAttackPhase,
  getAttackPhaseProgress,
  getAttackProgress,
  type ActiveAttack,
} from '../combat/AttackSystem';
import {
  HEAVY_PUNCH,
  LIGHT_PUNCH,
  type AttackDefinition,
  type AttackPhase,
} from '../combat/FrameData';
import type { ArenaBounds } from '../data/ArenaConfig';
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
}

export interface FighterControls {
  readonly moveLeft: boolean;
  readonly moveRight: boolean;
  readonly crouch: boolean;
  readonly jumpPressed: boolean;
  readonly lightPressed: boolean;
  readonly heavyPressed: boolean;
}

export const NEUTRAL_CONTROLS: FighterControls = Object.freeze({
  moveLeft: false,
  moveRight: false,
  crouch: false,
  jumpPressed: false,
  lightPressed: false,
  heavyPressed: false,
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

  x: number;
  y: number;

  private facingDirection: FacingDirection = 1;
  private currentHealth: number;
  private readonly stateMachine = new FighterStateMachine();
  private currentAttack: ActiveAttack | null = null;
  private movementVelocityX = 0;
  private movementVelocityY = 0;
  private moveDirection = 0;
  private crouchHeld = false;
  private stateTimerDuration = 0;
  private groundedFlag = true;

  constructor(config: FighterConfig) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.playerNumber = config.playerNumber;
    this.x = config.x;
    this.y = config.y;
    this.currentHealth = config.maxHealth;
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

  get isDefeated(): boolean {
    return this.stateMachine.current === 'DEFEATED';
  }

  get isActionable(): boolean {
    return this.stateMachine.isActionable;
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

  setHorizontalPosition(x: number): void {
    this.x = x;
  }

  clearInput(): void {
    this.moveDirection = 0;
    this.crouchHeld = false;
  }

  applyControls(controls: FighterControls): void {
    this.moveDirection = (controls.moveLeft ? -1 : 0) + (controls.moveRight ? 1 : 0);
    this.crouchHeld = controls.crouch;

    if (this.isDefeated) {
      this.moveDirection = 0;
      this.crouchHeld = false;
      return;
    }

    if (controls.jumpPressed) {
      this.tryJump();
    }

    if (controls.heavyPressed) {
      this.tryStartAttack(HEAVY_PUNCH);
    } else if (controls.lightPressed) {
      this.tryStartAttack(LIGHT_PUNCH);
    }
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

  tryStartAttack(definition: AttackDefinition): boolean {
    if (
      this.currentAttack !== null ||
      !this.stateMachine.isActionable ||
      this.isDefeated ||
      (!this.groundedFlag && !this.config.canAttackAirborne)
    ) {
      return false;
    }

    if (!this.stateMachine.transition('ATTACKING')) {
      return false;
    }

    this.currentAttack = createActiveAttack(definition);
    this.stateTimerDuration = 0;
    if (this.groundedFlag) {
      this.movementVelocityX = 0;
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

    if (this.stateMachine.current === 'ATTACKING') {
      this.stateMachine.transition(this.groundedFlag ? 'IDLE' : 'FALLING');
    }
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

  enterHitstun(frames: number): void {
    if (this.isDefeated) {
      return;
    }

    this.cancelAttack();
    this.clearInput();

    if (this.stateMachine.transition('HITSTUN', frames)) {
      this.stateTimerDuration = Math.max(0, Math.floor(frames));
    }
  }

  enterKnockdown(frames: number): void {
    if (this.isDefeated) {
      return;
    }

    this.cancelAttack();
    this.clearInput();

    if (this.stateMachine.transition('KNOCKDOWN', frames)) {
      this.stateTimerDuration = Math.max(0, Math.floor(frames));
    }
  }

  setDefeated(): void {
    this.cancelAttack();
    this.clearInput();
    this.currentHealth = 0;
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
    this.stateMachine.reset('IDLE');
    this.clearInput();
  }

  getHurtbox(): AABB {
    const crouching = this.stateMachine.current === 'CROUCHING';
    const width = crouching
      ? this.config.hurtbox.crouchingWidth
      : this.config.hurtbox.standingWidth;
    const height = crouching
      ? this.config.hurtbox.crouchingHeight
      : this.config.hurtbox.standingHeight;

    return boxFromCenterBottom(this.x, this.y, width, height);
  }

  getPushbox(): AABB {
    const height =
      this.stateMachine.current === 'CROUCHING'
        ? this.config.hurtbox.crouchingHeight
        : this.config.hurtbox.standingHeight;

    return boxFromCenterBottom(this.x, this.y, this.config.pushboxWidth, height);
  }

  step(dtSeconds: number, arena: ArenaBounds): void {
    if (this.stateMachine.current === 'DEFEATED') {
      this.applyGroundFriction(dtSeconds, 1200);
      this.integrate(dtSeconds, arena);
      return;
    }

    this.stateMachine.tick();

    if (
      (this.stateMachine.current === 'HITSTUN' || this.stateMachine.current === 'KNOCKDOWN') &&
      this.stateMachine.remainingFrames <= 0
    ) {
      this.stateTimerDuration = 0;
      this.stateMachine.transition(this.groundedFlag ? 'IDLE' : 'FALLING');
    }

    if (this.stateMachine.isActionable) {
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

  private finishAttack(): void {
    this.currentAttack = null;
    if (this.stateMachine.current === 'ATTACKING') {
      this.stateMachine.transition(this.groundedFlag ? 'IDLE' : 'FALLING');
    }
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
    const friction = state === 'ATTACKING' ? 2400 : state === 'HITSTUN' ? 620 : 900;

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
