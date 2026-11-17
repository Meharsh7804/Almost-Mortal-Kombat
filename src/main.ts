import './styles/main.css';

import { Game } from './core/Game';

const game = new Game();
game.start();

const handleBeforeUnload = (): void => {
  game.destroy();
};

window.addEventListener('beforeunload', handleBeforeUnload, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    game.destroy();
  });
}
