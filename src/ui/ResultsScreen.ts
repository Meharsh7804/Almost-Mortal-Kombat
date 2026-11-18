import Phaser from 'phaser';

import type { MatchStatisticsSnapshot } from '../systems/MatchStats';
import type { ResolvedMatchConfig } from '../data/MatchConfig';
import type { ArcadeRunSnapshot } from '../arcade/ArcadeConfig';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/GameConfig';
import { MenuButton } from './MenuButton';
import { CSS_COLORS, FONTS } from './Theme';

export interface ArcadeResultsContext {
  readonly run: ArcadeRunSnapshot;
  readonly stageIndex: number;
}

export interface ResultsSceneData {
  readonly config: ResolvedMatchConfig;
  readonly stats: MatchStatisticsSnapshot;
  readonly winnerPlayer: 1 | 2 | null;
  readonly winnerName: string | null;
  readonly isDraw: boolean;
  readonly arenaName: string;
  readonly p1Name: string;
  readonly p2Name: string;
  readonly p1Color: number;
  readonly p2Color: number;
  readonly roundsWon: readonly [number, number];
  readonly matchToken?: string;
  readonly arcade?: ArcadeResultsContext;
  readonly progressionApplied?: boolean;
}

export interface ResultsAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ResultsScreenOptions {
  readonly winnerName: string | null;
  readonly winnerPlayer: 1 | 2 | null;
  readonly winnerColor: number;
  readonly isDraw: boolean;
  readonly onRematch?: () => void;
  readonly onChangeFighters?: () => void;
  readonly onChangeArena?: () => void;
  readonly onMenu?: () => void;
  readonly actions?: readonly ResultsAction[];
  readonly extraLines?: readonly string[];
  readonly stats?: MatchStatisticsSnapshot;
  readonly p1Name?: string;
  readonly p2Name?: string;
  readonly roundsWon?: readonly [number, number];
}

const OVERLAY_DEPTH = 190;
const BUTTON_DEPTH = 210;

