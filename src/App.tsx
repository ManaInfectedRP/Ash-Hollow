import { PhaserGame } from './components/PhaserGame';
import { HUD } from './components/HUD/HUD';
import { TouchControls } from './components/Controls/TouchControls';
import { Overlays } from './components/Overlays/Overlays';
import { MainMenu } from './components/Menu/MainMenu';
import { DebugMenu } from './components/Debug/DebugMenu';

export default function App() {
  return (
    <div className="app">
      <PhaserGame />
      <div className="vignette" />
      <HUD />
      <TouchControls />
      <Overlays />
      <MainMenu />
      <DebugMenu />
    </div>
  );
}
