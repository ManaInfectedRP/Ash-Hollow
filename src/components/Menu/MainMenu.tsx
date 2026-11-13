import { useState } from 'react';
import { EventBus } from '../../game/EventBus';
import { hasSave, wipeSave } from '../../game/systems/SaveSystem';
import { sfx } from '../../game/systems/Sfx';
import { useGameStore } from '../../stores/gameStore';

/** Settings shared by the main menu and the pause menu. */
export function OptionsList() {
  const showTouch = useGameStore((s) => s.showTouch);
  const shake = useGameStore((s) => s.shake);
  const [, force] = useState(0);
  return (
    <>
      <button
        onClick={() => {
          sfx.setMuted(!sfx.muted);
          force((n) => n + 1);
        }}
      >
        Sound: {sfx.muted ? 'off' : 'on'}
      </button>
      <button
        onClick={() => {
          sfx.setMusicOn(!sfx.musicOn);
          force((n) => n + 1);
        }}
      >
        Music: {sfx.musicOn ? 'on' : 'off'}
      </button>
      <button onClick={() => useGameStore.setState({ showTouch: !showTouch })}>Touch controls: {showTouch ? 'on' : 'off'}</button>
      <button onClick={() => useGameStore.setState({ shake: !shake })}>Screen shake: {shake ? 'on' : 'off'}</button>
    </>
  );
}

type View = 'main' | 'confirm' | 'options';

export function MainMenu() {
  const menu = useGameStore((s) => s.menu);
  const [view, setView] = useState<View>('main');
  if (!menu) return null;
  if (menu === 'boot')
    return (
      <div className="title-wrap">
        <div className="title-block">
          <h1 className="title-name">Ash &amp; Hollow</h1>
          <div className="title-sub">kindling…</div>
        </div>
      </div>
    );
  const saved = hasSave();

  const start = (fresh: boolean) => {
    sfx.resume();
    sfx.bonfire();
    if (fresh) wipeSave();
    setView('main');
    useGameStore.setState({ menu: null });
    EventBus.emit('ui:start');
  };

  return (
    <div className="title-wrap">
      <div className="title-block">
        <h1 className="title-name">Ash &amp; Hollow</h1>
        <div className="title-sub">rest, and rise again</div>
        {__CHANNEL__ === 'dev' && <div className="title-channel">Dev build – testing only</div>}
      </div>
      <div className="title-menu">
        {view === 'main' && (
          <>
            <button className="primary" disabled={!saved} onClick={() => start(false)}>
              Continue
            </button>
            <button onClick={() => (saved ? setView('confirm') : start(true))}>{saved ? 'Start Over' : 'New Game'}</button>
            <button onClick={() => setView('options')}>Options</button>
          </>
        )}
        {view === 'confirm' && (
          <>
            <p className="title-warn">Erase your progress and begin anew? This cannot be undone.</p>
            <button className="danger" onClick={() => start(true)}>
              Yes, start over
            </button>
            <button onClick={() => setView('main')}>No</button>
          </>
        )}
        {view === 'options' && (
          <>
            <OptionsList />
            <button className="primary" onClick={() => setView('main')}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