export class ResultsScreen {
  private readonly scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Container | null = null;
  private buttons: MenuButton[] = [];
  private options: ResultsScreenOptions | null = null;
  private visible = false;
  private handled = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(options: ResultsScreenOptions): void {
    this.destroy();
    this.options = options;
    this.visible = true;
    this.handled = false;

    const container = this.scene.add.container(0, 0).setDepth(OVERLAY_DEPTH);
    const dim = this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x030207, 0.72);
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x100a14, 0.96);
    panel.fillRoundedRect(220, 110, 840, 500, 16);
    panel.lineStyle(2, options.winnerColor, 0.7);
    panel.strokeRoundedRect(220, 110, 840, 500, 16);

    const title = this.scene.add.text(GAME_WIDTH / 2, 156, options.isDraw ? 'DOUBLE K.O.' : 'MATCH COMPLETE', {
      fontFamily: FONTS.display,
      fontSize: '42px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    const winner = this.scene.add.text(
      GAME_WIDTH / 2,
      206,
      options.isDraw ? 'NO WINNER' : `${options.winnerName ?? 'WINNER'} WINS`,
      {
        fontFamily: FONTS.display,
        fontSize: '30px',
        color: Phaser.Display.Color.IntegerToColor(options.winnerColor).rgba,
        stroke: '#000000',
        strokeThickness: 5,
      },
    ).setOrigin(0.5);

    container.add([dim, panel, title, winner]);

    if (options.stats && options.p1Name && options.p2Name && options.roundsWon) {
      container.add(this.createStatsBlock(options));
    }

    if (options.extraLines && options.extraLines.length > 0) {
      options.extraLines.slice(0, 4).forEach((line, i) => {
        container.add(this.scene.add.text(GAME_WIDTH / 2, 468 + i * 18, line, {
          fontFamily: FONTS.mono,
          fontSize: '11px',
          color: CSS_COLORS.violet,
          align: 'center',
        }).setOrigin(0.5));
      });
    }

    this.overlay = container;
    this.createButtons();
  }

  private createButtons(): void {
    const options = this.options;
    if (!options) return;
    const defs: ResultsAction[] = options.actions
      ? [...options.actions]
      : [
          { label: 'REMATCH', onClick: options.onRematch ?? (() => {}) },
          { label: 'CHANGE FIGHTERS', onClick: options.onChangeFighters ?? (() => {}) },
          { label: 'CHANGE ARENA', onClick: options.onChangeArena ?? (() => {}) },
          { label: 'MAIN MENU', onClick: options.onMenu ?? (() => {}) },
        ];

    const count = defs.length;
    const h = 44;
    const y = 552;
    const w = count <= 4 ? 250 : Math.max(170, Math.floor(980 / count) - 12);
    const gap = w + 16;
    const startX = GAME_WIDTH / 2 - (gap * (count - 1)) / 2;

    this.buttons = defs.map((def, i) =>
      new MenuButton(this.scene, {
        x: startX + i * gap,
        y,
        width: w,
        height: h,
        label: def.label,
        onClick: () => this.invoke(def.onClick),
      }).setDepth(BUTTON_DEPTH),
    );
  }

  hide(): void {
    if (this.overlay) this.overlay.setVisible(false);
    for (const b of this.buttons) b.setVisible(false);
    this.visible = false;
  }

  destroy(): void {
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.overlay?.destroy(true);
    this.overlay = null;
    this.visible = false;
  }

  private createStatsBlock(options: ResultsScreenOptions): Phaser.GameObjects.Container {
    const stats = options.stats!;
    const c = this.scene.add.container(0, 0);
    const [p1, p2] = stats.players;
    const leftX = 320;
    const rightX = 960;
    const startY = 270;
    const line = 30;

    const header = this.scene.add.text(GAME_WIDTH / 2, 244, `ROUNDS ${options.roundsWon![0]} - ${options.roundsWon![1]}  •  ${Math.round(stats.durationSeconds)}s`, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5);
    c.add(header);

    const rows: Array<[string, string, string]> = [
      [String(p1.damageDealt), 'DAMAGE DEALT', String(p2.damageDealt)],
      [String(p1.hitsLanded), 'HITS LANDED', String(p2.hitsLanded)],
      [String(p1.highestCombo), 'HIGHEST COMBO', String(p2.highestCombo)],
      [String(p1.highestComboDamage), 'COMBO DAMAGE', String(p2.highestComboDamage)],
      [String(p1.perfectGuards), 'PERFECT GUARDS', String(p2.perfectGuards)],
      [String(p1.dodges), 'DODGES', String(p2.dodges)],
      [String(p1.specialsUsed), 'SPECIALS USED', String(p2.specialsUsed)],
    ];

    c.add(this.scene.add.text(leftX, startY - 28, options.p1Name!, { fontFamily: FONTS.display, fontSize: '16px', color: CSS_COLORS.bone }).setOrigin(0.5));
    c.add(this.scene.add.text(rightX, startY - 28, options.p2Name!, { fontFamily: FONTS.display, fontSize: '16px', color: CSS_COLORS.bone }).setOrigin(0.5));

    rows.forEach((row, i) => {
      const y = startY + i * line;
      c.add(this.scene.add.text(leftX, y, row[0], { fontFamily: FONTS.mono, fontSize: '14px', color: CSS_COLORS.bone }).setOrigin(0.5));
      c.add(this.scene.add.text(GAME_WIDTH / 2, y, row[1], { fontFamily: FONTS.mono, fontSize: '11px', color: CSS_COLORS.muted }).setOrigin(0.5).setLetterSpacing(1));
      c.add(this.scene.add.text(rightX, y, row[2], { fontFamily: FONTS.mono, fontSize: '14px', color: CSS_COLORS.bone }).setOrigin(0.5));
    });

    return c;
  }



  private invoke(cb: () => void): void {
    if (this.handled || !this.visible) return;
    this.handled = true;
    cb();
  }
}
